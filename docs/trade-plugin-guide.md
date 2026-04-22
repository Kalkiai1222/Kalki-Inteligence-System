# Trade Plugin Guide

## Goal

Add a new trade calculator without breaking geometry-first flow.

## Required Interfaces

- Extend geometry-derived takeoff logic in `scripts/material_logic/`.
- Accept validated geometry payload (`walls`, `rooms`, mesh-derived metrics), not raw 2D only.
- Return schema-compatible output from `scripts/schemas/v1/models.py`.

## Registration

1. Add plugin module in `scripts/material_logic/{trade}_logic.py`.
2. Wire plugin invocation in `scripts/generate_3d.py` after mesh quality passes.
3. Persist result in Prisma linked to `BlueprintVersion`.
4. Expose in dashboard via version endpoint.

## Worked Example: HVAC Duct Meters

- Input: validated room volumes and path network from geometry.
- Compute duct linear meters from room adjacency graph.
- Emit line items with:
  - `geometry_entity_id`
  - `source_note`
  - `confidence`
  - `reasoning`
- Add export row in `ExportReportsMenu` and `/api/jobs/{id}/exports`.
