from typing import List, Tuple, Dict, Any, Optional
from pydantic import BaseModel, Field

class AuditMetadata(BaseModel):
    vertices: List[Tuple[float, float]]
    formula: str
    result: float
    units: str

class Wall(BaseModel):
    # A wall can be a list of 2D coordinates representing the polygon of the wall's footprint
    polygon: List[Tuple[float, float]]
    audit: Optional[AuditMetadata] = None

class ScaleInfo(BaseModel):
    multiplier: float
    unitSystem: str
    detectedText: str

class SettingsUsed(BaseModel):
    wallThicknessInches: float
    minRoomAreaSqFt: float

class Room(BaseModel):
    areaSqFt: float
    perimeterInches: float
    vertices: int
    polygon: List[Tuple[float, float]]
    classification: str
    signature: str
    confidence: Optional[float] = None
    audit: Optional[AuditMetadata] = None

class GeometryData(BaseModel):
    walls: List[Wall]  # Strongly typed Wall models
    rooms: List[Room]
    openings: List[Dict[str, Any]]
    zones: List[Dict[str, Any]]
    scale: ScaleInfo
    settingsUsed: SettingsUsed

class WallMaterialData(BaseModel):
    wallIndex: int
    classification: str
    lengthInches: float
    surfaceAreaSqFt: float
    drywallPanels: float
    studs: int
    insulationRValue: str
    notes: str
    audit: Optional[AuditMetadata] = None

class InsulationSpec(BaseModel):
    type: str
    rValueExterior: str
    rValueInterior: str
    description: str

class Material(BaseModel):
    drywallPanelsTotal: int
    studsTotal: int
    paintGallonsTotal: float
    wasteFactor: float

class ProcessingOutput(BaseModel):
    insulation: InsulationSpec
    materials: Material
    perWallDetails: List[WallMaterialData]

