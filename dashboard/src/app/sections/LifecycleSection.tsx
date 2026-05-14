'use client'

import { TrendingUp } from 'lucide-react'
import { AbMetricRow } from '@/components/ui'
import type { DiagnosticResult, HistorySummary } from '@/lib/types'

interface Props {
  abResultA: DiagnosticResult | null
  abResultB: DiagnosticResult | null
  historySummaries: HistorySummary[]
  isLoadingHistory: boolean
  abIdA: string
  abIdB: string
  abLoadingA: boolean
  abLoadingB: boolean
  setAbIdA: (id: string) => void
  setAbIdB: (id: string) => void
  setAbResultA: (r: DiagnosticResult | null) => void
  setAbResultB: (r: DiagnosticResult | null) => void
  loadAbResult: (id: string, side: 'a' | 'b') => void
}

export function LifecycleSection({
  abResultA,
  abResultB,
  historySummaries,
  isLoadingHistory,
  abIdA,
  abIdB,
  abLoadingA,
  abLoadingB,
  setAbIdA,
  setAbIdB,
  setAbResultA,
  setAbResultB,
  loadAbResult,
}: Props) {

  return (
    <div className="flex-1 space-y-5 w-full">

      {/* Creative selector — always visible at top */}
      {isLoadingHistory ? (
        <div className="flex items-center justify-center py-8 text-gray-500 text-sm">Loading history…</div>
      ) : historySummaries.length < 2 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <TrendingUp size={28} className="mx-auto mb-3 text-gray-600" />
          <p className="text-sm font-bold text-gray-400">Need at least 2 past runs</p>
          <p className="mt-1 text-xs text-gray-600">Run more analyses to enable A/B comparison.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {(['a', 'b'] as const).map((side) => {
            const currentId = side === 'a' ? abIdA : abIdB
            const result = side === 'a' ? abResultA : abResultB
            const loading = side === 'a' ? abLoadingA : abLoadingB
            const accent = side === 'a' ? 'text-seedtag-coral border-seedtag-coral/30 bg-seedtag-coral/10 hover:bg-seedtag-coral/20' : 'text-blue-400 border-blue-400/30 bg-blue-400/10 hover:bg-blue-400/20'
            const label = side === 'a' ? 'A' : 'B'
            return (
              <div key={side} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <p className={`text-xs font-bold uppercase tracking-widest ${side === 'a' ? 'text-seedtag-coral' : 'text-blue-400'}`}>
                  Creative {label}
                </p>
                <select
                  value={currentId}
                  onChange={(e) => {
                    const id = e.target.value
                    if (side === 'a') { setAbIdA(id); setAbResultA(null) }
                    else { setAbIdB(id); setAbResultB(null) }
                    if (id) loadAbResult(id, side)
                  }}
                  disabled={loading}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:outline-none focus:border-seedtag-coral/50 disabled:opacity-50"
                >
                  <option value="">— Select a run —</option>
                  {historySummaries.map(h => (
                    <option key={h.request_id} value={h.request_id}>
                      {h.filename} · {h.attention_score.toFixed(0)}% · {new Date(h.analyzed_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                {loading && <p className="text-xs text-gray-500">Loading…</p>}
                {result && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-emerald-400 font-bold">✓ Loaded</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (side === 'a') { setAbIdA(''); setAbResultA(null) }
                        else { setAbIdB(''); setAbResultB(null) }
                      }}
                      className="text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Comparison results */}
      {abResultA && abResultB && (() => {
        const aScore = abResultA.attention_score
        const bScore = abResultB.attention_score
        const winner = aScore > bScore ? 'A' : bScore > aScore ? 'B' : null
        const winnerColor = winner === 'A' ? 'text-seedtag-coral' : 'text-blue-400'

        return (
          <div className="space-y-4">
            {/* Winner banner */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 flex items-center justify-between">
              {winner ? (
                <>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Winner by Attention</p>
                    <p className={`text-4xl font-bold ${winnerColor}`}>Creative {winner}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Δ Attention</p>
                    <p className="text-3xl font-bold text-white">+{Math.abs(aScore - bScore).toFixed(1)}%</p>
                  </div>
                </>
              ) : (
                <p className="text-base font-bold text-gray-400 mx-auto">Tie — identical attention scores</p>
              )}
            </div>

            {/* Side-by-side bars */}
            <div className="grid grid-cols-2 gap-5">
              {([abResultA, abResultB] as const).map((r, i) => {
                const label = i === 0 ? 'A' : 'B'
                const accent = i === 0 ? 'text-seedtag-coral' : 'text-blue-400'
                const barColor = i === 0 ? 'bg-seedtag-coral' : 'bg-blue-400'
                const bars = [
                  { label: 'Attention', value: r.attention_score },
                  { label: 'Resonance', value: r.neural_resonance * 100 },
                  { label: 'Confidence', value: r.prediction_confidence * 100 },
                  { label: 'Sensory Load', value: r.sensory_load * 100 },
                  { label: 'Brand Voice', value: r.hybrid_flags.brand_voice_score * 100 },
                ]
                return (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 space-y-5">
                    <div className="flex items-center justify-between">
                      <span className={`text-base font-bold uppercase tracking-widest ${accent}`}>Creative {label}</span>
                      <span className={`text-xs px-3 py-1 rounded-lg font-bold ${r.final_decision.approved ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' : 'text-red-400 bg-red-400/10 border border-red-400/20'}`}>
                        {r.final_decision.approved ? 'Approved' : 'Revision'}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {bars.map((m) => (
                        <div key={m.label}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-gray-400">{m.label}</span>
                            <span className="font-bold text-white">{m.value.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full">
                            <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(m.value, 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-white/10">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Strategy</p>
                      <p className="text-base font-bold text-white">{r.final_decision.strategy_category}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Full comparison table */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Full Comparison</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Metric</span>
                <span className="text-xs font-bold uppercase tracking-widest text-seedtag-coral text-center">A</span>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-400 text-center">B</span>
              </div>
              <AbMetricRow label="Attention %" valA={abResultA.attention_score} valB={abResultB.attention_score} />
              <AbMetricRow label="Resonance" valA={abResultA.neural_resonance * 100} valB={abResultB.neural_resonance * 100} />
              <AbMetricRow label="Confidence" valA={abResultA.prediction_confidence * 100} valB={abResultB.prediction_confidence * 100} />
              <AbMetricRow label="Sensory Load" valA={abResultA.sensory_load * 100} valB={abResultB.sensory_load * 100} higherIsBetter={false} />
              <AbMetricRow label="Brand Voice" valA={abResultA.hybrid_flags.brand_voice_score * 100} valB={abResultB.hybrid_flags.brand_voice_score * 100} />
              <div className="grid grid-cols-3 gap-2 items-center pt-3 mt-2 border-t border-white/10">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Decision</span>
                <span className={`text-center text-sm font-bold ${abResultA.final_decision.approved ? 'text-emerald-400' : 'text-red-400'}`}>
                  {abResultA.final_decision.approved ? 'Approved' : 'Revision'}
                </span>
                <span className={`text-center text-sm font-bold ${abResultB.final_decision.approved ? 'text-emerald-400' : 'text-red-400'}`}>
                  {abResultB.final_decision.approved ? 'Approved' : 'Revision'}
                </span>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
