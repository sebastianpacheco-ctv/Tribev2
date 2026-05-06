# TRIBE v2 - Handoff / Recovery Point

**Fecha:** 30 de abril de 2026  
**Estado:** Dashboard y backend conectados en preview local. TRIBE v2 funciona como scorecard QA determinista para CTV con analisis de video, revision humana, export PDF y QA end-to-end validado.

## Resumen Hasta Hoy

TRIBE v2 quedo convertido en una herramienta de diagnostico creativo para CTV. El dashboard ya permite seleccionar un video, subirlo al backend, ejecutar diagnostico sobre frames extraidos, pintar el scorecard QA y exportar un PDF con metricas, recomendaciones y estado humano de `Hybrid Review`.

El working tree sigue con cambios amplios sin commit. No hacer reset ni revertir sin revisar.

## Cambios Clave Implementados

- `core_engine/api/routes/diagnostics.py`
  - Endpoints activos:
    - `POST /api/v1/diagnostics/upload`
    - `POST /api/v1/diagnostics/analyze`
  - Guarda uploads en `tmp/diagnostics/<request_id>/uploads`.
  - Extrae/cacha frames por request y frame rate en `tmp/diagnostics/<request_id>/frames/fps_<n>`.
  - Devuelve `ai_automated`, `hybrid_flags`, `final_decision`, `frame_insights` y `actionable_steps`.
  - Persiste metadata por analisis en `tmp/diagnostics/<request_id>/metadata.json`.

- `core_engine/models/inference.py`
  - Inference determinista sobre features visuales: contraste, motion energy, brillo, entropia, saturacion.
  - Genera activaciones tipo cortex visual, temporal, amygdala y prefrontal.
  - Genera diagnostico frame-by-frame con timestamp, attention score, cognitive response y recommendation.

- `core_engine/models/insights.py`
  - Integra Gemini si existe `GOOGLE_API_KEY`.
  - Si Gemini falla o no hay API key, el backend usa fallback determinista.
  - Aviso actual: `google.generativeai` esta deprecated; migrar a `google.genai`.

- `core_engine/processors/video.py`
  - Extrae frames con OpenCV.
  - Normaliza frames a tensor RGB `224x224` para inference.

- `dashboard/src/app/page.tsx`
  - Dashboard conectado a `NEXT_PUBLIC_TRIBE_API_BASE_URL`.
  - Flujo completo: seleccionar video, subir, analizar, ver scorecard, confirmar/rechazar revision humana y exportar PDF.
  - Secciones actuales: `Diagnostics`, `Neural Insights`, `Sample Registry`, `System Config`.
  - Export PDF ya incluye:
    - Final decision.
    - Metric cards.
    - Cortical activation map.
    - Executive summary.
    - Human Hybrid Review con estados `Confirmed`, `Rejected` o `Pending human review`.
    - Actionable steps.
    - Frame-level predicted response.
  - El export PDF pagina `Human Hybrid Review` en una pagina limpia si no cabe despues del summary, evitando cortes al final de pagina.

- `dashboard/src/components/VideoCortex.tsx`
  - Selector y preview local de video.
  - Upload con progreso.
  - Boton `Run Diagnostic`.
  - Controles de playback, mute, fullscreen y timeline.

- `dashboard/src/components/BrainViewer.tsx`
  - Visualizacion neural/voxel.
  - Fallback si WebGL no esta disponible.

- `dashboard/src/app/globals.css`, `dashboard/tailwind.config.ts`, `dashboard/postcss.config.js`
  - Tailwind instalado/configurado.
  - Estilos base y utilidades ya renderizan correctamente.

- `.env.example`
  - Documenta:
    - `GOOGLE_API_KEY`
    - `NEXT_PUBLIC_TRIBE_API_BASE_URL`

## Verificaciones Hechas

Desde `dashboard/`:

```bash
npm run build
```

Resultado: correcto. Aparece warning no bloqueante de webpack cache:

```text
[webpack.cache.PackFileCacheStrategy] Caching failed for pack: Error: Unable to snapshot resolve dependencies
```

Desde la raiz:

```bash
python3 -m compileall core_engine
```

Resultado: correcto.

Smoke test backend:

```bash
./venv/bin/python -m uvicorn core_engine.main:app --host 127.0.0.1 --port 8000
curl -sS http://127.0.0.1:8000/api/v1/diagnostics/analyze \
  -H 'Content-Type: application/json' \
  -d '{"request_id":"98164a4c-1e0f-4fb2-a9eb-5d7331d04054","frame_rate":2,"analysis_depth":"standard"}'
```

Resultado: `200 OK`.

Sample result:

- Request: `98164a4c-1e0f-4fb2-a9eb-5d7331d04054`
- Creative: `_SDS-20581_PROP_First Response_CTV_standar.mp4`
- Decision: approved.
- Strategy: Storytelling.
- Frames analyzed: 54.
- Attention: 72.37.
- Prediction confidence: 1.0.

Preview levantado:

```text
Dashboard: http://127.0.0.1:3000
Backend:   http://127.0.0.1:8000
```

Backend respondio:

```json
{"status":"online","engine":"TRIBE v2","version":"2.0.0"}
```

Dashboard respondio HTML con titulo:

```text
TRIBE v2 | Predictive Creative Diagnostics
```

Browser/UI end-to-end test:

```text
Video: _SDS-20895_CAMP_IPG_Mercado Libre_Cyber Wow_2026_CSV.mp4
Request: 426c0e46-6086-49eb-a0a5-eb2d8a3cf672
Flow: Select Creative -> Upload to Engine -> Run Diagnostic -> Confirm Brand Voice -> Reject Transitions -> Export Report
Result: passed
PDF: /private/tmp/tribe-downloads/tribe-v2-report-426c0e46-6086-49eb-a0a5-eb2d8a3cf672.pdf
```

PDF visual QA:

- Rendered PDF pages with `pdftoppm`.
- Confirmed page 1 summary is clean.
- Confirmed `Human Hybrid Review` moved to page 2 with `Confirmed`, `Pending human review` and `Rejected` all legible.
- Confirmed action plan and frame-level diagnostics render on later pages without visible clipping.

Estado al detener esta sesion:

- Backend y dashboard fueron cerrados; puertos `8000` y `3000` quedaron libres.
- Ultimas verificaciones: `npm run build` en `dashboard/` y `./venv/bin/python -m compileall core_engine`, ambas correctas.
- El working tree sigue sin commit para revisar y preparar el commit cuando se retome.

## Como Arrancar

Terminal 1, backend:

```bash
cd "/Users/sebastianpacheco/Downloads/Vibe Coding/TRIBE v2"
./venv/bin/python -m uvicorn core_engine.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2, dashboard:

```bash
cd "/Users/sebastianpacheco/Downloads/Vibe Coding/TRIBE v2/dashboard"
NEXT_PUBLIC_TRIBE_API_BASE_URL=http://127.0.0.1:8000/api/v1/diagnostics npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abrir:

```text
http://127.0.0.1:3000
```

## Variables de Entorno

Crear `.env` real si se quiere probar Gemini:

```bash
GOOGLE_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_TRIBE_API_BASE_URL=http://127.0.0.1:8000/api/v1/diagnostics
```

Sin `GOOGLE_API_KEY`, el pipeline sigue funcionando con fallback determinista.

## Pendiente

1. Ajustar umbrales de `AI Automated`:
   - CTA detection.
   - Logo visibility.
   - QR scannability.
   - Safe zones.
   - Hoy son heuristicas visuales; produccion necesita OCR/object detection.

2. Anadir OCR real para copy QA:
   - Spelling/grammar ahora esta marcado como pass determinista.
   - Pendiente integrar OCR y reglas de copy/brand safety.

3. Migrar Gemini:
   - Cambiar `google.generativeai` a `google.genai`.
   - Mantener fallback determinista si no hay API key o si Gemini falla.

4. Mejorar almacenamiento/limpieza de `tmp/diagnostics`:
   - Definir retencion.
   - Evitar acumulacion de uploads/frames pesados.
   - Separar samples reales de artefactos temporales.

5. Revisar `npm audit`:
   - Hay vulnerabilidades reportadas por dependencias.
   - No correr `npm audit fix` sin revisar impacto.

6. Preparar commit:
   - El working tree tiene muchos cambios de backend, dashboard, docs y configs.
   - Revisar diff por archivo antes de commitear.
   - No incluir videos/frames temporales si no corresponden.

## Notas Importantes

- No usar `git reset` ni revertir cambios sin confirmar.
- `python3 -m uvicorn` falla en system Python porque no tiene `uvicorn`; usar `./venv/bin/python`.
- El dashboard puede requerir permiso de puerto fuera del sandbox para `npm run dev`.
- Los warnings de webpack cache no bloquean build.
- El warning de Gemini deprecado no bloquea runtime, pero conviene resolverlo pronto.
