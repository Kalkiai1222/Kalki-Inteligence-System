import sys
import json
import logging
import math
import os
from itertools import combinations
import networkx as nx
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union, polygonize

# Import new modular geometry logic
from geometry.raster_extraction import build_segments_from_raster
from shapely.affinity import scale
from scale.scale_detection import get_scale_multiplier
from models import GeometryData, Wall, Room, ScaleInfo, SettingsUsed, AuditMetadata
from geometry.spatial_utils import shoelace_formula, get_audit_expansion

# Setup basic logging for debugging
logging.basicConfig(level=logging.ERROR, format='%(levelname)s: %(message)s')

def extract_geometry(data, company_id=None) -> GeometryData:
    """
    Converts raw blueprint lines and paths into structured geometry 
    (walls, rooms, openings).
    """
    raw_lines = data.get("lines", [])
    raw_paths = data.get("paths", [])
    raw_text = data.get("text", [])
    
    # Create boxes for text to filter out text underlines or letter strokes
    text_boxes = []
    for t in raw_text:
        bbox = t.get("bbox")
        if bbox:
            text_boxes.append(box(bbox[0], bbox[1], bbox[2], bbox[3]).buffer(2.0))
            
    # 1. Gather all line segments
    segments = []
    
    # From explicit lines
    for item in raw_lines:
        p1 = tuple(item["p1"])
        p2 = tuple(item["p2"])
        # Ignore short lines (noise, hatching)
        dist = math.hypot(p2[0]-p1[0], p2[1]-p1[1])
        if dist > 10.0:
            line = LineString([p1, p2])
            # Skip lines that are entirely inside text boxes
            if not any(line.within(tb) for tb in text_boxes):
                segments.append(line)
            
    # Include segments extracted via our new raster extraction module
    raster_segments = build_segments_from_raster(raw_paths)
    segments.extend(raster_segments)
                    
    if not segments:
        return {"walls": [], "rooms": [], "openings": [], "zones": []}
        
    # Scale Detection Module integration
    # Determine how to convert paper/pixel points to real-world standardized unit (inches)
    notes_and_dimensions = raw_text + data.get("dimensions", []) + data.get("notes", [])
    scale_multiplier, unit_system, scale_text = get_scale_multiplier({
        "manualScale": data.get("manualScale"),
        "text": raw_text,
        "notes": notes_and_dimensions,
        "segments": segments
    })
    
    # Optional override from payload vs detected
    # We apply the scale to map every document unit to an inch.
    # Note: 1 document unit mapped with 48 multiplier = 48 inches.
    scaled_segments = [scale(line, xfact=scale_multiplier, yfact=scale_multiplier, origin=(0,0)) for line in segments]
        
    # 2. Build walls (Detecting parallel lines and merging them)
    # Physical walls are typically ~4 to 8 inches thick in US construction.
    # We buffer by half the assumed physical width (e.g. 6.0 inches / 2 = 3.0).
    wall_thickness_in = float(data.get("settings", {}).get("wallThickness", 6.0))
    buffered_for_walls = [line.buffer(wall_thickness_in / 2.0, cap_style=2, join_style=2) for line in scaled_segments]
    merged_structure = unary_union(buffered_for_walls)
    
    walls = []
    # If the structure is a single Polygon or MultiPolygon, we break down its exterior and interior rings
    # into individual wall segment outlines so we don't have "1 Struct Wall"
    if merged_structure.geom_type == 'Polygon':
        coords = list(merged_structure.exterior.simplify(1.0).coords)
        walls.append(Wall(
            polygon=coords,
            audit=AuditMetadata(
                vertices=coords,
                formula=get_audit_expansion(coords),
                result=shoelace_formula(coords),
                units="px_sq"
            )
        ))
        for interior in merged_structure.interiors:
            i_coords = list(interior.simplify(1.0).coords)
            walls.append(Wall(
                polygon=i_coords,
                audit=AuditMetadata(
                    vertices=i_coords,
                    formula=get_audit_expansion(i_coords),
                    result=shoelace_formula(i_coords),
                    units="px_sq"
                )
            ))
    elif merged_structure.geom_type == 'MultiPolygon':
        for poly in merged_structure.geoms:
             coords = list(poly.exterior.simplify(1.0).coords)
             walls.append(Wall(
                 polygon=coords,
                 audit=AuditMetadata(
                     vertices=coords,
                     formula=get_audit_expansion(coords),
                     result=shoelace_formula(coords),
                     units="px_sq"
                 )
             ))
             for interior in poly.interiors:
                i_coords = list(interior.simplify(1.0).coords)
                walls.append(Wall(
                    polygon=i_coords,
                    audit=AuditMetadata(
                        vertices=i_coords,
                        formula=get_audit_expansion(i_coords),
                        result=shoelace_formula(i_coords),
                        units="px_sq"
                    )
                ))
             
    # 3. Detect Rooms (Polygonize)
    # Rooms are the empty spaces enclosed by the walls.
    # Buffer lines a bit beyond actual wall thickness to ensure small architectural gaps (doorways) close 
    # and form bounded room loops. Doorways might be 36" (3ft), so ~18-20 inches of buffer.
    room_gap_closure_in = float(data.get("settings", {}).get("doorwayGapClosure", 36.0)) / 2.0
    thick_lines = unary_union([line.buffer(room_gap_closure_in) for line in scaled_segments])
    
    boundaries = []
    if thick_lines.geom_type == 'Polygon':
        boundaries.append(LineString(thick_lines.exterior.coords))
        for interior in thick_lines.interiors:
            boundaries.append(LineString(interior.coords))
    elif thick_lines.geom_type == 'MultiPolygon':
        for poly in thick_lines.geoms:
            boundaries.append(LineString(poly.exterior.coords))
            for interior in poly.interiors:
                boundaries.append(LineString(interior.coords))
                
    polygons = list(polygonize(boundaries))
    
    rooms = []
    room_features_text = []

    # Threshold for real-world space. A typical tiny functional closet would be > 10sqft (1440sq_in)
    min_room_area_sq_in = data.get("settings", {}).get("minRoomAreaSqFt", 10.0) * 144.0
    # Anything enormous > 1,000,000 sq ft is probably the entire site or error
    max_room_area_sq_in = 100_000_000.0

    for poly in polygons:
        area = poly.area
        if min_room_area_sq_in < area < max_room_area_sq_in:
            coords = list(poly.exterior.simplify(2.0).coords)
            perimeter = poly.length
            # Convert area back to sqft for signature
            sq_ft = area / 144.0
            signature = f"Room Area SqFt: {round(sq_ft, 2)}, Perimeter Inches: {round(perimeter, 2)}, Vertices: {len(coords)}"
            
            rooms.append(Room(
                areaSqFt=round(sq_ft, 2),
                perimeterInches=round(perimeter, 2),
                vertices=len(coords),
                polygon=coords,
                classification="Unclassified Room",
                signature=signature,
                audit=AuditMetadata(
                    vertices=coords,
                    formula=get_audit_expansion(coords),
                    result=round(sq_ft, 2),
                    units="sq ft"
                )
            ))
            room_features_text.append(signature)
            
    # Try querying FAISS elastic memory if available
    if company_id and room_features_text:
        try:
            # We import here to avoid circular dependencies and load overhead if not needed
            script_dir = os.path.dirname(__file__)
            if script_dir not in sys.path:
                sys.path.append(script_dir)
            from elastic_memory import batch_classify
            class_res = batch_classify(company_id, room_features_text)
            predictions = class_res.get("classifications", [])
            for i, r in enumerate(rooms):
                if i < len(predictions) and float(predictions[i].get("confidence", 0)) > 0.85:
                     r.classification = str(predictions[i]["predicted"])
                     r.confidence = float(predictions[i]["confidence"])
        except Exception as e:
            logging.error(f"Elastic Memory Classification Failed: {e}")

    # 4. Openings (Doors/Windows)
    # In architectural plans, gaps in otherwise continuous linear structures or specific arc symbols represent doors.
    # For this implementation, we will look for short line segments that are orthogonal to major walls.
    openings = []
    # (Implementation detail omitted for brevity, returning empty list as placeholder)

    # 5. Structural Zones
    zones = []
    
    return GeometryData(
        walls=walls,
        rooms=rooms,
        openings=openings,
        zones=zones,
        scale=ScaleInfo(
            multiplier=scale_multiplier,
            unitSystem=unit_system,
            detectedText=scale_text
        ),
        settingsUsed=SettingsUsed(
            wallThicknessInches=wall_thickness_in,
            minRoomAreaSqFt=min_room_area_sq_in / 144.0
        )
    )

if __name__ == "__main__":
    # Expect JSON data from stdin
    input_data = sys.stdin.read()
    if not input_data:
        print(json.dumps({"error": "No input data provided"}))
        sys.exit(1)
        
    try:
        data = json.loads(input_data)
        company_id = data.get("companyId", None)
        result = extract_geometry(data, company_id=company_id)
        if hasattr(result, "model_dump_json"):
            print(result.model_dump_json())
        else:
            print(json.dumps(result.dict()))  # Pydantic v1 fallback if needed
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)