# TRIBE v2 - Handoff / Recovery Point

**Fecha:** 7 de mayo de 2026
**Commit:** `36428d6` (working tree con cambios no commiteados)
**Branch:** `main`
**Estado:** FlipCards en todos los campos del dashboard (QA checks, Hybrid Review, Neural Signals, Markers, StatCards). Guía de usuario descargable en PDF desde sidebar. Markers del Human Gate exportados al PDF de diagnóstico.

---

## Resumen del Estado Actual

TRIBE v2 es una herramienta de diagnóstico creativo para CTV. Flujo completo operativo:

1. Seleccionar video → subir al backend
2. Ejecutar diagnóstico (frame extraction + inference determinista + Gemini opcional)
3. Ver scorecard QA con activaciones neurales
4. **Human Gate** con markers en la timeline del video → revisar frames problemáticos → OK/Flag + nota
5. Confirmar/rechazar Hybrid Review (Brand Voice, Pacing, Transitions)
6. Exportar PDF con métricas, resumen ejecutivo, mapa cortical y diagnóstico frame-by-frame

---

## Commits de esta sesión (en orden)

| Hash | Descripción |
|---|---|
| `131aa78` | Engine Status real en sidebar + umbral de markers ajustado (attn < 75, load >= 0.45) |
| `44d2b57` | Human Gate redesign: timeline markers + overlay expandido de revisión |
| `7fdc62d` | OCR spelling real (Tesseract) + QR real (pyzbar/zbar) + npm security fixes |
| `7a6dc0d` | QA checks reales con OpenCV/pyzbar + política de limpieza tmp/diagnostics |
| `2dc541e` | Recovery point y TODO actualizados |
| `bbc65c2` | Migración Gemini SDK a google-genai, requirements compatibles con Python 3.14 |
| `370b9aa` | Pipeline CTV completo: upload, inference, hybrid review, PDF export |

---

## Archivos Clave

| Archivo | Rol |
|---|---|
| `core_engine/api/routes/diagnostics.py` | Endpoints `/upload`, `/analyze`, `DELETE /cleanup`. QA checks reales (OpenCV, pyzbar, pytesseract). Limpieza TTL 24h. |
| `core_engine/models/inference.py` | Inference determinista sobre features visuales |
| `core_engine/models/insights.py` | Gemini via `google-genai` con fallback determinista |
| `core_engine/processors/video.py` | Extracción de frames con OpenCV |
| `core_engine/main.py` | FastAPI app con lifespan (cleanup al arrancar) |
| `core_engine/requirements.txt` | Dependencias Python (flexible, compatible con Python 3.14) |
| `dashboard/src/app/page.tsx` | Dashboard principal: flujo completo, scorecard, Human Gate, PDF |
| `dashboard/src/components/BrainViewer.tsx` | Visualización 3D partículas (esfera — pendiente forma anatómica) |
| `dashboard/src/components/VideoCortex.tsx` | Video player con timeline markers (puntos rojo/ámbar) |

---

## Human Gate — Estado actual

**Implementado en esta sesión:**
- `VideoCortex.tsx`: acepta prop `markers: TimelineMarker[]` — puntos de color en la barra de progreso del video. Click en un punto → salta al segundo exacto. Rojo = low attention (score < 75), Ámbar = high load (sensory_load >= 0.45).
- `page.tsx`:
  - `frameMarkers` memo: filtra `frame_insights` por los umbrales arriba.
  - `timelineMarkers`: versión sin datos extra para pasarle al componente.
  - Estado: `activeMarkerIndex`, `markerDecisions`, `markerNotes`, `videoSeekTarget`, `gateExpanded`.
  - Panel compacto (sidebar derecho): resumen markers, prev/next, check/flag inline.
  - Botón **Review** → overlay expandido: video (izq) + panel de revisión (der) con navegador, info del frame, OK/Flag, textarea de nota, Signal Review.
  - Engine Status (sidebar izquierdo): reemplaza "Pro Engine" fake. Muestra frames analizados, confianza, región dominante, decisión — todo desde datos reales.

**Pendiente en Human Gate:**
- Las decisiones de markers (`markerDecisions`, `markerNotes`) aún NO se incluyen en el PDF exportado. Pendiente agregarlas.

---

## Cómo Arrancar

**Terminal 1 — Backend:**
```bash
cd "/Users/sebastianpacheco/Downloads/ViBeCoding/01_Active 🟢/TRIBE_v2"
./venv/bin/python -m uvicorn core_engine.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Dashboard:**
```bash
cd "/Users/sebastianpacheco/Downloads/ViBeCoding/01_Active 🟢/TRIBE_v2/dashboard"
NEXT_PUBLIC_TRIBE_API_BASE_URL=http://127.0.0.1:8000/api/v1/diagnostics npm run dev -- --hostname 127.0.0.1 --port 3000
```

**Abrir:** `http://127.0.0.1:3000`

---

## Dependencias del sistema (además del venv)

| Herramienta | Uso | Estado |
|---|---|---|
| `tesseract` (brew) | OCR spelling/grammar check | ✅ Instalado (`5.5.0`) |
| `zbar` (brew) | QR code detection via pyzbar | ✅ Instalado |
| Python 3.14 venv | Runtime del backend | ✅ En `./venv/` |

**Paquetes Python clave en venv:** `google-genai`, `pytesseract`, `pyzbar`, `opencv-python-headless`, `fastapi`, `uvicorn`

---

## Variables de Entorno

```bash
GOOGLE_API_KEY=your_gemini_api_key_here          # opcional — sin esto usa fallback determinista
NEXT_PUBLIC_TRIBE_API_BASE_URL=http://127.0.0.1:8000/api/v1/diagnostics
```

---

## Pendiente

### Features
1. **Historial (6.9)** — persistencia JSON/SQLite en backend, `GET /diagnostics` para listar, vista lista en dashboard. **En progreso.**
2. **BrainViewer anatómico (6.1)** — esfera → forma de cerebro, zonas en posición real. Visual puro.
3. ~~**Markers en PDF**~~ — ✅ Completado 2026-05-07.
4. ~~**FlipCards + User Guide**~~ — ✅ Completado 2026-05-07. FlipCards en todos los campos. PDF guía descargable desde sidebar.

### Mantenimiento
3. **Auth en la API** — endpoints abiertos sin token. Añadir middleware FastAPI con API key en header. Necesario antes de exponer en red.
4. **Next.js 15/16** — 5 vulnerabilidades restantes en npm audit. Requieren migración mayor. Riesgo bajo en localhost.

---

## Notas Técnicas

- `./venv/bin/python` usa Python 3.14. No usar `python3` del sistema.
- Markers en la timeline solo aparecen después de correr un diagnóstico (requieren `frame_insights` del backend).
- `npm run build` pasa con warning de webpack cache (no bloqueante).
- Los uploads y frames se guardan en `tmp/diagnostics/<request_id>/`. TTL 24h, limpieza automática al arrancar el backend o al subir un video.
- `pyzbar` requiere `libzbar` del sistema (`brew install zbar`). Si no está, el check de QR retorna `None` graciosamente.
- `pytesseract` requiere `tesseract` del sistema (`brew install tesseract`). Si no está, spelling retorna `True` graciosamente.
