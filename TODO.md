# TRIBE v2 Project TODO List

## Phase 1: Infrastructure & Foundation (✅ COMPLETED)
- [x] Initialize Next.js Dashboard with Three.js (React Three Fiber).
- [x] Setup Python Backend with FastAPI.
- [x] Define API schemas for Video Processing and Neural Inference.
- [x] Establish Design System with Seedtag branding.

## Phase 2: Core Engine Development (✅ COMPLETED)
- [x] **Step 2.1: Video Frame Extraction**
    - Implemented `processors/video.py` with OpenCV frame extraction and tensor normalization.
- [x] **Step 2.2: Inference Wrapper**
    - Setup deterministic TRIBE v2 inference loop in `models/inference.py`.
- [x] **Step 2.3: Neural-to-Text Analysis**
    - Migrated Gemini from deprecated `google.generativeai` to `google.genai` (commit `bbc65c2`).
    - Deterministic fallback active when no API key is present.

## Phase 3: Dashboard & Visualization (✅ COMPLETED)
- [x] **Step 3.1: 3D Voxel Heatmaps**
    - Enhanced `BrainViewer` to show dynamic neural activation.
- [x] **Step 3.2: Video-Neural Sync**
    - Implemented playback synchronization with `VideoCortex`.
- [x] **Step 3.3: Creative Insight Panels**
    - Built adaptive charts and live neural logs.

## Phase 4: Integration & Automation (✅ COMPLETED)
- [x] **Step 4.1: Frontend-Backend Handshake**
    - Connected the Next.js UI to FastAPI `/upload` and `/analyze`.
- [x] **Step 4.2: Automated PDF Reporting**
    - Implemented PDF export for creative diagnostics, including human Hybrid Review decisions.

## Phase 5: Quality Assurance (💎 BRAVURA)
- [x] **Step 5.1: End-to-End Testing**
    - Backend smoke test passed.
    - Full browser/UI run passed: upload → diagnostic → hybrid review → PDF export.
    - PDF visual QA passed: Human Hybrid Review paginates cleanly.
- [ ] **Step 5.2: BrainViewer — Forma Anatómica**
    - Reemplazar esfera de partículas por forma de cerebro matemática.
    - Reflejar activaciones por región (frontal, visual, temporal) en zonas anatómicas correctas.
    - Las activaciones ya llegan al componente; solo falta la forma.
- [ ] **Step 5.3: Production QA Rules**
    - Add OCR/object detection for spelling, CTA, logo, QR and safe-zone checks.
    - Today these are deterministic visual heuristics.
- [ ] **Step 5.4: Runtime Maintenance**
    - Define cleanup policy for `tmp/diagnostics` (TTL or manual purge).
    - Add auth/token to API endpoints before any network exposure.
    - Review `npm audit` vulnerabilities before running `npm audit fix`.
