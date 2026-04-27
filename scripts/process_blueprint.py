import sys
import json
import numpy as np
import cv2
import fitz  # PyMuPDF
import os
import gc
import time
import traceback
import logging

# ──────────────────────────────────────────────────────────────────────
# CONFIGURATION — tune these for your container's RAM / CPU budget
# ──────────────────────────────────────────────────────────────────────
MAX_PATHS_PER_IMAGE = 1000        # hard cap per single embedded image
MAX_TOTAL_PATHS_PER_PAGE = 5000   # hard cap across ALL images on one page
MAX_IMAGE_DIM = 2000              # downscale any axis beyond this
MIN_IMAGE_DIM = 300               # skip images smaller than this (logos, icons)
PAGE_TIME_BUDGET_SEC = 60         # skip remaining images on a page after this
MAX_IMAGES_PER_PAGE = 12          # skip excess images on extremely dense pages
MAX_VECTOR_DRAWINGS_PER_PAGE = 50000  # skip vector extraction if page is insanely dense
MAX_LINES_PER_PAGE = 15000        # limit raw 'l' lines to prevent JSON bloat
MAX_TOTAL_LINES = 75000           # limit total lines across entire document

# ──────────────────────────────────────────────────────────────────────
# LOGGING
# ──────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s [process_blueprint]: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# NumPy 2.0 compatibility
if not hasattr(np, 'product'):
    np.product = np.prod

logger.info(f'Python version: {sys.version}')
logger.info(f'Working directory: {os.getcwd()}')
logger.info(f'Starting process_blueprint.py with args: {sys.argv}')

# Import raster parser
try:
    from ingestion.raster_parser import extract_contours_from_image
    logger.info('Successfully imported extract_contours_from_image')
except ImportError as e:
    logger.error(f'Failed to import ingestion.raster_parser: {e}')
    logger.error(traceback.format_exc())
    raise


def extract_from_image(cv_img, page_num):
    """Delegate to the OpenCV Hough-line module."""
    return extract_contours_from_image(cv_img, page_num)


# ──────────────────────────────────────────────────────────────────────
# PAGE-LEVEL PROCESSOR  (streaming — one page at a time, then free)
# ──────────────────────────────────────────────────────────────────────
def _process_pdf_page(doc, page_num, total_pages, global_line_count):
    """
    Process a single PDF page. Returns (lines, paths, text, dimensions,
    notes, annotations) for that page.  Never raises — returns partial
    results on any internal error.
    """
    page_lines = []
    page_paths = []
    page_text = []
    page_dimensions = []
    page_notes = []
    page_annotations = []

    page_start = time.monotonic()
    logger.info(f'START_PAGE {page_num + 1}/{total_pages}')

    try:
        page = doc[page_num]
    except Exception as e:
        logger.error(f'ERROR_CAPTURED page={page_num} stage=open err={e}')
        return page_lines, page_paths, page_text, page_dimensions, page_notes, page_annotations

    # ── 1. Vector Lines & Paths ──────────────────────────────────────
    try:
        drawings = page.get_drawings()
        if len(drawings) > MAX_VECTOR_DRAWINGS_PER_PAGE:
            logger.warning(
                f'LIMIT_APPLIED page={page_num} vector_drawings={len(drawings)} '
                f'cap={MAX_VECTOR_DRAWINGS_PER_PAGE} — truncating'
            )
            drawings = drawings[:MAX_VECTOR_DRAWINGS_PER_PAGE]

        for d in drawings:
            # Stop if we've hit per-page or global limits
            if len(page_lines) >= MAX_LINES_PER_PAGE or global_line_count >= MAX_TOTAL_LINES:
                break
                
            try:
                for item in d["items"]:
                    if item[0] == "l":
                        if len(page_lines) < MAX_LINES_PER_PAGE and global_line_count < MAX_TOTAL_LINES:
                            page_lines.append({
                                "p1": [item[1].x, item[1].y],
                                "p2": [item[2].x, item[2].y],
                                "page": page_num
                            })
                            global_line_count += 1
                    elif item[0] in ("re", "qu", "c"):
                        page_paths.append({
                            "type": item[0],
                            "page": page_num
                        })
            except Exception as draw_err:
                logger.warning(f'ERROR_CAPTURED page={page_num} stage=drawing_item err={draw_err}')
                continue
    except Exception as draw_err:
        logger.warning(f'ERROR_CAPTURED page={page_num} stage=get_drawings err={draw_err}')

    # ── 2. Text / Notes / Dimensions ─────────────────────────────────
    try:
        text_instances = page.get_text("dict")["blocks"]
        for block in text_instances:
            try:
                if block["type"] == 0:
                    for line in block["lines"]:
                        for span in line["spans"]:
                            t = span["text"].strip()
                            if not t:
                                continue
                            bbox = list(span["bbox"])
                            data_obj = {
                                "text": t,
                                "bbox": bbox,
                                "page": page_num,
                                "size": span["size"],
                                "font": span["font"]
                            }
                            if any(c.isdigit() for c in t) and ("'" in t or '"' in t or "mm" in t or "cm" in t):
                                page_dimensions.append(data_obj)
                            elif "NOTE:" in t.upper():
                                page_notes.append(data_obj)
                            else:
                                page_text.append(data_obj)
            except Exception as text_err:
                logger.warning(f'ERROR_CAPTURED page={page_num} stage=text_block err={text_err}')
                continue
    except Exception as text_err:
        logger.warning(f'ERROR_CAPTURED page={page_num} stage=get_text err={text_err}')

    # ── 3. Annotations ───────────────────────────────────────────────
    try:
        annot_list = page.annots()
        if annot_list:
            for annot in annot_list:
                try:
                    page_annotations.append({
                        "type": annot.type[1],
                        "rect": list(annot.rect),
                        "page": page_num,
                        "content": annot.info.get("content", "")
                    })
                except Exception as annot_err:
                    logger.warning(f'ERROR_CAPTURED page={page_num} stage=annotation err={annot_err}')
                    continue
    except Exception as annot_err:
        logger.warning(f'ERROR_CAPTURED page={page_num} stage=get_annots err={annot_err}')

    # ── 4. Embedded Images → Hough Lines ─────────────────────────────
    page_image_paths_count = 0
    try:
        images = page.get_images(full=True)
        if images:
            image_count = len(images)
            if image_count > MAX_IMAGES_PER_PAGE:
                logger.warning(
                    f'LIMIT_APPLIED page={page_num} images={image_count} '
                    f'cap={MAX_IMAGES_PER_PAGE} — processing first {MAX_IMAGES_PER_PAGE} only'
                )
                images = images[:MAX_IMAGES_PER_PAGE]

            logger.debug(f'Found {len(images)} processable images on page {page_num}')

            for img_index, img in enumerate(images):
                # Time budget check
                elapsed = time.monotonic() - page_start
                if elapsed > PAGE_TIME_BUDGET_SEC:
                    logger.warning(
                        f'SKIPPED_IMAGE page={page_num} img={img_index} '
                        f'reason=page_time_budget_exceeded ({elapsed:.1f}s > {PAGE_TIME_BUDGET_SEC}s)'
                    )
                    break

                # Per-page paths cap check
                if page_image_paths_count >= MAX_TOTAL_PATHS_PER_PAGE:
                    logger.warning(
                        f'SKIPPED_IMAGE page={page_num} img={img_index} '
                        f'reason=page_paths_cap_reached ({page_image_paths_count})'
                    )
                    break

                try:
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    nparr = np.frombuffer(image_bytes, np.uint8)
                    cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                    # Free raw bytes immediately
                    del image_bytes, nparr

                    if cv_img is None:
                        logger.warning(f'SKIPPED_IMAGE page={page_num} img={img_index} reason=decode_failed')
                        continue

                    h, w = cv_img.shape[:2]

                    # Skip tiny images (logos, icons, line-art artifacts)
                    if h < MIN_IMAGE_DIM and w < MIN_IMAGE_DIM:
                        logger.debug(
                            f'SKIPPED_IMAGE page={page_num} img={img_index} '
                            f'reason=too_small ({w}x{h})'
                        )
                        del cv_img
                        continue

                    # Downscale oversized images
                    if max(h, w) > MAX_IMAGE_DIM:
                        scale_factor = MAX_IMAGE_DIM / max(h, w)
                        new_w, new_h = int(w * scale_factor), int(h * scale_factor)
                        cv_img = cv2.resize(cv_img, (new_w, new_h), interpolation=cv2.INTER_AREA)
                        logger.debug(
                            f'Resized embedded image {img_index} from {w}x{h} to {new_w}x{new_h} on page {page_num}'
                        )

                    # Extract Hough lines
                    img_paths = extract_from_image(cv_img, page_num)
                    del cv_img  # free OpenCV image immediately

                    # Per-image cap
                    if len(img_paths) > MAX_PATHS_PER_IMAGE:
                        logger.warning(
                            f'LIMIT_APPLIED page={page_num} img={img_index} '
                            f'paths={len(img_paths)} cap={MAX_PATHS_PER_IMAGE}'
                        )
                        img_paths = img_paths[:MAX_PATHS_PER_IMAGE]

                    # Per-page cap (remaining budget)
                    remaining_budget = MAX_TOTAL_PATHS_PER_PAGE - page_image_paths_count
                    if len(img_paths) > remaining_budget:
                        logger.warning(
                            f'LIMIT_APPLIED page={page_num} img={img_index} '
                            f'paths={len(img_paths)} trimmed_to={remaining_budget} (page budget)'
                        )
                        img_paths = img_paths[:remaining_budget]

                    page_paths.extend(img_paths)
                    page_image_paths_count += len(img_paths)
                    logger.debug(f'Extracted {len(img_paths)} paths from embedded image {img_index} on page {page_num}')

                except Exception as img_err:
                    logger.warning(
                        f'ERROR_CAPTURED page={page_num} img={img_index} '
                        f'stage=image_processing err={img_err}'
                    )
                    continue

    except Exception as img_err:
        logger.warning(f'ERROR_CAPTURED page={page_num} stage=get_images err={img_err}')

    elapsed = time.monotonic() - page_start
    logger.info(
        f'END_PAGE {page_num + 1}/{total_pages} '
        f'lines={len(page_lines)} (global={global_line_count}) paths={len(page_paths)} text={len(page_text)} '
        f'dims={len(page_dimensions)} notes={len(page_notes)} annots={len(page_annotations)} '
        f'elapsed={elapsed:.2f}s'
    )

    return page_lines, page_paths, page_text, page_dimensions, page_notes, page_annotations, global_line_count


# ──────────────────────────────────────────────────────────────────────
# MAIN FILE PROCESSOR
# ──────────────────────────────────────────────────────────────────────
def process_file(file_path):
    """
    Process blueprint file (PDF or image) and extract geometric data.
    Output schema is identical to original — consumed by 2D, 3D, and takeoff.
    Never crashes. Returns partial results on degraded processing.
    """
    lines = []
    paths = []
    text = []
    dimensions = []
    notes = []
    annotations = []

    ext = os.path.splitext(file_path)[1].lower()
    logger.info(f'File extension: {ext}')

    if ext in ['.png', '.jpg', '.jpeg', '.tiff', '.tif']:
        # ── Standalone image processing ──────────────────────────────
        logger.info(f'Processing as image file: {ext}')
        try:
            cv_img = cv2.imread(file_path)
            if cv_img is None:
                raise ValueError(f"cv2.imread failed to load image: {file_path}. File may be corrupted.")
            logger.info(f'Image loaded: shape={cv_img.shape}')
            h, w = cv_img.shape[:2]

            if max(h, w) > MAX_IMAGE_DIM:
                scale_factor = MAX_IMAGE_DIM / max(h, w)
                new_w, new_h = int(w * scale_factor), int(h * scale_factor)
                cv_img = cv2.resize(cv_img, (new_w, new_h), interpolation=cv2.INTER_AREA)
                logger.info(f'Resized large image from {w}x{h} to {new_w}x{new_h}')

            img_paths = extract_from_image(cv_img, 0)
            del cv_img
            gc.collect()

            if len(img_paths) > MAX_PATHS_PER_IMAGE:
                logger.warning(f'LIMIT_APPLIED image paths={len(img_paths)} cap={MAX_PATHS_PER_IMAGE}')
                img_paths = img_paths[:MAX_PATHS_PER_IMAGE]

            paths.extend(img_paths)
            logger.info(f'Extracted {len(img_paths)} paths from image')
        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            raise RuntimeError(f"Failed to process image: {str(e)}")
    else:
        # ── PDF processing (page-by-page streaming) ──────────────────
        logger.info('Processing as PDF')
        try:
            doc = fitz.open(file_path)
            logger.info(f'PDF opened successfully with {len(doc)} pages')
        except Exception as e:
            logger.error(f"Failed to open PDF: {e}")
            raise RuntimeError(f"Failed to open PDF file: {str(e)}")

        total_pages = len(doc)
        global_line_count = 0
        try:
            for page_num in range(total_pages):
                try:
                    pl, pp, pt, pd, pn, pa, global_line_count = _process_pdf_page(doc, page_num, total_pages, global_line_count)
                    lines.extend(pl)
                    paths.extend(pp)
                    text.extend(pt)
                    dimensions.extend(pd)
                    notes.extend(pn)
                    annotations.extend(pa)

                    # Free page-level temporaries and force garbage collection
                    del pl, pp, pt, pd, pn, pa
                    gc.collect()

                except Exception as page_err:
                    # Page-level fault isolation — NEVER crash the pipeline
                    logger.error(
                        f'ERROR_CAPTURED page={page_num} stage=page_level '
                        f'err={page_err}\n{traceback.format_exc()}'
                    )
                    # Continue to next page
                    continue
        finally:
            try:
                doc.close()
            except Exception:
                pass
            gc.collect()

    logger.info(
        f'Extraction complete: {len(lines)} lines, {len(paths)} paths, '
        f'{len(text)} texts, {len(dimensions)} dimensions, '
        f'{len(notes)} notes, {len(annotations)} annotations'
    )

    return {
        "status": "success",
        "data": {
            "lines": lines,
            "paths": paths,
            "text": text,
            "dimensions": dimensions,
            "notes": notes,
            "annotations": annotations
        }
    }


# ──────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        if len(sys.argv) < 2:
            error_msg = "No file path provided"
            logger.error(error_msg)
            print(json.dumps({"error": error_msg, "stage": "INGESTION", "type": "UsageError"}))
            sys.exit(1)

        file_path = sys.argv[1]
        logger.info(f'Starting ingestion for file: {file_path}')
        logger.info(f'Python version: {sys.version}')
        logger.info(f'Working directory: {os.getcwd()}')
        logger.info(f'Current PATH: {os.environ.get("PATH", "NOT SET")}')

        if not os.path.exists(file_path):
            error_msg = f"File not found: {file_path}"
            logger.error(error_msg)
            print(json.dumps({"error": error_msg, "stage": "INGESTION", "type": "FileNotFoundError", "file_path": file_path, "exists": False}))
            sys.exit(1)

        if not os.access(file_path, os.R_OK):
            error_msg = f"File is not readable: {file_path}"
            logger.error(error_msg)
            print(json.dumps({"error": error_msg, "stage": "INGESTION", "type": "PermissionError", "file_path": file_path}))
            sys.exit(1)

        file_size = os.path.getsize(file_path)
        logger.info(f'File size: {file_size} bytes')
        logger.info(f'File readable: {os.access(file_path, os.R_OK)}')
        logger.info(f'File is_file: {os.path.isfile(file_path)}')

        logger.info('Beginning file processing')
        res = process_file(file_path)
        logger.info('process_file completed successfully')
        logger.info(f'Extracted: {len(res["data"]["lines"])} lines, {len(res["data"]["paths"])} paths, {len(res["data"]["text"])} texts')
        print(json.dumps(res))
        sys.exit(0)

    except ImportError as e:
        error_msg = f"Import error: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        print(json.dumps({"error": error_msg, "type": "ImportError", "traceback": traceback.format_exc(), "stage": "INGESTION"}))
        sys.exit(1)

    except RuntimeError as e:
        error_msg = f"Runtime error: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        print(json.dumps({"error": error_msg, "type": "RuntimeError", "traceback": traceback.format_exc(), "stage": "INGESTION"}))
        sys.exit(1)

    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        print(json.dumps({"error": error_msg, "type": type(e).__name__, "traceback": traceback.format_exc(), "stage": "INGESTION"}))
        sys.exit(1)