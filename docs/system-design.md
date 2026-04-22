# System Design

## Pipeline

```mermaid
flowchart LR
  A[Upload Blueprint] --> B[Ingestion: process_blueprint.py]
  B --> C[Scale + Geometry: extract_geometry.py]
  C --> D[Mesh Quality: generate_3d.py checks/repair]
  D --> E[Reconstruction: OBJ/STEP/USD]
  E --> F[Takeoff: insulation_logic.py]
  F --> G[Persist DB: Prisma]
  G --> H[Dashboard + Review APIs]
  H --> I[Corrections + Vector Memory]
```

## Data Contracts

- Python schemas: `scripts/schemas/v1/models.py`
- API schemas: `src/lib/pipeline-schemas.ts`
- Schema endpoint: `GET /api/schema/{stage}`

## Extension Points

- Add stage in `pipeline/main.py` between validated handoff models.
- Add new export format in `scripts/generate_3d.py` and persist via `ExportArtifact`.
- Add route-level stage status transitions through `JobStatusEvent`.

## Dependency Graph

- Ingestion depends on `PyMuPDF`, `OpenCV`.
- Geometry depends on `Shapely`, `NetworkX`, scale module.
- Reconstruction depends on `trimesh`, `cadquery`, USD writer.
- Memory depends on `FAISS` and sentence embedding model.
- API persistence depends on Prisma + SQLite.
