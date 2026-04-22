from shapely.geometry import LineString

from scripts.scale.scale_detection import get_scale_multiplier
from scripts.extract_geometry import extract_geometry
from scripts.material_logic.insulation_logic import get_ai_material_takeoff


def test_scale_detection_known_ratio():
    multiplier, unit, _ = get_scale_multiplier({
        "text": [{"text": 'SCALE 1:100'}],
        "notes": [],
        "segments": [],
    })
    assert unit == "metric"
    assert abs(multiplier - (100.0 / 72.0)) < 0.01


def test_geometry_simple_rectangle():
    data = {
        "lines": [
            {"p1": [0, 0], "p2": [100, 0]},
            {"p1": [100, 0], "p2": [100, 80]},
            {"p1": [100, 80], "p2": [0, 80]},
            {"p1": [0, 80], "p2": [0, 0]},
        ],
        "paths": [],
        "text": [],
        "dimensions": [],
        "notes": [],
        "annotations": [],
        "settings": {"wallThickness": 6.0},
    }
    result = extract_geometry(data)
    geometry = result.model_dump() if hasattr(result, "model_dump") else result
    assert len(geometry.get("walls", [])) >= 1
    assert len(geometry.get("rooms", [])) >= 1


def test_insulation_logic_geometry_driven():
    walls = [{"polygon": [(0, 0), (10, 0), (10, 1), (0, 1), (0, 0)]}]
    result = get_ai_material_takeoff(
        walls=walls,
        rooms=[],
        notes=[],
        text=[],
        wall_surface_sq_ft=100.0,
        floor_ceiling_sq_ft=50.0,
        volume_cu_ft=300.0,
        wall_height_inches=120.0,
    )
    assert result.materials.drywallPanelsTotal >= 0
