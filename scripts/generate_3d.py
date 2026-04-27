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

# NumPy 2.0 compatibility: np.product was deprecated and removed, use np.prod instead
# This patch ensures compatibility with libraries that still call np.product
if not hasattr(np, 'product'):
    np.product = np.prod


def extrude_polygon_safe(polygon: Polygon, height: float) -> trimesh.Trimesh:
    """
    Resilient polygon extrusion that tries multiple strategies:
    1. trimesh's native extrude_polygon (requires 'triangle' or 'mapbox-earcut')
    2. Manual fan-triangulation fallback using raw numpy geometry
    """
    # Strategy 1: Use trimesh's built-in extrusion (needs a triangulation engine)
    try:
        return trimesh.creation.extrude_polygon(polygon, height=height)
    except Exception as engine_err:
        logging.warning(f"trimesh extrude_polygon failed ({engine_err}), using manual fallback")

    # Strategy 2: Manual fan triangulation from polygon exterior coordinates
    coords_2d = np.array(polygon.exterior.coords[:-1], dtype=np.float64)  # drop closing dup
    n = len(coords_2d)
    if n < 3:
        raise ValueError("Polygon has fewer than 3 vertices")

    # Build bottom and top rings
    bottom = np.column_stack([coords_2d, np.zeros(n)])
    top = np.column_stack([coords_2d, np.full(n, height)])
    vertices = np.vstack([bottom, top])  # indices 0..n-1 = bottom, n..2n-1 = top

    faces = []

    # Bottom cap (fan triangulation, reverse winding for inward normal)
    for i in range(1, n - 1):
        faces.append([0, i + 1, i])

    # Top cap (fan triangulation)
    for i in range(1, n - 1):
        faces.append([n, n + i, n + i + 1])

    # Side walls (two triangles per quad)
    for i in range(n):
        j = (i + 1) % n
        # bottom[i], bottom[j], top[j], top[i]
        bi, bj, tj, ti = i, j, n + j, n + i
        faces.append([bi, bj, tj])
        faces.append([bi, tj, ti])

    faces = np.array(faces, dtype=np.int64)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=True)
    trimesh.repair.fix_normals(mesh)
    return mesh

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
    
    # Remove degenerate faces (version-adaptive)
    try:
        if hasattr(repaired, "remove_degenerate_faces"):
            repaired.remove_degenerate_faces()
        else:
            nondegenerate = repaired.nondegenerate_faces() if hasattr(repaired, "nondegenerate_faces") else None
            if nondegenerate is not None:
                repaired.update_faces(nondegenerate)
    except Exception as e:
        logging.warning(f"Failed to remove degenerate faces: {e}")
    
    # Fix normals (defensive)
    try:
        trimesh.repair.fix_normals(repaired)
    except Exception as e:
        logging.warning(f"Failed to fix normals: {e}")
    
    # Fill holes (defensive)
    try:
        trimesh.repair.fill_holes(repaired)
    except Exception as e:
        logging.warning(f"Failed to fill holes: {e}")
    
    # Remove unreferenced vertices (defensive)
    try:
        repaired.remove_unreferenced_vertices()
    except Exception as e:
        logging.warning(f"Failed to remove unreferenced vertices: {e}")
    
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
        
        # Resilient extrusion: tries trimesh native engine, falls back to manual triangulation
        try:
            mesh = extrude_polygon_safe(poly, height=wall_height_inches)
            meshes.append(mesh)
        except Exception as extrude_err:
            logging.error(f"Skipping wall polygon (extrusion failed): {extrude_err}")
            continue

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
