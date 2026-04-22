# 📍 TRIBE v2 - Handoff / Recovery Point

**Fecha del Snapshot:** 22 de Abril de 2026
**Contexto Actual:** Hemos pivotado TRIBE v2 de un "visor abstracto del cerebro" a una **herramienta determinista de Quality Assurance (QA) para CTV**, inspirada en la validación estructurada y el Human-in-the-Loop.

## 🎯 ¿Qué se logró en la última sesión?
1. **Framework Arquitectónico:** Integramos las guías de *Markitdown*, *Karpathy-Skills*, y *Archon*. Sobreescribimos `AI_AGENT_RULES.md` para exigir determinismo estricto de las IAs del ecosistema.
2. **Setup de Entorno:**
   - Dependencias de validación instaladas (`pydub`, `pyzbar`, `markitdown`) dentro del entorno virtual (`venv` local) y reflejadas en `core_engine/requirements.txt`.
   - Se clonaron repositorios clave para consulta en la carpeta `external_repos/`.
3. **Refactorización del Backend (Fase 1 completada):**
   - `core_engine/api/schemas/diagnostics.py`: Reestructurado en tres bloques principales: `AutomatedFlags`, `HybridFlags`, y `FinalDecision`.
   - `core_engine/models/insights.py`: Modificado exitosamente el prompt de Gemini 1.5 Flash usando `response_mime_type="application/json"` para que devuelva un Output determinista siguiendo la validación estratégica (Storytelling, Clever Concept, Eye-Catching) sin "poesía".
   - `core_engine/api/routes/diagnostics.py`: El path `/analyze` parsea el JSON rígidamente y ya arma la respuesta de nuestra API.

## 🚀 ¿Qué hay que hacer inmediatamente al continuar (Mañana)?
**El código del servidor ya es capaz de escupir JSON con la estructura correcta del template de calidad. Queda pendiente plasmarlo en la interfaz de usuario.**

### Tarea de Arranque: Fase 3 (UI Frontend)
- **Archivo Principal a Editar:** `/Users/sebastianpacheco/Downloads/Vibe Coding/TRIBE v2/dashboard/src/app/page.tsx`
- **Misión:** 
  1. Conectar los gráficos y contadores "simulados" de React con el hook que llama al endpoint `/api/v1/diagnostics/analyze`.
  2. Sustituir el panel lateral derecho *"Live Brain Stream"* con un nuevo componente interactivo tipo **"Scorecard QA"**.
  3. Dentro del Scorecard, separar visualmente lo que la IA aprobó de forma automatizada (en color claro/verde) y los "Hybrid Flags" (ej. Brand Voice) donde el humano tiene botones para confirmar.

## 🧠 Conocimiento a Recordar (Para el AI Agent)
- Toma de referencias el roadmap actualizado: `/.gemini/antigravity/brain/.../roadmap_ctv_qa.md`.
- Asegúrate de no romper las animaciones 3D de TheReactThreeFiber (R3F) en `BrainViewer.tsx` al modificar estados en `page.tsx`.
- Ante problemas con APIs o permisos (ej. Homebrew/GOG), pedir la actuación del usuario y frenar ejecución autónoma con error 127. No asumas directorios `/opt/homebrew` accesibles sin validación.
