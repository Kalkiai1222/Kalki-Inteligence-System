# Simulation Handoff Spec

## Thermal Engine Inputs

- Envelope face area (from mesh face aggregation)
- Insulation type and R-value (from takeoff per-wall details)
- Layer thickness (from settings or wall assumptions)
- Material density placeholders for phase-2 enrichment

## Structural Engine Inputs

- Wall polygons and heights
- Room volumes
- Opening/zones collections
- Mesh quality flags (`watertight`, non-manifold counts)

## Field Provenance

- Geometry from `extract_geometry.py`
- Quality report from `generate_3d.py`
- Material semantics from `material_logic/insulation_logic.py`
- Reasoning/corrections from `ReasoningTrace` + `ReasoningCorrection`

## Assumptions

- Default wall height 120 inches unless overridden.
- Orthogonal wall joins are assumed where plan is ambiguous.
- Scale defaults to 1:1 if no trusted evidence exists.

## Known Limits (Phase-2 targets)

- Opening detection remains basic.
- No full IFC semantic classes yet.
- USD scene lacks full physically-based material graph.
