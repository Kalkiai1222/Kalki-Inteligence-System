import os
import json
import httpx
import logging
from dotenv import load_dotenv

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import ProcessingOutput, InsulationSpec, Material, WallMaterialData, AuditMetadata
from geometry.spatial_utils import shoelace_formula, get_audit_expansion, calculate_perimeter

load_dotenv()

def get_ai_material_takeoff(walls, rooms, notes, text, wall_surface_sq_ft, floor_ceiling_sq_ft, volume_cu_ft, wall_height_inches) -> ProcessingOutput:
    """
    Sends the geometry data, extracted text notes, and computed areas to an LLM 
    to derive accurate material counts and insulation types per wall.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    
    system_prompt = '''You are a senior structural estimator AI. Analyze the blueprint context meticulously.
Inputs:
- OCR text notes (these typically hold "R-13", "Batt insulation", "Exterior walls: R-21", etc.)
- Arrays of walls with their geometry characteristics

Your mandate:
1. Extract insulation type, exterior R-value, and interior R-value directly from the notes.
2. For each wall provided, classify it as "exterior" or "interior" based on relative lengths and standard structural assumptions if explicit tags don't exist. Usually the longest perimeter walls form the exterior envelope.
3. Compute structured per-wall material logic (Drywall panels assume 4x8 ft = 32 sqft/panel. Studs assume 1 per 16 inches. Insulation depends on wall class).
4. Provide total roll-ups.

Return strictly in the following JSON schema:
{
  "insulation": {
      "type": "Extract from notes or 'Fiberglass Batt'",
      "rValueExterior": "e.g., 'R-21' or 'Unknown'",
      "rValueInterior": "e.g., 'R-13' or 'Unknown'",
      "description": "Short explanation of findings"
  },
  "materials": {
      "drywallPanelsTotal": 100,
      "studsTotal": 120,
      "paintGallonsTotal": 5.5,
      "wasteFactor": 0.10
  },
  "perWallDetails": [
      {
         "wallIndex": 0,
         "classification": "exterior",
         "lengthInches": 120.5,
         "surfaceAreaSqFt": 100.4,
         "drywallPanels": 3.5,
         "studs": 8,
         "insulationRValue": "R-21",
         "notes": "Calculated based on standard spacing..."
      }
  ]
}
'''
    
    wall_context = []
    audit_map = {} # Store audit info to re-attach after LLM processing
    
    for idx, w in enumerate(walls):
        coords = w.get("polygon", []) if isinstance(w, dict) else w
        if not coords: continue
        
        # Deterministic area and perimeter using Shoelace Formula
        poly_area = shoelace_formula(coords)
        perimeter = calculate_perimeter(coords)
        
        # In a 2D floorplan, the "area" of the wall polygon is the footprint.
        # The surface area for insulation is Perimeter * Height / 2 (for one side) or Perimeter * Height for both.
        # However, for insulation we usually care about the surface area of one face.
        # We'll use the perimeter-based approach for wall length.
        length_in = perimeter / 2.0 
        area_sq_ft = (length_in / 12.0) * (wall_height_inches / 12.0)
        
        wall_context.append({
            "wallIndex": idx, 
            "lengthInches": round(length_in, 2),
            "approxAreaSqFt": round(area_sq_ft, 2)
        })
        
        audit_map[idx] = AuditMetadata(
            vertices=coords,
            formula=get_audit_expansion(coords),
            result=round(area_sq_ft, 2),
            units="sq ft"
        )
    
    user_content = json.dumps({
        "blueprint_notes": [n.get('text') for n in notes] if notes else [],
        "blueprint_text": [t.get('text') for t in text[:50]] if text else [],
        "geometry": {"wallHeightInches": wall_height_inches},
        "walls": wall_context
    })

    if not api_key:
        logging.warning("GROQ_API_KEY no available AI vision/language engine. Outputting deterministic defaults.")
        return _fallback_response(wall_context, audit_map)

    try:
        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.0
            },
            timeout=45.0
        )
        response.raise_for_status()
        data = response.json()
        result_json = data["choices"][0]["message"]["content"]
        
        parsed = json.loads(result_json)
        
        # Ensure all integer fields are actually integers (LLM may return floats)
        if "materials" in parsed:
            parsed["materials"]["drywallPanelsTotal"] = int(parsed["materials"].get("drywallPanelsTotal", 0))
            parsed["materials"]["studsTotal"] = int(parsed["materials"].get("studsTotal", 0))
        
        for detail in parsed.get("perWallDetails", []):
            detail["studs"] = int(detail.get("studs", 0))
            detail["drywallPanels"] = round(detail.get("drywallPanels", 0.0), 2)
        
        # Re-attach audit metadata
        for detail in parsed.get("perWallDetails", []):
            idx = detail.get("wallIndex")
            if idx in audit_map:
                detail["audit"] = audit_map[idx].model_dump()
                
        return ProcessingOutput(**parsed)
        
    except Exception as e:
        logging.error(f"Failed to calculate AI material takeoff: {e}")
        return _fallback_response(wall_context, audit_map)

def _fallback_response(wall_context, audit_map) -> ProcessingOutput:
    details = []
    total_studs = 0
    total_drywall = 0.0
    
    for wc in wall_context:
        idx = wc["wallIndex"]
        studs = int(wc["lengthInches"] / 16.0) + 1
        drywall = wc["approxAreaSqFt"] / 32.0
        
        details.append(WallMaterialData(
            wallIndex=idx,
            classification="unknown",
            lengthInches=wc["lengthInches"],
            surfaceAreaSqFt=wc["approxAreaSqFt"],
            drywallPanels=round(drywall, 2),
            studs=studs,
            insulationRValue="Unknown",
            notes="Fallback estimation",
            audit=audit_map.get(idx)
        ))
        total_studs += studs
        total_drywall += drywall
        
    return ProcessingOutput(
        insulation=InsulationSpec(
            type="Not Detected",
            rValueExterior="Unknown",
            rValueInterior="Unknown",
            description="Fallback mode due to unreachable AI."
        ),
        materials=Material(
            drywallPanelsTotal=int(total_drywall * 1.1),
            studsTotal=int(total_studs * 1.1),
            paintGallonsTotal=0.0,
            wasteFactor=0.1
        ),
        perWallDetails=details
    )

