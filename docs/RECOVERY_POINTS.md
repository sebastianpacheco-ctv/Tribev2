# TRIBE v2 - Handoff / Recovery Point

**Fecha:** 6 de mayo de 2026
**Commit:** `bbc65c2`
**Branch:** `main`
**Estado:** Pipeline CTV completo, end-to-end validado, Gemini migrado a `google-genai`. Working tree limpio.

---

## Resumen del Estado Actual

TRIBE v2 es una herramienta de diagnóstico creativo para CTV. El flujo completo está operativo:

1. Seleccionar video → subir al backend
2. Ejecutar diagnóstico (frame extraction + inference determinista + Gemini opcional)
3. Ver scorecard QA con activaciones neurales
4. Confirmar/rechazar Hybrid Review (Brand Voice, Pacing, Transitions)
5. Exportar PDF con métricas, resumen ejecutivo, mapa cortical y diagnóstico frame-by-frame

---

## Commits en este Punto

| Hash | Descripción |
|---|---|
| `bbc65c2` | Migración Gemini SDK a `google-genai`, requirements compatibles con Python 3.14 |
| `370b9aa` | Pipeline CTV completo: upload, inference, hybrid review, PDF export |
| `e5c4cd6` | Commit inicial: arquitectura, QA rules, CTV Template |

---

## Archivos Clave

| Archivo | Rol |
|---|---|
| `core_engine/api/routes/diagnostics.py` | Endpoints `/upload` y `/analyze` |
| `core_engine/models/inference.py` | Inference determinista (contraste, motion, brillo, entropía, saturación) |
| `core_engine/models/insights.py` | Gemini via `google-genai` con fallback determinista |
| `core_engine/processors/video.py` | Extracción de frames con OpenCV, normalización a tensor 224x224 |
| `dashboard/src/app/page.tsx` | Dashboard principal: flujo completo, scorecard, PDF export |
| `dashboard/src/components/BrainViewer.tsx` | Visualización 3D de partículas con activación por región |
| `dashboard/src/components/VideoCortex.tsx` | Selector/preview de video, upload con progreso, playback |
| `core_engine/requirements.txt` | Dependencias Python (sin pins estrictos, compatibles con Python 3.14) |

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

**Smoke test backend:**
```bash
curl -s http://127.0.0.1:8000/
# → {"status":"online","engine":"TRIBE v2","version":"2.0.0"}
```

---

## Variables de Entorno

Crear `.env` en la raíz si se quiere activar Gemini:
```bash
GOOGLE_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_TRIBE_API_BASE_URL=http://127.0.0.1:8000/api/v1/diagnostics
```

Sin `GOOGLE_API_KEY`, el pipeline funciona con fallback determinista.

---

## Notas Técnicas

- `./venv/bin/python` usa Python 3.14. No usar `python3 -m uvicorn` (system Python no tiene el venv).
- El IDE (VS Code) puede marcar imports como no resueltos si no apunta al venv. No afecta el runtime.
- `npm run build` en `dashboard/` pasa con warning no bloqueante de webpack cache.
- `python3 -m compileall core_engine` pasa sin errores.
- Los uploads y frames se guardan en `tmp/diagnostics/<request_id>/`. No se limpian automáticamente.

---

## Verificaciones Pasadas

| Test | Resultado |
|---|---|
| `npm run build` (dashboard) | ✅ Correcto (warning webpack cache no bloqueante) |
| `python3 -m compileall core_engine` | ✅ Sin errores |
| Smoke test backend (`/`) | ✅ 200 OK |
| Smoke test `/analyze` con request existente | ✅ 200 OK |
| End-to-end UI (upload → diagnóstico → hybrid review → PDF export) | ✅ Pasado |
| PDF visual QA (paginación, Human Hybrid Review en página limpia) | ✅ Pasado |

---

## Pendiente

### Funcionalidad
1. **BrainViewer — forma de cerebro anatómica:** Las partículas actuales forman una esfera genérica. Se puede implementar forma de cerebro matemática (Opción A, sin assets externos) o con modelo `.glb` (Opción B). Las activaciones por región ya están conectadas; solo falta la forma.
2. **OCR real para QA checks:** CTA, logo, safe zones, spelling y QR hoy son heurísticas visuales deterministas. Producción requiere OCR/object detection real (Tesseract o Vision API).

### Mantenimiento
3. **Limpieza de `tmp/diagnostics`:** Sin política de retención. Se acumula con cada análisis. Definir TTL o limpieza manual.
4. **Autenticación en la API:** Endpoints abiertos sin token/auth. Necesario antes de exponer en red.
5. **`npm audit`:** Hay vulnerabilidades reportadas. No correr `npm audit fix` sin revisar impacto primero.
