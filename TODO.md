# TRIBE v2 Project TODO List

## Phase 1: Infrastructure & Foundation (✅ COMPLETED)
- [x] Initialize Next.js Dashboard with Three.js (React Three Fiber).
- [x] Setup Python Backend with FastAPI.
- [x] Define API schemas for Video Processing and Neural Inference.
- [x] Establish Design System with Seedtag branding.

## Phase 2: Core Engine Development (✅ COMPLETED)
- [x] **Step 2.1: Video Frame Extraction** — OpenCV, tensor 224x224.
- [x] **Step 2.2: Inference Wrapper** — deterministic inference loop.
- [x] **Step 2.3: Neural-to-Text Analysis** — Gemini via `google-genai`, deterministic fallback.

## Phase 3: Dashboard & Visualization (✅ COMPLETED)
- [x] **Step 3.1: 3D Voxel Heatmaps** — BrainViewer con activación dinámica.
- [x] **Step 3.2: Video-Neural Sync** — VideoCortex con timeline markers.
- [x] **Step 3.3: Creative Insight Panels** — charts adaptativos, neural logs.

## Phase 4: Integration & Automation (✅ COMPLETED)
- [x] **Step 4.1: Frontend-Backend Handshake** — Next.js → FastAPI.
- [x] **Step 4.2: Automated PDF Reporting** — export con Hybrid Review decisions.

## Phase 5: Quality Assurance (💎 BRAVURA)
- [x] **Step 5.1: End-to-End Testing** — smoke test + full browser flow + PDF QA.
- [x] **Step 5.2: Human Gate con Timeline Markers**
    - Markers de color en la barra de progreso del video (rojo=low attention, ámbar=high load).
    - Click en marker → salta al segundo exacto.
    - Panel compacto: prev/next, check/flag, info del frame activo.
    - Overlay expandido: video + panel de revisión lado a lado.
    - Engine Status real en sidebar (reemplaza Pro Engine fake).
- [x] **Step 5.3: Production QA Rules**
    - OCR real (Tesseract/pytesseract) para spelling/grammar.
    - QR real (pyzbar/zbar).
    - Safe zones con OpenCV (márgenes CTV 10%/5%).
    - CTA detection con edge analysis en último 30% del video.
    - Logo detection con análisis de esquinas.
- [x] **Step 5.4: Runtime Maintenance**
    - Gemini migrado a `google-genai`.
    - Requirements compatibles con Python 3.14.
    - Limpieza `tmp/diagnostics` TTL 24h (startup + background task + endpoint DELETE /cleanup).
    - npm audit: Next.js 14.2.3 → 14.2.35 (elimina critical CVEs).

## Phase 6: En curso / Pendiente

### Completados esta fase
- [x] **Step 6.5: Simplificar UX de upload en VideoCortex**
    - 3 botones colapsados en 1 botón progresivo: Select Creative → Run Diagnostic → Analyzing… → New Creative.
    - Upload ocurre internamente dentro de `analyzeCreative`, invisible para el usuario.
    - `hideControls` prop elimina botones en el overlay del Human Gate Review.
- [x] **Step 6.6: Frame sampling adaptativo**
    - Cap automático de 60 frames en `VideoProcessor.extract_frames` — reduce fps si el video es largo.
    - Sin cambios de API ni UI: completamente transparente.
- [x] **Step 6.7: Modos de análisis (Quick / Standard / Deep)**
    - UI ya implementada: selector en el sidebar con 3 perfiles (1/2/3 fps).
    - Backend: `frame_rate: float` en schema, `_request_frames_dir` con path float-safe, clip `max(0.1, ...)`.
    - El adaptive cap de 6.6 aplica sobre el fps elegido.

### Pendientes
- [ ] **Step 6.1: BrainViewer Anatómico**
    - Reemplazar esfera de partículas por forma matemática de cerebro.
    - Zonas activas en posición anatómica: frontal adelante, visual atrás, temporal lateral.
    - Las activaciones por región ya llegan al componente.
- [ ] **Step 6.2: Markers en PDF**
    - Incluir decisiones OK/Flag y notas del Human Gate en el PDF exportado.
    - Agregar sección "Frame Review" en `createDiagnosticPdf` en `page.tsx`.
- [ ] **Step 6.3: Auth en la API**
    - Middleware FastAPI con API key en header.
    - Necesario antes de exponer en cualquier red.
- [ ] **Step 6.4: Next.js 15/16 migration**
    - 5 vulnerabilidades restantes en npm audit.
    - Riesgo bajo en localhost. Migración mayor, scope separado.
- [ ] **Step 6.8: Acceso rápido "New Creative" desde sidebar**
    - Mostrar botón "New Creative" en el sidebar cuando hay un resultado activo.
    - Evita que el usuario tenga que scrollear hasta el player para resetear.
- [ ] **Step 6.9: Historial de diagnósticos (vista de carpetas)**
    - Backend: persistir `DiagnosticResult` en JSON/SQLite por `request_id` al finalizar análisis.
    - Nuevo endpoint `GET /diagnostics` que lista los resultados guardados.
    - Vista en dashboard: lista con fecha, nombre de archivo, attention score, decisión final.
    - Click en resultado → carga el diagnóstico sin re-analizar.
    - Filtros básicos: por fecha, score, decisión (Approved/Revisions).
