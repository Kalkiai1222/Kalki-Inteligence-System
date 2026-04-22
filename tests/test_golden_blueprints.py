import os
import fitz
import numpy as np
import cv2

from scripts.process_blueprint import process_file
from scripts.extract_geometry import extract_geometry
from scripts.generate_3d import process_3d


def _create_vector_pdf(path: str):
    doc = fitz.open()
    page = doc.new_page(width=600, height=400)
    page.draw_rect(fitz.Rect(100, 100, 500, 300), color=(0, 0, 0), width=2)
    page.insert_text((110, 95), 'SCALE 1:100')
    doc.save(path)
    doc.close()


def _create_raster_pdf(path: str):
    img = np.ones((600, 800, 3), dtype=np.uint8) * 255
    cv2.rectangle(img, (150, 150), (650, 450), (0, 0, 0), 3)
    image_path = path.replace('.pdf', '.png')
    cv2.imwrite(image_path, img)
    doc = fitz.open()
    page = doc.new_page(width=800, height=600)
    page.insert_image(fitz.Rect(0, 0, 800, 600), filename=image_path)
    doc.save(path)
    doc.close()
    os.remove(image_path)


def _run_pipeline(pdf_path: str):
    ingest = process_file(pdf_path)
    assert ingest["status"] == "success"
    geom = extract_geometry(ingest["data"])
    geom_data = geom.model_dump() if hasattr(geom, "model_dump") else geom
    recon = process_3d({
        "walls": geom_data.get("walls", []),
        "rooms": geom_data.get("rooms", []),
        "notes": ingest["data"].get("notes", []),
        "text": ingest["data"].get("text", []),
        "settings": geom_data.get("settingsUsed", {}),
    })
    return ingest, geom_data, recon


def test_vector_blueprint_pipeline(tmp_path):
    pdf_path = str(tmp_path / "vector_blueprint.pdf")
    _create_vector_pdf(pdf_path)
    ingest, geom, recon = _run_pipeline(pdf_path)

    assert len(ingest["data"]["paths"]) >= 1
    assert "walls" in geom
    assert "rooms" in geom
    assert recon["status"] in ("success", "quality_failed")
    if recon["status"] == "success":
        assert "obj" in recon and "step" in recon


def test_raster_blueprint_pipeline(tmp_path):
    pdf_path = str(tmp_path / "raster_blueprint.pdf")
    _create_raster_pdf(pdf_path)
    ingest, geom, recon = _run_pipeline(pdf_path)

    assert len(ingest["data"]["paths"]) >= 1
    assert "walls" in geom
    assert "rooms" in geom
    assert recon["status"] in ("success", "quality_failed")
