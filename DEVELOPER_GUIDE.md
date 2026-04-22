# ConstructionAI - Technical Architecture & Developer Guide

## 1. System Overview
ConstructionAI is a production-grade SaaS platform designed to automate the conversion of 2D construction blueprints into 3D models (OBJ, STEP, OpenUSD) and intelligent material takeoffs. 

The system leverages a hybrid architecture:
- **Next.js (TypeScript)**: Handles user authentication, team/job management, file uploads, 2D/3D visualization, and API orchestration.
- **Python Data Pipeline**: A sophisticated, modular compute engine that performs computer vision, geometry extraction, scale detection, 3D reconstruction, and Large Language Model (LLM) powered material analysis.

---

## 2. Architecture & Data Flow

### Data Flow Lifecycle
1. **Ingestion (Upload)**: User uploads a blueprint (PDF/DXF/Image) via the Next.js web interface.
2. **Preprocessing (OpenCV)**: The Python pipeline (`raster_parser.py`) consumes the raster image, applying grayscale conversion, adaptive thresholding, Canny edge detection, morphology, and Hough Lines extraction.
3. **Scale & Vectorization**: `scale_detection.py` extracts metric/imperial scales using OCR regex and algorithmic fallbacks. `extract_geometry.py` utilizes `Shapely` to form structured 2D polygons from the cleaned line data.
4. **3D Reconstruction**: `generate_3d.py` extrudes the 2D floorplan into 3D meshes using `Trimesh` and creates ISO-compliant Boundary Representations via `CadQuery`. `usd_export.py` generates an OpenUSD ASCII representation.
5. **AI Material Takeoff**: `insulation_logic.py` feeds deterministic wall geometry into an LLM (Groq - LLaMA 3.3 70B) constrained by `Pydantic` schemas (`models.py`) to derive materials (studs, drywall, insulation, paint, waste factors).
6. **Delivery**: The synthesized JSON containing the 3D string payloads (STEP, OBJ, USD) and the AI Takeoff is returned to the Next.js API, stored, and rendered in the user's browser.

---

## 3. Module Descriptions

### 3.1 Next.js Fullstack (TypeScript)
- `src/app/api/*`: RESTful endpoints handling Auth (JWT), Companies, Jobs, Users, and Uploads.
- `src/components/*`: Reusable UI components including `Blueprint2DViewer` and `Blueprint3DViewer`.
- `src/lib/prisma.ts`: Database ORM interaction (Postgres/SQLite).
- `src/lib/email.ts`: SMTP email delivery for invites and password resets.

### 3.2 Python Compute Engine (`/scripts`)
- **`ingestion/raster_parser.py`**: OpenCV vision pipeline for de-noising scanned blueprints.
- **`geometry/extract_geometry.py` & `raster_extraction.py`**: Uses Shapely to build clean 2D vectors and polygons.
- **`scale/scale_detection.py`**: Intelligent scale detection supporting imperial/metric and geometric mode estimation.
- **`reconstruction/usd_export.py`**: Lightweight, dependency-free OpenUSD (`.usda`) ASCII generator.
- **`material_logic/insulation_logic.py`**: Dynamic VLM/LLM inference adapter for construction logic.
- **`generate_3d.py`**: Orchestrator for mapping 2D to 3D outputs (Trimesh / CadQuery).
- **`models.py`**: Pydantic models ensuring strict JSON contracts across boundaries.

---

## 4. API Structure

### Core Endpoints
- `POST /api/auth/login`: Issue JWT.
- `POST /api/upload`: Handles multipart form data for blueprints. Triggers the Python pipeline asynchronously.
- `GET /api/companies` | `POST /api/companies`: Tenant management.
- `GET /api/jobs`: Fetches job statuses and takeoff links.

---

## 5. Development & Contribution Guide
- **Environment**: Define `.env` variables (e.g., `DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY`, `SMTP_*`).
- **Python**: Ensure `.venv` is strictly maintained. Core dependencies: `opencv-python`, `trimesh`, `shapely`, `cadquery`, `groq`, `pydantic`.
- **Database**: Run `npx prisma db push` or `prisma migrate dev` for schema changes.

---

## 6. Future Expansion (Phase 2)
The platform is built modularly to support the following immediate enhancements:
1. **Cloud-Native Workers**: Offload the Python `/scripts` pipeline to AWS Batch or serverless containers (Lambda/Fargate) to allow massive parallel processing and decouple CPU-heavy extraction from the Next.js API.
2. **Revit & Advanced BIM**: Expand the STEP/USD output with full IFC (Industry Foundation Classes) metadata mapping.
3. **Plumbing & Electrical (MEP)**: Train specialized OpenCV models to detect MEP symbols and route 3D piping/wiring dynamically.
4. **Live Cost Estimation**: Direct API integrations to regional material pricing databases for real-time `$$$` takeoff estimates dynamically injected into the Pydantic schema return.