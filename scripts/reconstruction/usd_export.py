import numpy as np
import logging

def generate_usda_from_mesh(vertices, faces, scale_to_meters=0.0254):
    """
    Generates a Basic ASCII OpenUSD (.usda) string from mesh vertices and faces.
    
    Using the ASCII representation ensures future-proof compatibility and 
    avoids heavy compiled dependencies like `usd-core` for basic structural exports.
    By default, sets the scale assuming input vertices are in inches.
    """
    try:
        # Ensure numpy arrays for robust manipulation
        vertices = np.asarray(vertices)
        faces = np.asarray(faces)

        # Build USDA string
        usda_lines = []
        usda_lines.append("#usda 1.0")
        usda_lines.append("(")
        usda_lines.append('    defaultPrim = "Root"')
        usda_lines.append(f'    metersPerUnit = {scale_to_meters}')
        usda_lines.append('    upAxis = "Z"')
        usda_lines.append(")")
        usda_lines.append("")
        usda_lines.append('def Xform "Root"')
        usda_lines.append("{")
        usda_lines.append('    def Mesh "BuildingMesh"')
        usda_lines.append('    {')
        
        # Face vertex counts (trimesh exports mostly triangles, but we dynamically check)
        face_vertex_counts = [len(f) for f in faces]
        fvc_str = ", ".join(map(str, face_vertex_counts))
        usda_lines.append(f'        int[] faceVertexCounts = [{fvc_str}]')
        
        # Face vertex indices flattened
        face_vertex_indices = [idx for f in faces for idx in f]
        fvi_str = ", ".join(map(str, face_vertex_indices))
        usda_lines.append(f'        int[] faceVertexIndices = [{fvi_str}]')
        
        # Points (Vertices)
        points_str = ", ".join([f"({x}, {y}, {z})" for x, y, z in vertices])
        usda_lines.append(f'        point3f[] points = [{points_str}]')
        
        # Bounding Box (Extent)
        if len(vertices) > 0:
            min_pt = np.min(vertices, axis=0)
            max_pt = np.max(vertices, axis=0)
            usda_lines.append(f'        float3[] extent = [({min_pt[0]}, {min_pt[1]}, {min_pt[2]}), ({max_pt[0]}, {max_pt[1]}, {max_pt[2]})]')
        
        usda_lines.append('    }')
        usda_lines.append("}")
        
        return "\n".join(usda_lines)
        
    except Exception as e:
        logging.error(f"Failed to generate USDA structure: {e}")
        return ""