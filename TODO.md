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

### Pendientes (orden recomendado)

#### Bloque 1 — Identidad y UX (bajo riesgo, alto impacto visible)
- [x] **Step 6.10: Renombrar a NeuralSeed**
    - Cambiar "TRIBE v2" → "NeuralSeed" en título, sidebar, metadata y PDF export.
- [x] **Step 6.11: Analysis Depth integrado en el flujo de upload**
    - Mostrar selector Quick/Standard/Deep inline debajo del video al seleccionar un archivo.
    - Reemplaza el selector del sidebar — el usuario elige la profundidad en contexto.
- [x] **Step 6.8: Acceso rápido "New Creative" desde sidebar**
    - Mostrar botón "New Creative" en el sidebar cuando hay un resultado activo.

#### Bloque 2 — Análisis por formato Seedtag (fundacional para análisis correcto)
- [x] **Step 6.14: Format-aware analysis (Frame / Standard / Bespoke)**
    - Selector de formato en la UI antes de "Run Diagnostic": [Frame] [Standard Video] [Bespoke Video].
    - **Frame**: analizar solo el área exterior del branded frame (excluir video del cliente). Área cliente detectada: ~x=501-939, y=38-818 en canvas 1920x1080 (9:16 vertical central). Recomendaciones accionables por Seedtag.
    - **Standard**: detectar bordes negros (pillarbox/letterbox) con OpenCV, recortar al área activa antes de CLIP. Análisis informativo — Seedtag no puede editar el creative.
    - **Bespoke**: analizar frame completo. Todo es accionable — Seedtag crea el creative de cero.
    - Adaptar QA checks y recomendaciones según formato: safe zones, CTA, logo varían por tipo.
    - Videos de referencia analizados: Frame 1-3, Standard 1-2, Bespoke en `Videos examples/`.

#### Bloque 3 — Features de valor (completan el producto)
- [ ] **Step 6.2: Markers en PDF**
    - Incluir decisiones OK/Flag y notas del Human Gate en el PDF exportado.
    - Agregar sección "Frame Review" en `createDiagnosticPdf` en `page.tsx`.
- [ ] **Step 6.9: Historial de diagnósticos (vista de carpetas)**
    - Backend: persistir `DiagnosticResult` en JSON/SQLite por `request_id` al finalizar análisis.
    - Nuevo endpoint `GET /diagnostics` que lista los resultados guardados.
    - Vista en dashboard: lista con fecha, nombre de archivo, attention score, decisión final.
    - Click en resultado → carga el diagnóstico sin re-analizar.

#### Bloque 4 — Visual (impacto estético, complejidad alta)
- [ ] **Step 6.1: BrainViewer Anatómico**
    - Reemplazar esfera de partículas por forma matemática de cerebro.
    - Zonas activas en posición anatómica: frontal adelante, visual atrás, temporal lateral.

#### Bloque 5 — Lifecycle y motor
- [x] **Step 6.12: Integrar modelo de visión real (CLIP)**
    - Reemplazar `TribeInferenceEngine` mock por `open_clip` (ViT-B/32 o similar).
    - Los scores de atención, sensory_load y region_activations pasarían a ser predicciones reales basadas en embeddings visuales.
    - Pipeline ya construido — solo cambia el módulo de inferencia en `core_engine/models/inference.py`.
    - Dependencias: `open-clip-torch`, `torch` (CPU suficiente para análisis de frames estáticos).
- [ ] **Step 6.13: Lifecycle completo del creative**
    - Modo "Benchmark": comparar un nuevo creative contra históricos del mismo anunciante/categoría.
    - Modo "A/B": analizar dos videos en paralelo y generar reporte comparativo.
    - Modo "Post-campaña": importar métricas reales (viewability, CTR) y cruzarlas con los scores predichos para calibrar el modelo.
    - Base: requiere historial de diagnósticos (6.9) y motor real (6.12).

#### Bloque 6 — Seguridad e infraestructura (antes de cualquier deploy)
- [ ] **Step 6.3: Auth en la API**
    - Middleware FastAPI con API key en header.
    - Necesario antes de exponer en cualquier red.
- [ ] **Step 6.4: Next.js 15/16 migration**
    - 5 vulnerabilidades restantes en npm audit.
    - Migración mayor — hacer en rama separada.
