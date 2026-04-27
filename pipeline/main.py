import sys
import os
import json
import logging
import uuid
import traceback
from typing import Any, Dict, List
from pydantic import BaseModel, ValidationError

# NumPy 2.0 compatibility patch (before any imports that might use numpy)
import numpy as np
if not hasattr(np, 'product'):
    np.product = np.prod

# Map the "scripts" folder to python path so we can import modules natively
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts")))

# Direct Python module imports
from process_blueprint import process_file
from extract_geometry import extract_geometry
from generate_3d import process_3d

# Configure structured logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: [%(module)s] %(message)s")


class PipelineHandoffError(Exception):
    """Raised when stage handoff payload validation fails."""


class IngestionHandoffPayload(BaseModel):
    lines: List[Dict[str, Any]] = []
    paths: List[Dict[str, Any]] = []
    text: List[Dict[str, Any]] = []
    dimensions: List[Dict[str, Any]] = []
    notes: List[Dict[str, Any]] = []
    annotations: List[Dict[str, Any]] = []

def run_pipeline(blueprint_path: str):
    """
    Central Pipeline Orchestrator for Phase 1 Engine
    Connects existing separate modules via direct imports.
    """
    pipeline_id = str(uuid.uuid4())
    company_id = "default_company" # Extract from settings if needed
    logging.info(f"Starting Project KALKI Pipeline engine for: {blueprint_path}")
    
    # -------------------------------------------------------------
    # Step 1 & 2: Ingestion Module (Extract Raw Lines, Paths, Text)
    # -------------------------------------------------------------
    logging.info("Running Ingestion Module natively...")
    
    try:
        ingest_out = process_file(blueprint_path)
    except Exception as e:
        logging.error(f"Ingestion failed: {e}")
        logging.error(traceback.format_exc())
        raise ValueError(f"Ingestion Module Error: {e}\n{traceback.format_exc()}")
        
    if "error" in ingest_out:
         raise ValueError(f"Ingestion error: {ingest_out['error']}")
         
    raw_data = ingest_out.get("data", {})
    try:
        validated_handoff = IngestionHandoffPayload.model_validate(raw_data)
    except ValidationError as exc:
        raise PipelineHandoffError(f"Ingestion -> geometry payload validation failed: {exc}") from exc
    
    # Hold reference to textual notes and dimensions to cross-reference later
    notes = raw_data.get("notes", [])
    text = raw_data.get("text", [])
    logging.info(f"Ingestion Complete: Extracted {len(raw_data.get('paths', []))} vector paths, {len(text)} texts, {len(notes)} notes.")

    # -------------------------------------------------------------
    # Step 3 & 4: Geometry & Scale Detection Module
    # -------------------------------------------------------------
    logging.info("Running Geometry and Scale Detection Module natively...")
    
    try:
        # Pass validated ingestion payload to geometry stage.
        geom_output = extract_geometry(validated_handoff.model_dump(), company_id=company_id)
        # Handle dict or Pydantic output
        if hasattr(geom_output, "model_dump"):
            geom_data = geom_output.model_dump()
        elif hasattr(geom_output, "dict") and callable(getattr(geom_output, "dict", None)):
            geom_data = geom_output.dict()
        else:
            geom_data = geom_output
    except Exception as e:
        logging.error(f"Geometry Extraction failed: {e}")
        logging.error(traceback.format_exc())
        raise ValueError(f"Geometry Module Error: {e}\n{traceback.format_exc()}")

    if "error" in geom_data:
        raise ValueError(f"Geometry error: {geom_data['error']}")
        
    scale_info = geom_data.get("scale", {})
    logging.info(f"Geometry Complete: {len(geom_data.get('walls', []))} walls, {len(geom_data.get('rooms', []))} rooms detected. Scale factor: {scale_info.get('multiplier')}")

    # -------------------------------------------------------------
    # Step 5 & 6: 3D Reconstruction & Material Logic
    # -------------------------------------------------------------
    logging.info("Running 3D Reconstruction and Material logic natively...")
    
    # Construct combined payload mapping geometry + original parsed notes
    reconstruction_payload = {
        "walls": geom_data.get("walls", []),
        "rooms": geom_data.get("rooms", []),
        "notes": notes,
        "text": text,
        "settings": geom_data.get("settingsUsed", {})
    }
    
    try:
        td_data = process_3d(reconstruction_payload)
    except Exception as e:
        logging.error(f"3D Reconstruction failed: {e}")
        logging.error(traceback.format_exc())
        raise ValueError(f"Reconstruction Module Error: {e}\n{traceback.format_exc()}")

    if "error" in td_data:
        raise ValueError(f"3D Reconstruction error: {td_data['error']}")
    
    takeoff = td_data.get("takeoff", {})
    obj_string = td_data.get("obj", "")
    step_string = td_data.get("step", "")
    usd_string = td_data.get("usd", "") # Integrated OpenUSD export support
    
    # Write models to disk
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "uploads", "models"))
    os.makedirs(output_dir, exist_ok=True)
    
    obj_path = os.path.join(output_dir, f"{pipeline_id}-model.obj")
    if obj_string:
        with open(obj_path, "w") as f:
            f.write(obj_string)
    else:
        obj_path = None
            
    step_path = os.path.join(output_dir, f"{pipeline_id}-model.step")
    if step_string:
        with open(step_path, "w") as f:
            f.write(step_string)
            
    usd_path = os.path.join(output_dir, f"{pipeline_id}-model.usd")
    if usd_string:
        with open(usd_path, "w") as f:
            f.write(usd_string)
            
    if obj_path or usd_path:
        logging.info(f"Reconstruction Complete: Models saved to {output_dir}.")

    # -------------------------------------------------------------
    # Step 7: Output Final Structured JSON 
    # -------------------------------------------------------------
    final_output = {
        "geometry": geom_data.get("walls", []),
        "scale": scale_info,
        "model_paths": {
            "obj": obj_path,
            "step": step_path,
            "usd": usd_path
        },
        "takeoff": takeoff
    }
    
    return final_output

if __name__ == "__main__":
    import traceback
    
    if len(sys.argv) < 2:
        error_output = {
            "error": "Usage: python main.py <path_to_blueprint_pdf>",
            "stage": "INITIALIZATION",
            "type": "UsageError",
            "traceback": ""
        }
        print(json.dumps(error_output))
        sys.exit(1)
        
    blueprint = sys.argv[1]
    if not os.path.exists(blueprint):
        error_output = {
            "error": f"File not found: {blueprint}",
            "stage": "INITIALIZATION",
            "type": "FileNotFoundError",
            "file_path": blueprint,
            "traceback": f"File does not exist at path: {blueprint}"
        }
        print(json.dumps(error_output))
        sys.exit(1)
        
    try:
        # Final output format precisely as requested
        result = run_pipeline(blueprint)
        print(json.dumps(result, indent=2))
        sys.exit(0)
    except PipelineHandoffError as e:
        error_output = {
            "error": str(e),
            "stage": "HANDOFF_VALIDATION",
            "type": "PipelineHandoffError",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_output), file=sys.stderr)
        print(json.dumps(error_output))
        sys.exit(1)
    except ValueError as e:
        # ValueError is raised by run_pipeline for specific stage errors
        error_msg = str(e)
        stage = "UNKNOWN"
        if "Ingestion" in error_msg:
            stage = "PIPELINE_STAGE_INGESTION_FAILED"
        elif "Geometry" in error_msg:
            stage = "PIPELINE_STAGE_GEOMETRY_FAILED"
        elif "Reconstruction" in error_msg or "3D" in error_msg:
            stage = "PIPELINE_STAGE_3D_FAILED"
        
        error_output = {
            "error": error_msg,
            "stage": stage,
            "type": "ValueError",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_output), file=sys.stderr)
        print(json.dumps(error_output))
        sys.exit(1)
    except Exception as e:
        # Catch all other exceptions
        error_output = {
            "error": f"Unexpected pipeline error: {str(e)}",
            "stage": "PIPELINE_EXECUTION",
            "type": type(e).__name__,
            "traceback": traceback.format_exc(),
            "blueprint_path": blueprint
        }
        print(json.dumps(error_output), file=sys.stderr)
        print(json.dumps(error_output))
        sys.exit(1)
