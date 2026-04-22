import sys
import json
import logging
import os
import io
import tempfile
from shapely.geometry import Polygon
import trimesh
import numpy as np
import yaml
from pydantic import BaseModel

# Import new AI material logic module
from material_logic.insulation_logic import get_ai_material_takeoff

# Import new OpenUSD reconstruction logic
from reconstruction.usd_export import generate_usda_from_mesh


class MeshQualityReport(BaseModel):
    is_watertight: bool
    non_manifold_edge_count: int
    inverted_normal_count: int
    degenerate_face_count: int
    passed: bool
    failure_reasons: list[str]


def load_quality_config():
    config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    defaults = {
        "mesh_quality": {
            "require_watertight": True,
            "max_non_manifold_edges": 0,
            "max_degenerate_faces": 0,
        }
    }
    if not os.path.exists(config_path):
        return defaults
    with open(config_path, "r", encoding="utf-8") as fp:
        loaded = yaml.safe_load(fp) or {}
    return {
        "mesh_quality": {
            "require_watertight": loaded.get("mesh_quality", {}).get("require_watertight", True),
            "max_non_manifold_edges": loaded.get("mesh_quality", {}).get("max_non_manifold_edges", 0),
            "max_degenerate_faces": loaded.get("mesh_quality", {}).get("max_degenerate_faces", 0),
        }
    }


def evaluate_mesh_quality(mesh: trimesh.Trimesh, config: dict) -> MeshQualityReport:
    reasons: list[str] = []
    edges_unique = len(mesh.edges_unique) if mesh.edges_unique is not None else 0
    edges_manifold = len(mesh.edges_unique_inverse) if mesh.edges_unique_inverse is not None else 0
    non_manifold_estimate = max(0, edges_unique - edges_manifold)
    degenerate_faces = int(np.sum(mesh.area_faces <= 1e-12))
    inverted_normals = int(np.sum(mesh.face_normals[:, 2] < -0.99))

    if config["mesh_quality"]["require_watertight"] and not mesh.is_watertight:
        reasons.append("mesh is not watertight")
    if non_manifold_estimate > config["mesh_quality"]["max_non_manifold_edges"]:
        reasons.append(f"non-manifold edges: {non_manifold_estimate}")
    if degenerate_faces > config["mesh_quality"]["max_degenerate_faces"]:
        reasons.append(f"degenerate faces: {degenerate_faces}")

    return MeshQualityReport(
        is_watertight=bool(mesh.is_watertight),
        non_manifold_edge_count=non_manifold_estimate,
        inverted_normal_count=inverted_normals,
        degenerate_face_count=degenerate_faces,
        passed=len(reasons) == 0,
        failure_reasons=reasons,
    )


def repair_mesh(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    repaired = mesh.copy()
    repaired.remove_degenerate_faces()
    trimesh.repair.fix_normals(repaired)
    trimesh.repair.fill_holes(repaired)
    repaired.remove_unreferenced_vertices()
    return repaired

def generate_step_export(walls, height):
    """
    Generates a true ISO-compliant STEP file containing BRep geometry
    using CadQuery (OpenCASCADE Python wrapper).
    Replaces the mock string-based exporter.
    """
    import cadquery as cq
    
    solids = []
    for w in walls:
        wall_coords = w.get("polygon", []) if isinstance(w, dict) else w
        if len(wall_coords) < 3:
            continue
            
        # Ensure polygon is closed for valid wire generation
        pts = [(float(p[0]), float(p[1])) for p in wall_coords]
        if pts[0] != pts[-1]:
            pts.append(pts[0])
            
        try:
            # Build a 2D face from the polygon wire, then extrude into a 3D solid
            solid = cq.Workplane("XY").polyline(pts).close().extrude(float(height))
            solids.append(solid.val())
        except Exception as e:
            logging.error(f"Failed to extrude wall face: {e}")
            continue

    if not solids:
        return ""
        
    # Compound all wall bodies into a single valid model structure
    assembly = cq.Compound.makeCompound(solids)
    
    with tempfile.NamedTemporaryFile(suffix=".step", delete=False) as tmp:
        tmp_name = tmp.name
        
    try:
        # Export the robust boundary representation
        cq.exporters.export(assembly, tmp_name, 'STEP')
        with open(tmp_name, 'r') as f:
            step_content = f.read()
        return step_content
    finally:
        if os.path.exists(tmp_name):
            os.remove(tmp_name)

def process_3d(data):
    walls = data.get('walls', [])
    rooms = data.get('rooms', [])
    notes = data.get('notes', [])
    text = data.get('text', [])
    
    # Load user-provided wall parameter overrides. 
    # Fallback to standard 10ft (120 inches).
    settings = data.get("settings", {})
    wall_height_inches = float(settings.get("wallHeightInches", 120.0))
    
    if not walls:
         return {
             "status": "success",
             "obj": "",
             "step": ""
         }
         
    # Create trimesh meshes for each wall
    meshes = []
    
    for w in walls:
        wall_coords = w.get("polygon", []) if isinstance(w, dict) else w
        if len(wall_coords) < 3:
            continue
        poly = Polygon(wall_coords)
        
        # Trimesh extrusion
        # Trimesh's creation.extrude_polygon creates a 3D mesh from a 2D shapely polygon
        mesh = trimesh.creation.extrude_polygon(poly, height=wall_height_inches)
        meshes.append(mesh)

    if not meshes:
         return {
             "status": "success",
             "obj": "",
             "step": "",
             "takeoff": None
         }

    # Combine all walls into a single watertight scene/mesh
    combined_mesh = trimesh.util.concatenate(meshes)

    config = load_quality_config()
    quality_report = evaluate_mesh_quality(combined_mesh, config)
    mesh_quality_status = "passed"
    if not quality_report.passed:
        combined_mesh = repair_mesh(combined_mesh)
        quality_report = evaluate_mesh_quality(combined_mesh, config)
        mesh_quality_status = "repaired" if quality_report.passed else "failed"
        if not quality_report.passed:
            return {
                "status": "quality_failed",
                "mesh_quality": mesh_quality_status,
                "quality_report": quality_report.model_dump(),
                "error": "Mesh quality checks failed",
            }
    
    # --- TAKEOFF CALCULATIONS FROM 3D MODEL ---
    # 1. Total Volume (cubic inches -> cubic feet)
    total_volume_cu_in = combined_mesh.volume
    total_volume_cu_ft = abs(total_volume_cu_in) / 1728.0

    # 2. Surface Areas
    # Trimesh facets can be categorized by normal.
    # Vertical faces (normals roughly horizontal) = Walls
    # Horizontal faces (normals roughly vertical) = Ceilings / Floors
    face_areas = combined_mesh.area_faces
    face_normals = combined_mesh.face_normals
    
    wall_area_sq_in = 0.0
    floor_ceiling_area_sq_in = 0.0
    
    for area, normal in zip(face_areas, face_normals):
         # Normal pointing mostly UP or DOWN
         if abs(normal[2]) > 0.9: 
             floor_ceiling_area_sq_in += area
         else:
             wall_area_sq_in += area
             
    wall_surface_sq_ft = wall_area_sq_in / 144.0
    floor_ceiling_sq_ft = floor_ceiling_area_sq_in / 144.0

    # Replace hardcoded materials with AI-driven geometry + notes classification logic
    material_data = get_ai_material_takeoff(
        walls=walls,
        rooms=rooms,
        notes=notes,
        text=text,
        wall_surface_sq_ft=wall_surface_sq_ft,
        floor_ceiling_sq_ft=floor_ceiling_sq_ft,
        volume_cu_ft=total_volume_cu_ft,
        wall_height_inches=wall_height_inches
    )

    takeoff = {
        "wallSurfaceArea": round(wall_surface_sq_ft, 2),
        "floorCeilingArea": round(floor_ceiling_sq_ft, 2),
        "volume": round(total_volume_cu_ft, 2),
        "drywallPanels": material_data.materials.drywallPanelsTotal,
        "studs": material_data.materials.studsTotal,
        "paintGallons": round(material_data.materials.paintGallonsTotal, 2),
        "wasteFactor": material_data.materials.wasteFactor,
        "wallHeightInches": wall_height_inches,
        "insulation": material_data.insulation.model_dump() if hasattr(material_data.insulation, 'model_dump') else material_data.insulation.dict(),
        "perWallDetails": [w.model_dump() if hasattr(w, 'model_dump') else w.dict() for w in material_data.perWallDetails]
    }
    
    # Export OBJ (returns string)
    obj_string = combined_mesh.export(file_type='obj')

    # Export Basic USD Format
    try:
        usd_string = generate_usda_from_mesh(combined_mesh.vertices, combined_mesh.faces)
    except Exception as e:
        logging.error(f"USDA generation failed: {e}")
        usd_string = ""
    
    # Export true ISO-compliant STEP file via OpenCASCADE (BRep mapping)
    try:
        step_string = generate_step_export(walls, wall_height_inches)
    except ImportError:
        logging.error("Failed to import cadquery/OCP. Ensure ISO CAD exporter requirements are installed.")
        step_string = ""
    except Exception as e:
        logging.error(f"STEP export failed: {e}")
        step_string = ""

    return {
        "status": "success",
        "mesh_quality": mesh_quality_status,
        "quality_report": quality_report.model_dump(),
        "obj": obj_string,
        "usd": usd_string,
        "step": step_string,
        "takeoff": takeoff,
        "stats": {
            "faces": len(combined_mesh.faces),
            "vertices": len(combined_mesh.vertices)
        }
    }

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "No input provided"}))
            return
        data = json.loads(input_data)
        result = process_3d(data)
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
