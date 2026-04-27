import sys
import json
import base64
import numpy as np
import cv2
import fitz  # PyMuPDF
import os

# NumPy 2.0 compatibility: np.product was deprecated and removed, use np.prod instead
if not hasattr(np, 'product'):
    np.product = np.prod

# Import our new modular ingestion script
from ingestion.raster_parser import extract_contours_from_image

def extract_from_image(cv_img, page_num):
    # Delegate to the newly integrated OpenCV module
    return extract_contours_from_image(cv_img, page_num)

def process_file(file_path):
    lines = []
    paths = []
    text = []
    dimensions = []
    notes = []
    annotations = []

    ext = os.path.splitext(file_path)[1].lower()
    
    if ext in ['.png', '.jpg', '.jpeg', '.tiff', '.tif']:
        # Process purely as an image
        cv_img = cv2.imread(file_path)
        if cv_img is not None:
            img_paths = extract_from_image(cv_img, 0)
            paths.extend(img_paths)
    else:
        # Process as PDF
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Extract Vector Lines and Paths
            drawings = page.get_drawings()
            for d in drawings:
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
            
            # Extract Text, Notes, Dimensions
            text_instances = page.get_text("dict")["blocks"]
            for block in text_instances:
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
                                
            # Extract Annotations
            for annot in page.annots():
                annotations.append({
                    "type": annot.type[1],
                    "rect": list(annot.rect),
                    "page": page_num,
                    "content": annot.info.get("content", "")
                })
                
            # OpenCV for Scanned Images within PDF
            images = page.get_images(full=True)
            for img_index, img in enumerate(images):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                nparr = np.frombuffer(image_bytes, np.uint8)
                cv_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if cv_img is not None:
                    img_paths = extract_from_image(cv_img, page_num)
                    paths.extend(img_paths)

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
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
        
    try:
        res = process_file(sys.argv[1])
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)