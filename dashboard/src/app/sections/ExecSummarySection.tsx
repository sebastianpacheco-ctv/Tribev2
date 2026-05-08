'use client'

import { CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react'
import type { DiagnosticResult } from '@/lib/types'
import { getRegionLabel, getPrimaryRegion } from '@/lib/diagnostics'

interface Props {
  diagnosticResult: DiagnosticResult | null
  onExportPdf: () => void
}

export function ExecSummarySection({ diagnosticResult, onExportPdf }: Props) {
  if (!diagnosticResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-24">
        <AlertTriangle size={40} className="text-gray-600" />
        <p className="text-sm font-bold text-gray-400">No diagnostic loaded</p>
        <p className="text-xs text-gray-600">Run an analysis or load demo data to generate an executive summary.</p>
      </div>
    )
  }

  const { attention_score, prediction_confidence, neural_resonance, final_decision, actionable_steps, hybrid_flags, ai_automated, region_activations } = diagnosticResult
  const approved = final_decision.approved
  const topStep = actionable_steps[0] ?? null
  const primaryRegion = getRegionLabel(getPrimaryRegion(region_activations))
  const highPriorityCount = actionable_steps.filter(s => s.priority === 'High').length

  const scoreColor = attention_score >= 75 ? '#34d399' : attention_score >= 55 ? '#fbbf24' : '#f87171'
  const scoreLabel = attention_score >= 75 ? 'Strong' : attention_score >= 55 ? 'Moderate' : 'Needs Work'

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col gap-5 py-2">

      {/* Decision hero */}
      <div className={`rounded-2xl border p-6 flex items-center justify-between ${
        approved
          ? 'border-emerald-400/30 bg-emerald-400/5'
          : 'border-amber-400/30 bg-amber-400/5'
      }`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Final Decision</p>
          <div className="flex items-center gap-3">
            {approved
              ? <CheckCircle2 size={28} className="text-emerald-400 shrink-0" />
              : <XCircle size={28} className="text-amber-400 shrink-0" />
            }
            <p className={`text-3xl font-bold ${approved ? 'text-emerald-400' : 'text-amber-400'}`}>
              {approved ? 'Approved' : 'Revisions Required'}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">Strategy: <span className="text-white font-bold">{final_decision.strategy_category}</span></p>
        </div>
        <button
          type="button"
          onClick={onExportPdf}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-gray-300 hover:bg-white/10 transition-all"
        >
          <Download size={13} /> Export PDF
        </button>
      </div>

      {/* 3 key metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Attention Score', value: `${attention_score.toFixed(0)}`, unit: '/ 100', color: scoreColor, badge: scoreLabel },
          { label: 'Model Confidence', value: `${(prediction_confidence * 100).toFixed(0)}`, unit: '%', color: '#e2e8f0', badge: null },
          { label: 'Emotional Impact', value: `${(neural_resonance * 100).toFixed(0)}`, unit: '%', color: '#e2e8f0', badge: null },
        ].map(({ label, value, unit, color, badge }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">{label}</p>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-3xl font-bold leading-none" style={{ color }}>{value}</span>
              <span className="text-sm text-gray-500">{unit}</span>
            </div>
            {badge && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}>
                {badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Top recommendation */}
      {topStep && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3">
            Top Recommendation · <span className={topStep.priority === 'High' ? 'text-red-400' : 'text-amber-400'}>{topStep.priority} Priority</span>
          </p>
          <p className="text-base font-bold text-white mb-2">{topStep.title}</p>
          <p className="text-sm text-gray-400 leading-relaxed">{topStep.rationale}</p>
          <p className="text-[10px] text-gray-600 mt-3">Frame range: {topStep.frame_range}</p>
        </div>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Dominant Region', value: primaryRegion },
          { label: 'Brand Voice', value: `${(hybrid_flags.brand_voice_score * 100).toFixed(0)}%` },
          { label: 'Action Items', value: `${actionable_steps.length}`, sub: highPriorityCount > 0 ? `${highPriorityCount} high` : 'none high' },
          { label: 'CTA Present', value: ai_automated.cta_present ? 'Yes' : 'No', color: ai_automated.cta_present ? '#34d399' : '#f87171' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">{label}</p>
            <p className="text-sm font-bold leading-tight" style={{ color: color ?? '#fff' }}>{value}</p>
            {sub && <p className="text-[9px] text-gray-600 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Pacing warnings (if any) */}
      {hybrid_flags.pacing_warnings.length > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400 mb-3">Pacing Notes</p>
          <ul className="space-y-2">
            {hybrid_flags.pacing_warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                <span className="text-amber-400 mt-0.5 shrink-0">·</span>{w}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
