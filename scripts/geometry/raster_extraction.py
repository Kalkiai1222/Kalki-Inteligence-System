from shapely.geometry import LineString, box
import math

def build_segments_from_raster(raw_paths):
    """
    Converts OpenCV extracted contours ('scanned_contour') and Hough lines ('scanned_line')
    into Shapely geometry segments.
    """
    segments = []
    for path in raw_paths:
        if path.get("type") == "scanned_line":
            points = path.get("points")
            if points and len(points) == 2:
                p1, p2 = tuple(points[0]), tuple(points[1])
                dist = math.hypot(p2[0]-p1[0], p2[1]-p1[1])
                if dist > 5.0:
                    segments.append(LineString([p1, p2]))
                    
        elif path.get("type") == "scanned_contour":
            points = path.get("points")
            if points and len(points) >= 2:
                # Add line segments connecting the points of the contour
                for i in range(len(points) - 1):
                    p1 = tuple(points[i])
                    p2 = tuple(points[i+1])
                    dist = math.hypot(p2[0]-p1[0], p2[1]-p1[1])
                    if dist > 5.0: # filter very short noise segments from OpenCV approximation
                        segments.append(LineString([p1, p2]))
                
                # Close the loop
                p1 = tuple(points[-1])
                p2 = tuple(points[0])
                dist = math.hypot(p2[0]-p1[0], p2[1]-p1[1])
                if dist > 5.0:
                    segments.append(LineString([p1, p2]))
            else:
                # Fallback to bbox if points array is missing
                bbox = path.get("bbox")
                if bbox:
                    x, y, w, h = bbox
                    rect = box(x, y, x+w, y+h)
                    coords = list(rect.exterior.coords)
                    for i in range(len(coords)-1):
                        segments.append(LineString([coords[i], coords[i+1]]))
                        
    return segments