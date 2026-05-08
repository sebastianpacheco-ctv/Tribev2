'use client'

import { Activity, TrendingUp } from 'lucide-react'
import { AbMetricRow } from '@/components/ui'
import type { DiagnosticResult, HistorySummary } from '@/lib/types'

interface HistAvg {
  attention: number
  approvalRate: number
  frames: number
}

interface Props {
  lifecycleTab: 'benchmark' | 'ab'
  setLifecycleTab: (tab: 'benchmark' | 'ab') => void
  abResultA: DiagnosticResult | null
  abResultB: DiagnosticResult | null
  diagnosticResult: DiagnosticResult | null
  histAvg: HistAvg | null
  historySummaries: HistorySummary[]
}

export function LifecycleSection({
  lifecycleTab,
  setLifecycleTab,
  abResultA,
  abResultB,
  diagnosticResult,
  histAvg,
  historySummaries,
}: Props) {
  return (
    <div className="flex-1 space-y-4">
      {/* Tab switcher */}
      <div className="flex rounded-lg border border-white/10 overflow-hidden">
        {(['benchmark', 'ab'] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setLifecycleTab(tab)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
              lifecycleTab === tab ? 'bg-seedtag-coral text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}>
            {tab === 'benchmark' ? 'Benchmark' : 'A/B Compare'}
          </button>
        ))}
      </div>

      {lifecycleTab === 'ab' ? (
        abResultA && abResultB ? (
          <div className="space-y-4">
            {/* Winner banner */}
            {(() => {
              const aScore = abResultA.attention_score
              const bScore = abResultB.attention_score
              const winner = aScore > bScore ? 'A' : bScore > aScore ? 'B' : null
              const winnerColor = winner === 'A' ? 'text-seedtag-coral' : 'text-blue-400'
              return winner ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Winner by Attention</p>
                    <p className={`text-2xl font-bold ${winnerColor}`}>Creative {winner}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 mb-1">Δ Attention</p>
                    <p className="text-xl font-bold text-white">+{Math.abs(aScore - bScore).toFixed(1)}%</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                  <p className="text-sm font-bold text-gray-400">Tie — identical attention scores</p>
                </div>
              )
            })()}

            {/* Side-by-side cards */}
            <div className="grid grid-cols-2 gap-4">
              {([abResultA, abResultB] as const).map((r, i) => {
                const label = i === 0 ? 'A' : 'B'
                const accent = i === 0 ? 'text-seedtag-coral' : 'text-blue-400'
                const barColor = i === 0 ? 'bg-seedtag-coral' : 'bg-blue-400'
                const metrics = [
                  { label: 'Attention', value: r.attention_score, max: 100 },
                  { label: 'Resonance', value: r.neural_resonance * 100, max: 100 },
                  { label: 'Confidence', value: r.prediction_confidence * 100, max: 100 },
                  { label: 'Sensory Load', value: r.sensory_load * 100, max: 100 },
                  { label: 'Brand Voice', value: r.hybrid_flags.brand_voice_score * 100, max: 100 },
                ]
                return (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold uppercase tracking-widest ${accent}`}>Creative {label}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${r.final_decision.approved ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' : 'text-red-400 bg-red-400/10 border border-red-400/20'}`}>
                        {r.final_decision.approved ? 'Approved' : 'Revision'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {metrics.map((m) => (
                        <div key={m.label}>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-gray-400">{m.label}</span>
                            <span className="font-bold text-white">{m.value.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full">
                            <div className={`h-1.5 rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(m.value, 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Strategy</p>
                      <p className="text-sm font-bold text-white">{r.final_decision.strategy_category}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Detailed comparison table */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">Full Comparison</p>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Metric</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-seedtag-coral text-center">A</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400 text-center">B</span>
              </div>
              <AbMetricRow label="Attention %" valA={abResultA.attention_score} valB={abResultB.attention_score} />
              <AbMetricRow label="Resonance" valA={abResultA.neural_resonance * 100} valB={abResultB.neural_resonance * 100} />
              <AbMetricRow label="Confidence" valA={abResultA.prediction_confidence * 100} valB={abResultB.prediction_confidence * 100} />
              <AbMetricRow label="Sensory load" valA={abResultA.sensory_load * 100} valB={abResultB.sensory_load * 100} higherIsBetter={false} />
              <AbMetricRow label="Brand voice" valA={abResultA.hybrid_flags.brand_voice_score * 100} valB={abResultB.hybrid_flags.brand_voice_score * 100} />
              <div className="grid grid-cols-3 gap-2 items-center pt-2 mt-1 border-t border-white/10">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Decision</span>
                <span className={`text-center text-[10px] font-bold ${abResultA.final_decision.approved ? 'text-emerald-400' : 'text-red-400'}`}>
                  {abResultA.final_decision.approved ? 'Approved' : 'Revision'}
                </span>
                <span className={`text-center text-[10px] font-bold ${abResultB.final_decision.approved ? 'text-emerald-400' : 'text-red-400'}`}>
                  {abResultB.final_decision.approved ? 'Approved' : 'Revision'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <TrendingUp size={36} className="text-gray-600" />
            <p className="text-sm font-bold text-gray-400">Select and load two creatives</p>
            <p className="text-xs text-gray-600">Use the panel on the right to pick Creative A and B</p>
          </div>
        )
      ) : (
        /* Benchmark tab */
        !diagnosticResult ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Activity size={36} className="text-gray-600" />
            <p className="text-sm font-bold text-gray-400">No current diagnostic</p>
            <p className="text-xs text-gray-600">Run an analysis first to compare against history.</p>
          </div>
        ) : histAvg === null ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Activity size={36} className="text-gray-600" />
            <p className="text-sm font-bold text-gray-400">No history yet</p>
            <p className="text-xs text-gray-600">Run more analyses to build a benchmark baseline.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Attention Score', current: diagnosticResult.attention_score, avg: histAvg.attention, unit: '%' },
                { label: 'Approval Rate', current: diagnosticResult.final_decision.approved ? 100 : 0, avg: histAvg.approvalRate, unit: '%' },
                { label: 'Frames Analyzed', current: diagnosticResult.frames_analyzed, avg: histAvg.frames, unit: '' },
              ].map(({ label, current, avg, unit }) => {
                const delta = current - avg
                const good = delta >= 0
                return (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">{label}</p>
                    <p className="text-3xl font-bold text-white">{current.toFixed(1)}<span className="text-base font-normal text-gray-400 ml-1">{unit}</span></p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">avg {avg.toFixed(1)}{unit}</span>
                      <span className={`text-[10px] font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)} {good ? '↑' : '↓'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-4">
                Strategy Distribution — {historySummaries.length} past run{historySummaries.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-3">
                {Array.from(new Set(historySummaries.map(h => h.strategy_category))).map(cat => {
                  const count = historySummaries.filter(h => h.strategy_category === cat).length
                  const pct = (count / historySummaries.length) * 100
                  const isCurrent = diagnosticResult.final_decision.strategy_category === cat
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className={`font-bold ${isCurrent ? 'text-seedtag-coral' : 'text-gray-300'}`}>
                          {cat}{isCurrent ? ' ← current' : ''}
                        </span>
                        <span className="text-gray-500">{count} run{count !== 1 ? 's' : ''} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10">
                        <div className={`h-2 rounded-full transition-all ${isCurrent ? 'bg-seedtag-coral' : 'bg-white/20'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}
