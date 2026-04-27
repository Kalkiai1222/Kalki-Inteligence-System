import sys
import json
import base64
import numpy as np
import cv2
import fitz  # PyMuPDF
import os
import traceback
import logging

# Setup logging to stderr so Node.js can capture it
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s [process_blueprint]: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# NumPy 2.0 compatibility: np.product was deprecated and removed, use np.prod instead
if not hasattr(np, 'product'):
    np.product = np.prod

logger.info(f'Python version: {sys.version}')
logger.info(f'Working directory: {os.getcwd()}')
logger.info(f'Starting process_blueprint.py with args: {sys.argv}')

# Import our new modular ingestion script
try:
    from ingestion.raster_parser import extract_contours_from_image
    logger.info('Successfully imported extract_contours_from_image')
except ImportError as e:
    logger.error(f'Failed to import ingestion.raster_parser: {e}')
    logger.error(traceback.format_exc())
    raise

def extract_from_image(cv_img, page_num):
    # Delegate to the newly integrated OpenCV module
    return extract_contours_from_image(cv_img, page_num)

def process_file(file_path):
    """
    Process blueprint file (PDF or image) and extract geometric data.
    Raises detailed exceptions for each stage of processing.
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
        # Process purely as an image
        logger.info(f'Processing as image file: {ext}')
        try:
            cv_img = cv2.imread(file_path)
            if cv_img is None:
                raise ValueError(f"cv2.imread failed to load image: {file_path}. File may be corrupted.")
            logger.info(f'Image loaded: shape={cv_img.shape}')
            h, w = cv_img.shape[:2]
            
            # Downscale excessively large images to prevent OOM
            MAX_DIM = 4000
            if max(h, w) > MAX_DIM:
                scale = MAX_DIM / max(h, w)
                new_w, new_h = int(w * scale), int(h * scale)
                cv_img = cv2.resize(cv_img, (new_w, new_h), interpolation=cv2.INTER_AREA)
                logger.info(f'Resized large image from {w}x{h} to {new_w}x{new_h}')
            
            img_paths = extract_from_image(cv_img, 0)
            
            # Cap the number of paths extracted
            MAX_PATHS_PER_IMAGE = 5000
            if len(img_paths) > MAX_PATHS_PER_IMAGE:
                logger.warning(f'Capping extracted paths from {len(img_paths)} to {MAX_PATHS_PER_IMAGE}')
                img_paths = img_paths[:MAX_PATHS_PER_IMAGE]
                
            paths.extend(img_paths)
            logger.info(f'Extracted {len(img_paths)} paths from image')
        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            raise RuntimeError(f"Failed to process image: {str(e)}")
    else:
        # Process as PDF
        logger.info(f'Processing as PDF')
        try:
            doc = fitz.open(file_path)
            logger.info(f'PDF opened successfully with {len(doc)} pages')
        except Exception as e:
            logger.error(f"Failed to open PDF: {e}")
            raise RuntimeError(f"Failed to open PDF file: {str(e)}")
        
        try:
            for page_num in range(len(doc)):
                logger.debug(f'Processing page {page_num + 1}/{len(doc)}')
                try:
                    page = doc[page_num]
                    
                    # Extract Vector Lines and Paths
                    try:
                        drawings = page.get_drawings()
                        for d in drawings:
                            try:
                                for item in d["items"]:
                                    if item[0] == "l":  # Line
                                        lines.append({
                                            "p1": [item[1].x, item[1].y],
                                            "p2": [item[2].x, item[2].y],
                                            "page": page_num
                                        })
                                    elif item[0] in ["re", "qu", "c"]:  # Path/Rect/Quad/Curve
                                        paths.append({
                                            "type": item[0],
                                            "page": page_num
                                        })
                            except Exception as draw_err:
                                logger.warning(f"Error processing drawing item on page {page_num}: {draw_err}")
                                continue
                    except Exception as draw_err:
                        logger.warning(f"Error extracting drawings from page {page_num}: {draw_err}")
                    
                    # Extract Text, Notes, Dimensions
                    try:
                        text_instances = page.get_text("dict")["blocks"]
                        for block in text_instances:
                            try:
                                if block["type"] == 0:  # Text block
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
                                                dimensions.append(data_obj)
                                            elif "NOTE:" in t.upper():
                                                notes.append(data_obj)
                                            else:
                                                text.append(data_obj)
                            except Exception as text_err:
                                logger.warning(f"Error processing text block on page {page_num}: {text_err}")
                                continue
                    except Exception as text_err:
                        logger.warning(f"Error extracting text from page {page_num}: {text_err}")
                    
                    # Extract Annotations
                    try:
                        annot_list = page.annots()
                        if annot_list:
                            for annot in annot_list:
                                try:
                                    annotations.append({
                                        "type": annot.type[1],
                                        "rect": list(annot.rect),
                                        "page": page_num,
                                        "content": annot.info.get("content", "")
                                    })
                                except Exception as annot_err:
                                    logger.warning(f"Error processing annotation on page {page_num}: {annot_err}")
                                    continue
                    except Exception as annot_err:
                        logger.warning(f"Error extracting annotations from page {page_num}: {annot_err}")
                    
                    # OpenCV for Scanned Images within PDF
                    try:
                        images = page.get_images(full=True)
                        if images:
                            logger.debug(f'Found {len(images)} images on page {page_num}')
                            for img_index, img in enumerate(images):
                                try:
                                    xref = img[0]
                                    base_image = doc.extract_image(xref)
                                    image_bytes = base_image["image"]
                                    nparr = np.frombuffer(image_bytes, np.uint8)
                                    cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                                    
                                    if cv_img is not None:
                                        h, w = cv_img.shape[:2]
                                        
                                        # Skip tiny images (e.g. logos, icons, artifacts)
                                        if h < 500 and w < 500:
                                            logger.debug(f'Skipping small embedded image {img_index} ({w}x{h}) on page {page_num}')
                                            continue
                                            
                                        # Downscale excessively large images to prevent OOM
                                        MAX_DIM = 4000
                                        if max(h, w) > MAX_DIM:
                                            scale = MAX_DIM / max(h, w)
                                            new_w, new_h = int(w * scale), int(h * scale)
                                            cv_img = cv2.resize(cv_img, (new_w, new_h), interpolation=cv2.INTER_AREA)
                                            logger.debug(f'Resized large embedded image {img_index} from {w}x{h} to {new_w}x{new_h}')

                                        img_paths = extract_from_image(cv_img, page_num)
                                        
                                        # Cap the number of paths extracted from a single image to prevent JSON bloat
                                        MAX_PATHS_PER_IMAGE = 5000
                                        if len(img_paths) > MAX_PATHS_PER_IMAGE:
                                            logger.warning(f'Capping extracted paths for image {img_index} from {len(img_paths)} to {MAX_PATHS_PER_IMAGE}')
                                            img_paths = img_paths[:MAX_PATHS_PER_IMAGE]
                                            
                                        paths.extend(img_paths)
                                        logger.debug(f'Extracted {len(img_paths)} paths from embedded image {img_index}')
                                    else:
                                        logger.warning(f"Failed to decode embedded image {img_index} on page {page_num}")
                                except Exception as img_err:
                                    logger.warning(f"Error processing embedded image {img_index} on page {page_num}: {img_err}")
                                    continue
                    except Exception as img_err:
                        logger.warning(f"Error extracting images from page {page_num}: {img_err}")
                
                except Exception as page_err:
                    logger.error(f"Error processing page {page_num}: {page_err}")
                    raise RuntimeError(f"Failed to process page {page_num}: {str(page_err)}")
        finally:
            try:
                doc.close()
            except:
                pass

    logger.info(f'Extraction complete: {len(lines)} lines, {len(paths)} paths, {len(text)} texts, {len(dimensions)} dimensions, {len(notes)} notes, {len(annotations)} annotations')
    
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

if __name__ == "__main__":
    try:
        # Verify command-line arguments
        if len(sys.argv) < 2:
            error_msg = "No file path provided"
            logger.error(error_msg)
            error_output = {
                "error": error_msg,
                "stage": "INGESTION",
                "type": "UsageError"
            }
            print(json.dumps(error_output))
            sys.exit(1)
        
        file_path = sys.argv[1]
        logger.info(f'Starting ingestion for file: {file_path}')
        logger.info(f'Python version: {sys.version}')
        logger.info(f'Working directory: {os.getcwd()}')
        logger.info(f'Current PATH: {os.environ.get("PATH", "NOT SET")}')
        
        # Validate file exists
        if not os.path.exists(file_path):
            error_msg = f"File not found: {file_path}"
            logger.error(error_msg)
            error_output = {
                "error": error_msg,
                "stage": "INGESTION",
                "type": "FileNotFoundError",
                "file_path": file_path,
                "exists": False
            }
            print(json.dumps(error_output))
            sys.exit(1)
        
        # Validate file is readable
        if not os.access(file_path, os.R_OK):
            error_msg = f"File is not readable: {file_path}"
            logger.error(error_msg)
            error_output = {
                "error": error_msg,
                "stage": "INGESTION",
                "type": "PermissionError",
                "file_path": file_path
            }
            print(json.dumps(error_output))
            sys.exit(1)
        
        file_size = os.path.getsize(file_path)
        logger.info(f'File size: {file_size} bytes')
        logger.info(f'File readable: {os.access(file_path, os.R_OK)}')
        logger.info(f'File is_file: {os.path.isfile(file_path)}')
        
        # Process the file
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
        error_output = {
            "error": error_msg,
            "type": "ImportError",
            "traceback": traceback.format_exc(),
            "stage": "INGESTION"
        }
        print(json.dumps(error_output))
        sys.exit(1)
        
    except RuntimeError as e:
        error_msg = f"Runtime error: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        error_output = {
            "error": error_msg,
            "type": "RuntimeError",
            "traceback": traceback.format_exc(),
            "stage": "INGESTION"
        }
        print(json.dumps(error_output))
        sys.exit(1)
        
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        error_output = {
            "error": error_msg,
            "type": type(e).__name__,
            "traceback": traceback.format_exc(),
            "stage": "INGESTION"
        }
        print(json.dumps(error_output))
        sys.exit(1)