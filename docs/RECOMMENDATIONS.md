# Project Recommendations: NeuralSeed (TRIBE v2)

Este documento detalla las recomendaciones estratégicas y técnicas para la evolución de la plataforma NeuralSeed, basadas en la auditoría realizada el 8 de mayo de 2026.

## 1. Arquitectura y Mantenibilidad (Prioridad Alta)
> [!IMPORTANT]
> El archivo `src/app/page.tsx` ha alcanzado un tamaño crítico (~4,000 líneas). Es fundamental modularizarlo para evitar errores de regresión y facilitar el mantenimiento.

- **Modularización**: Dividir `page.tsx` en componentes de sección bajo `src/app/sections/`:
    - `DiagnosticsView.tsx`
    - `NeuralInsightsView.tsx`
    - `HistoryView.tsx`
    - `LifecycleView.tsx`
- **Gestión de Estado**: Implementar **Zustand** o **React Context** para manejar los resultados del diagnóstico y el historial globalmente, eliminando el "prop drilling".
- **Servicios Externos**: Mover la lógica de generación de PDF y las llamadas a la API a archivos de utilidad en `src/lib/`.

## 2. Experiencia de Usuario (UX) e Interacciones
- **Feedback en Tiempo Real**: Sincronizar el `BrainViewer` 3D con la reproducción del video. Las regiones del cerebro deben activarse visualmente según los datos del frame actual.
- **Navegación en Historial**: Añadir un buscador y filtros (por *Strategy* o *Status*) para manejar grandes volúmenes de diagnósticos pasados.
- **Focalización Visual**: Implementar un modo de "Enfoque" que oculte el sidebar y los paneles secundarios al analizar el cerebro 3D o la línea de tiempo.
- **Empty States**: Crear una funcionalidad de "Load Demo Data" para permitir demostraciones rápidas sin necesidad de subir archivos.

## 3. Diseño y Estética
- **Micro-animaciones**: Utilizar `framer-motion` para suavizar las transiciones entre las pestañas principales (Diagnostics -> Insights).
- **Tooltips Contextuales**: Mostrar miniaturas del frame al hacer hover sobre los puntos de la línea de tiempo en el `AttentionChart`.
- **Sidebar Colapsable**: Permitir que el usuario gane espacio de trabajo ocultando la barra lateral.

## 4. Roadmap de Funcionalidades (Nuevas)
- **A/B Dual Player**: Un reproductor sincronizado lado a lado para comparar visualmente dos versiones de un creativo en la sección Lifecycle.
- **Benchmark Trends**: Gráficos de tendencias que muestren cómo han evolucionado las métricas de atención en los últimos videos procesados.
- **Resumen Ejecutivo**: Una vista simplificada de "una sola página" con los 3 hallazgos más importantes para compartir rápidamente con clientes o directivos.

---
*Documento generado por Antigravity AI.*
