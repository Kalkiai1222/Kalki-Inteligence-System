import cv2
import numpy as np

def extract_contours_from_image(cv_img, page_num):
    """
    OpenCV pipeline for scanned/raster blueprints.
    Features: Grayscale, Adaptive Thresholding, Canny Edge Detection, Morphological operations, Contour detection.
    """
    # 1. Grayscale
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    
    # 2. Denoise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # 3. Adaptive Thresholding
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )
    
    # 4. Canny Edge Detection
    edges = cv2.Canny(thresh, 50, 150, apertureSize=3)
    
    # 5. Morphological operations to close gaps in lines
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # 6. Extract Straight Lines via Hough Transform
    lines = cv2.HoughLinesP(closed, rho=1, theta=np.pi/180, threshold=50, minLineLength=30, maxLineGap=10)
    
    extracted_paths = []
    
    # Store detected Hough lines
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            extracted_paths.append({
                "type": "scanned_line",
                "points": [[int(x1), int(y1)], [int(x2), int(y2)]],
                "page": page_num
            })
            
    # 7. Contour Detection (for complex polygons/shapes)
    contours, hierarchy = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > 100:  # Filter noise
            # Approximate the contour to get a cleaner polygon
            epsilon = 0.01 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            
            # Store normalized path data
            extracted_paths.append({
                "type": "scanned_contour",
                "bbox": cv2.boundingRect(approx), # (x, y, w, h)
                "points": approx.reshape(-1, 2).tolist(), # Array of [x, y]
                "page": page_num
            })
            
    return extracted_paths
