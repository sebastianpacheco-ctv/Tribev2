'use client'

import BrainViewer, { REGIONS as BRAIN_REGIONS } from '@/components/BrainViewer'
import { buildBrainConclusion, buildRegionDetails } from '@/lib/diagnostics'
import type { BrainRegionKey, DiagnosticResult } from '@/lib/types'

interface Props {
  diagnosticResult: DiagnosticResult | null
  activation: number
  region: BrainRegionKey
  hoveredRegion: BrainRegionKey | null
  showConclusion: boolean
  setShowConclusion: (v: boolean) => void
  setHoveredRegion: (r: BrainRegionKey | null) => void
}

export function NeuralInsightsSection({
  diagnosticResult,
  activation,
  region,
  hoveredRegion,
  showConclusion,
  setShowConclusion,
  setHoveredRegion,
}: Props) {
  const conclusion = buildBrainConclusion(diagnosticResult)
  const dominantKey = Object.entries(diagnosticResult?.region_activations ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0]
  const conclusionColor = BRAIN_REGIONS.find(r => r.key === dominantKey)?.color ?? '#E85D64'

  return (
    <div className="flex-1 rounded-xl overflow-hidden relative" style={{ minHeight: '420px' }}>
      <BrainViewer
        activationLevel={activation}
        activeRegion={region}
        regionActivations={diagnosticResult?.region_activations ?? undefined}
        approved={diagnosticResult?.final_decision.approved ?? null}
        highlightRegion={hoveredRegion ?? undefined}
        onRegionHover={setHoveredRegion}
        regionDetails={buildRegionDetails(diagnosticResult)}
      />

      {/* "+" trigger — center of brain */}
      {conclusion && !showConclusion && (
        <button
          type="button"
          onClick={() => setShowConclusion(true)}
          title="Show neural conclusion"
          style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 30,
            width: 44, height: 44,
            borderRadius: '50%',
            border: `1.5px solid ${conclusionColor}70`,
            background: `rgba(5,5,5,0.7)`,
            backdropFilter: 'blur(8px)',
            color: conclusionColor,
            fontSize: 30,
            fontWeight: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: `0 0 18px ${conclusionColor}40`,
            transition: 'all 0.2s',
          }}
        >+</button>
      )}

      {/* Conclusion overlay */}
      {showConclusion && conclusion && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5,5,5,0.82)',
          backdropFilter: 'blur(16px)',
          borderRadius: 12,
          padding: 32,
        }}>
          <div style={{ maxWidth: 420, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: conclusionColor }}>Neural Conclusion</p>
              <button
                type="button"
                onClick={() => setShowConclusion(false)}
                style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >✕</button>
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 12 }}>{conclusion.headline}</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: 16 }}>{conclusion.body}</p>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(251,191,36,0.7)', marginBottom: 6 }}>Action</p>
              <p style={{ fontSize: 13, color: 'rgba(251,191,36,0.9)', lineHeight: 1.6 }}>{conclusion.action}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
