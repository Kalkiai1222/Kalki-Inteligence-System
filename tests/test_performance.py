import time
import tracemalloc

from scripts.generate_3d import process_3d


def test_performance_small_pipeline_budget():
    payload = {
        "walls": [
            {"polygon": [(0, 0), (100, 0), (100, 4), (0, 4), (0, 0)]},
            {"polygon": [(0, 50), (100, 50), (100, 54), (0, 54), (0, 50)]},
        ],
        "rooms": [],
        "notes": [],
        "text": [],
        "settings": {"wallHeightInches": 120.0},
    }

    tracemalloc.start()
    started = time.time()
    result = process_3d(payload)
    elapsed = time.time() - started
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    assert result["status"] in ("success", "quality_failed")
    assert elapsed < 120
    assert peak < 2 * 1024 * 1024 * 1024
