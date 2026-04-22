import re
import logging
from collections import Counter
import math

def detect_scale_from_text(text_blocks):
    """
    Search for scale annotations in OCR text/notes.
    Returns the scale multiplier (document units to standardized real-world units, e.g., inches).
    Assuming document units are standard PDF points (1/72 inch).
    """
    # Imperial: "1/4" = 1'-0"", "1/8 in = 1 ft", "SCALE 1/4\"=1'0\""
    imperial_pattern = re.compile(
        r'(\d+)\s*/\s*(\d+)\s*(?:"|in|inch|inches|' + "'" + r')\s*(?:=|-)\s*(\d+)\s*(?:\'|ft|foot|feet|’)(?:\s*(?:-|and)?\s*(\d+)\s*(?:"|in|inch|inches|' + "'" + r'))?',
        re.IGNORECASE
    )
    
    # Alternate imperial: "1" = 20'" (1 inch = 20 feet)
    imperial_alt_pattern = re.compile(
        r'(\d+)\s*(?:"|in|inch|inches|' + "'" + r')\s*(?:=|-)\s*(\d+)\s*(?:\'|ft|foot|feet|’)',
        re.IGNORECASE
    )

    # Metric matching: "SCALE 1:100"
    metric_pattern = re.compile(
        r'scale\s*1\s*:\s*(\d+)',
        re.IGNORECASE
    )
    # Just ratio: "1:100" with word boundaries
    ratio_pattern = re.compile(
        r'\b1\s*:\s*(\d{2,})\b'
    )
    
    for block in text_blocks:
        text_content = block.get('text', '').replace('\n', ' ').strip()
        
        # Check imperial (fractional)
        match = imperial_pattern.search(text_content)
        if match:
            num = float(match.group(1))
            den = float(match.group(2))
            ft = float(match.group(3))
            inches = float(match.group(4)) if match.group(4) else 0.0
            
            paper_inches = num / den
            real_inches = (ft * 12.0) + inches
            
            # PDF is 72 points per inch. So paper_inches * 72 = paper points.
            multiplier = real_inches / (paper_inches * 72.0)
            logging.info(f"Detected Imperial Scale: {text_content} -> multiplier: {multiplier}")
            return multiplier, "imperial", text_content

        # Check imperial alternate (whole inches)
        match_alt = imperial_alt_pattern.search(text_content)
        if match_alt:
            paper_inches = float(match_alt.group(1))
            real_ft = float(match_alt.group(2))
            real_inches = real_ft * 12.0
            
            multiplier = real_inches / (paper_inches * 72.0)
            logging.info(f"Detected Alt Imperial Scale: {text_content} -> multiplier: {multiplier}")
            return multiplier, "imperial", text_content

        # Check metric
        match_metric = metric_pattern.search(text_content) or ratio_pattern.search(text_content)
        if match_metric:
            ratio = float(match_metric.group(1))
            # 1 doc point (1/72 in = 0.352778 mm) equals 'ratio' doc points in reality.
            # Wait, 1:100 means 1 point on paper = 100 points in reality.
            # So 100 points in reality = 100/72 inches = 1.3888 inches.
            multiplier = ratio / 72.0
            logging.info(f"Detected Metric Scale: {text_content} -> ratio 1:{ratio}, multiplier: {multiplier}")
            return multiplier, "metric", text_content
            
    return None, None, None

def estimate_scale_from_doors(segments):
    """
    Fallback mechanism: Look at segment lengths to estimate door widths.
    Standard interior door width is ~36 inches (3 ft, ~0.9m).
    We find line lengths that repeat often and assume the typical 
    "door opening" lines represent a standard 36-inch length.
    """
    if not segments:
        return None
        
    lengths = []
    # Collect segment distances and round them to cluster similar lengths
    for seg in segments:
        coords = list(seg.coords)
        if len(coords) >= 2:
            p1, p2 = coords[0], coords[1]
            dist = math.hypot(p2[0]-p1[0], p2[1]-p1[1])
            # Filter extremely small segments (noise)
            if dist > 2.0:
                # Round to 1 decimal place to group effectively
                lengths.append(round(dist, 1))
                
    if not lengths:
        return None
        
    # Get the most common length occurrences.
    # Exclude the absolutely largest lengths (usually long walls)
    lengths.sort()
    
    # Take mid-percentile range lengths (doors usually are neither the shortest noise nor longest walls)
    mid_idx_start = int(len(lengths) * 0.1)
    mid_idx_end = int(len(lengths) * 0.9)
    mid_lengths = lengths[mid_idx_start:mid_idx_end]
    
    if not mid_lengths:
         return None
         
    # Find mode of lengths using a simple binning mechanism
    c = Counter(mid_lengths)
    # The most common segment length that is significant is likely our standard door leaf length or hallway span
    most_common_doc_units = c.most_common(1)[0][0]
    
    # 36 real-world inches / most_common_doc_units = the conversion multiplier
    if most_common_doc_units > 0:
         multiplier = 36.0 / most_common_doc_units
         logging.info(f"Fallback Scale (Door Estimator): Estimated 36in = {most_common_doc_units} doc units -> multiplier: {multiplier}")
         return multiplier
    return None

def get_scale_multiplier(data):
    """
    Determine the scale ratio from priority:
    1. Manual scale override
    2. OCR Extracted Text or Notes
    3. Fallback: Geometry-based door width estimation (assuming standard 36" doors)
    4. General Fallback (1:1)
    """
    # 1. Manual string vs explicit float
    manual_scale = data.get("manualScale") or data.get("manual_scale")
    if manual_scale:
        try:
            val = float(manual_scale)
            return val, "manual", "Manual input float"
        except ValueError:
            # Maybe they typed '1/4" = 1\''
            val, unit, txt = detect_scale_from_text([{"text": str(manual_scale)}])
            if val:
                return val, unit, txt
           
    # 2. Extract from parsed text
    texts = data.get("text", []) + data.get("notes", [])
    multiplier, unit_system, matched_text = detect_scale_from_text(texts)
    if multiplier:
        return multiplier, unit_system, matched_text
        
    # 3. Fallback: estimate from doors / geometry lengths
    segments = data.get("segments", [])
    if segments:
        door_multiplier = estimate_scale_from_doors(segments)
        if door_multiplier:
            return door_multiplier, "estimated", "Fallback: Door ~36in (0.9m)"
            
    # 4. Final fallback
    return 1.0, "unknown", "Fallback 1:1"
