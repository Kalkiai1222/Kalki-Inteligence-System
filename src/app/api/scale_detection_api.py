"""
API endpoint for scale detection and manual override.

Exposes scale detection results and allows manual scale input for instant recalculation.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import Optional
import logging

# Router for scale endpoints
router = APIRouter(prefix="/api", tags=["scale"])


class ScaleDetectionResponse(BaseModel):
    """Response format for scale detection queries"""
    scale: float
    method: str  # "text" | "dimension" | "door_width" | "manual" | "fallback"
    confidence: float  # 0.0 to 1.0
    detected_text: Optional[str] = None
    unit_system: str
    notes: str


class ManualScaleRequest(BaseModel):
    """Request format for manual scale override"""
    scale: float  # The scale value to use
    notes: Optional[str] = None  # Optional notes about why this scale was chosen


@router.get(
    "/companies/{companyId}/projects/{projectId}/blueprints/{versionId}/scale",
    response_model=ScaleDetectionResponse,
    summary="Get detected scale with confidence",
    description="Returns the detected scale, detection method, confidence score, and unit system",
)
async def get_blueprint_scale(
    companyId: str,
    projectId: str,
    versionId: str,
):
    """
    Get the scale detection results for a blueprint.
    
    Returns:
    - scale: The multiplier (e.g., 48.0 for 1/4\"=1'-0\")
    - method: How the scale was detected (text, dimension, door_width, manual, fallback)
    - confidence: Confidence score (0.0-1.0)
    - detected_text: What was matched (e.g., "1/4\"=1'-0\"")
    - unit_system: imperial or metric
    - notes: Explanation of the detection
    
    Example response:
    {
      "scale": 48.0,
      "method": "text",
      "confidence": 0.85,
      "detected_text": "1/4\"=1'-0\"",
      "unit_system": "imperial",
      "notes": "Text-based detection from OCR: 1/4\"=1'-0\""
    }
    """
    try:
        # TODO: Query database or cache to get scale result for this blueprint
        # For now, this is a placeholder showing the expected format
        raise HTTPException(status_code=404, detail="Blueprint not found")
    except Exception as e:
        logging.error(f"Failed to get scale: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve scale")


@router.post(
    "/companies/{companyId}/projects/{projectId}/blueprints/{versionId}/scale/override",
    response_model=ScaleDetectionResponse,
    summary="Override scale with manual input",
    description="Set a manual scale and trigger instant recalculation",
)
async def override_blueprint_scale(
    companyId: str,
    projectId: str,
    versionId: str,
    request: ManualScaleRequest,
):
    """
    Override the scale with manual input and trigger recalculation.
    
    Request body:
    {
      "scale": 48.0,
      "notes": "User confirmed this is 1/4\"=1'-0\""
    }
    
    Returns:
    - Updated ScaleDetectionResponse with method="manual" and confidence=0.99
    - System will recalculate all geometry using this scale
    
    Steps taken:
    1. Validate scale is positive
    2. Store manual scale override in database
    3. Queue geometry recalculation
    4. Return confirmation with new scale and confidence
    
    Example response:
    {
      "scale": 48.0,
      "method": "manual",
      "confidence": 0.99,
      "detected_text": "48.0",
      "unit_system": "imperial",
      "notes": "Manual scale input: 48.0 - User confirmed this is 1/4\"=1'-0\""
    }
    """
    try:
        # Validate input
        if request.scale <= 0:
            raise HTTPException(
                status_code=400,
                detail="Scale must be positive"
            )
        
        # TODO: Implement actual logic
        # 1. Store manual override in database
        # 2. Queue geometry recalculation task
        # 3. Return result with manual method and 99% confidence
        
        logging.info(
            f"Manual scale override: "
            f"company={companyId}, project={projectId}, "
            f"blueprint={versionId}, scale={request.scale}"
        )
        
        # Return placeholder response
        return ScaleDetectionResponse(
            scale=request.scale,
            method="manual",
            confidence=0.99,  # User input = maximum confidence
            detected_text=str(request.scale),
            unit_system="imperial",
            notes=f"Manual scale input: {request.scale}" + (f" - {request.notes}" if request.notes else "")
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {e}")
    except Exception as e:
        logging.error(f"Failed to override scale: {e}")
        raise HTTPException(status_code=500, detail="Failed to override scale")


@router.get(
    "/companies/{companyId}/projects/{projectId}/blueprints/{versionId}/scale/confidence",
    summary="Check scale confidence",
    description="Returns just the confidence score of the current scale",
)
async def get_scale_confidence(
    companyId: str,
    projectId: str,
    versionId: str,
):
    """
    Quick endpoint to check confidence score of the current scale.
    
    Useful for frontend to show warning if confidence is low.
    
    Response:
    {
      "confidence": 0.85,
      "method": "text",
      "warnings": []
    }
    """
    try:
        # TODO: Query database for scale result
        raise HTTPException(status_code=404, detail="Blueprint not found")
    except Exception as e:
        logging.error(f"Failed to get scale confidence: {e}")
        raise HTTPException(status_code=500, detail="Failed to get scale confidence")


# Mount router in main app:
# from fastapi import FastAPI
# app = FastAPI()
# from scale_api import router
# app.include_router(router)
