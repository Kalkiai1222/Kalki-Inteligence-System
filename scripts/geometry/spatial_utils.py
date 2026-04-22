import math
from typing import List, Tuple

def shoelace_formula(vertices: List[Tuple[float, float]]) -> float:
    """
    Computes the area of a polygon using the Shoelace Formula (Surveyor's Formula).
    Returns the absolute area.
    """
    n = len(vertices)
    if n < 3:
        return 0.0
    
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += vertices[i][0] * vertices[j][1]
        area -= vertices[j][0] * vertices[i][1]
    
    return abs(area) / 2.0

def get_audit_expansion(vertices: List[Tuple[float, float]]) -> str:
    """
    Generates a string expansion of the Shoelace Formula for Visual Audit.
    Format: 0.5 * |(x1*y2 - x2*y1) + (x2*y3 - x3*y2) + ...|
    """
    n = len(vertices)
    if n < 3:
        return "Insufficient vertices for area calculation."
    
    terms = []
    for i in range(n):
        j = (i + 1) % n
        x1, y1 = vertices[i]
        x2, y2 = vertices[j]
        terms.append(f"({x1:.1f}*{y2:.1f} - {x2:.1f}*{y1:.1f})")
    
    formula = "0.5 * |" + " + ".join(terms) + "|"
    return formula

def calculate_perimeter(vertices: List[Tuple[float, float]]) -> float:
    """
    Computes the perimeter length of a polygon.
    """
    n = len(vertices)
    if n < 2:
        return 0.0
    
    perimeter = 0.0
    for i in range(n):
        j = (i + 1) % n
        perimeter += math.hypot(vertices[j][0] - vertices[i][0], vertices[j][1] - vertices[i][1])
    
    return perimeter
