'use client'

import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock,
  Maximize2,
  TrendingUp,
  X,
} from 'lucide-react'
import { FlipCard, InfoTip, SectionHeading } from '@/components/ui'
import { DeltaBadge, AbMetricRow } from '@/components/ui'
import {
  buildNeuralLog,
  buildRegionRecommendations,
  formatRatio,
  HYBRID_EXPLAINERS,
  REGION_EXPLAINERS,
  RESULT_EXPLAINERS,
  getAutomatedCheckExplanation,
} from '@/lib/diagnostics'
import { DIAGNOSTICS_API_BASE } from '@/lib/api'
import { getFrameBudgetLabel } from '@/lib/diagnostics'
import type {
  AnalysisDepth,
  AutomatedCheckItem,
  BrainRegionKey,
  DiagnosticResult,
  FrameInsight,
  FrameMarker,
  HistorySummary,
  HybridReviewItem,
  HybridReviewKey,
  MarkerDecision,
  ReviewDecision,
} from '@/lib/types'

interface RegionMetric {
  name: string
  value: number | null
  key: BrainRegionKey
  color: string
}

const REGION_THRESHOLDS: Record<string, { high: string; mid: string; low: string }> = {
  'Frontal (Attention)': {
    high: 'Strong message clarity — the creative demands active cognitive focus. Viewers are likely to encode the key message.',
    mid: 'Moderate engagement. The message hierarchy could be stronger — a clearer focal point or copy contrast would help.',
    low: 'Weak attention signal. The message is not cutting through. Strengthen the main communication with contrast or hierarchy.',
  },
  'Visual (V1)': {
    high: 'High visual impact — composition, contrast and color are working hard. Likely to stop the scroll and create recall.',
    mid: 'Moderate visual impact. Adding stronger contrast between product and background could increase salience.',
    low: 'Low visual engagement. Rework layout, contrast or motion to give the eye a clear place to land.',
  },
  'Temporal (Audio)': {
    high: 'Copy, pacing or editing rhythm is reinforcing the message well. Good audio-visual coherence.',
    mid: 'Moderate audio-visual signal. On-screen text or sound design could do more to support the offer.',
    low: 'Audio or copy is not adding signal. Consider stronger voiceover, cleaner on-screen text or more intentional edit rhythm.',
  },
  'Emotional': {
    high: 'Strong emotional response predicted — the creative generates genuine engagement, boosting long-term memorability.',
    mid: 'Moderate emotional engagement. Adding a human element, storytelling beat or surprise moment could deepen connection.',
    low: 'Low emotional response. The creative feels functional but not memorable. Find a human truth or emotional hook.',
  },
}

function regionSignalInfo(name: string, value: number | null): string {
  const thresholds = REGION_THRESHOLDS[name]
  if (!thresholds || value === null) return REGION_EXPLAINERS[name] ?? ''
  const level = value >= 75 ? 'high' : value >= 50 ? 'mid' : 'low'
  const label = value >= 75 ? '≥75% — High' : value >= 50 ? '50–74% — Moderate' : '<50% — Low'
  return `Threshold: ≥75 High · 50–74 Moderate · <50 Low\nYour score: ${value.toFixed(1)}% (${label})\n\n${thresholds[level]}`
}

interface HistAvg {
  attention: number
  approvalRate: number
  frames: number
}

interface Props {
  activeSection: string
  diagnosticResult: DiagnosticResult | null
  uploadResult: { request_id: string } | null
  activation: number
  region: BrainRegionKey
  voxelMode: boolean
  reviewDecisions: Partial<Record<HybridReviewKey, ReviewDecision>>
  reviewSummary: { confirmed: number; rejected: number }
  automatedChecks: AutomatedCheckItem[]
  hybridReviewItems: HybridReviewItem[]
  frameMarkers: FrameMarker[]
  activeMarkerIndex: number | null
  markerDecisions: Record<number, MarkerDecision>
  gateExpanded: boolean
  regionMetrics: RegionMetric[]
  // history / lifecycle panel state
  isLoadingHistory: boolean
  historySummaries: HistorySummary[]
  lifecycleTab: 'ab'
  histAvg: HistAvg | null
  abResultA: DiagnosticResult | null
  abResultB: DiagnosticResult | null
  abResultC?: DiagnosticResult | null
  abIdA: string
  abIdB: string
  setAbIdA: (v: string) => void
  setAbIdB: (v: string) => void
  setAbResultA: (v: DiagnosticResult | null) => void
  setAbResultB: (v: DiagnosticResult | null) => void
  abLoadingA: boolean
  abLoadingB: boolean
  analysisDepth: AnalysisDepth
  frameRate: number
  isUploading: boolean
  isAnalyzing: boolean
  // callbacks
  setHybridDecision: (id: HybridReviewKey, decision: ReviewDecision) => void
  setMarkerDecision: (frameIndex: number, decision: MarkerDecision) => void
  navigateMarker: (dir: 'prev' | 'next') => void
  setGateExpanded: (v: boolean) => void
  setSelectedFrame: (f: FrameInsight) => void
  loadHistoryEntry: (id: string) => Promise<void>
  loadAbResult: (id: string, side: 'a' | 'b') => Promise<void>
  setAnalysisProfile: (depth: AnalysisDepth, fps: number) => void
  resetSession: () => void
}

export function DiagnosticsPanel({
  activeSection,
  diagnosticResult,
  uploadResult,
  activation,
  region,
  voxelMode,
  reviewDecisions,
  reviewSummary,
  automatedChecks,
  hybridReviewItems,
  frameMarkers,
  activeMarkerIndex,
  markerDecisions,
  gateExpanded,
  regionMetrics,
  isLoadingHistory,
  historySummaries,
  lifecycleTab: _lifecycleTab,
  histAvg,
  abResultA,
  abResultB,
  abIdA,
  abIdB,
  setAbIdA,
  setAbIdB,
  setAbResultA,
  setAbResultB,
  abLoadingA,
  abLoadingB,
  analysisDepth,
  frameRate,
  isUploading,
  isAnalyzing,
  setHybridDecision,
  setMarkerDecision,
  navigateMarker,
  setGateExpanded,
  setSelectedFrame,
  loadHistoryEntry,
  loadAbResult,
  setAnalysisProfile,
  resetSession,
}: Props) {
  return (
    <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
      {activeSection === 'diagnostics' ? (
        <>
          {/* Final Gate */}
          <div className={`rounded-lg border p-4 ${
            diagnosticResult?.final_decision.approved
              ? 'border-emerald-400/30 bg-emerald-400/10'
              : diagnosticResult
                ? 'border-amber-400/30 bg-amber-400/10'
                : 'border-white/10 bg-white/5'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Final Gate</p>
                  <InfoTip text={RESULT_EXPLAINERS.finalGate} />
                </div>
                <p className="mt-2 text-xl font-bold text-white">
                  {diagnosticResult
                    ? diagnosticResult.final_decision.approved ? 'Approved' : 'Revisions'
                    : 'Pending'}
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                diagnosticResult?.final_decision.approved
                  ? 'bg-emerald-400/20 text-emerald-200'
                  : diagnosticResult
                    ? 'bg-amber-400/20 text-amber-200'
                    : 'bg-white/10 text-gray-300'
              }`}>
                {diagnosticResult ? (
                  diagnosticResult.final_decision.approved ? <Check size={20} /> : <AlertTriangle size={20} />
                ) : (
                  <CircleDashed size={20} />
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Strategy</p>
                <p className="mt-1 break-words text-xs font-bold text-white">
                  {diagnosticResult?.final_decision.strategy_category ?? 'Unassigned'}
                </p>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Confidence</p>
                <p className="mt-1 text-xs font-bold text-white">
                  {diagnosticResult ? formatRatio(diagnosticResult.prediction_confidence) : 'Pending'}
                </p>
              </div>
            </div>
          </div>

          {/* Actionable Steps */}
          <section className="space-y-3">
            <SectionHeading
              title="Actionable Steps"
              info={RESULT_EXPLAINERS.actionable}
              badge={
                <span className="rounded border border-seedtag-coral/20 bg-seedtag-coral/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-seedtag-coral">
                  {diagnosticResult?.actionable_steps.length ?? 0}
                </span>
              }
            />
            <div className="space-y-2">
              {(diagnosticResult?.actionable_steps ?? []).slice(0, 3).map((step) => (
                <div key={`${step.priority}-${step.title}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold text-white">{step.title}</p>
                    <span className="shrink-0 rounded border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-seedtag-coral">
                      {step.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{step.rationale}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">{step.frame_range}</p>
                </div>
              ))}
              {!diagnosticResult && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-gray-400">
                  Run a diagnostic to generate prioritized edit recommendations.
                </div>
              )}
            </div>
          </section>

          {/* AI Automated */}
          <section className="space-y-3">
            <SectionHeading
              title="AI Automated"
              info={RESULT_EXPLAINERS.automated}
              badge={
                <span className="rounded border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-200">
                  {automatedChecks.filter((check) => check.passed === true).length}/{automatedChecks.length}
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-2">
              {automatedChecks.map((check) => {
                const statusLabel = check.passed === null ? 'Pending' : check.passed ? 'Pass' : 'Review'
                const statusClass = check.passed === null
                  ? 'border-white/10 bg-white/5 text-gray-300'
                  : check.passed
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                    : 'border-red-400/20 bg-red-400/10 text-red-200'
                return (
                  <FlipCard
                    key={check.label}
                    front={
                      <div className="flex h-[96px] flex-col justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <span className="pr-5 text-xs font-medium leading-tight text-white">{check.label}</span>
                        <span className={`flex items-center justify-center gap-1 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${statusClass}`}>
                          {check.passed === null ? <CircleDashed size={12} /> : check.passed ? <Check size={12} /> : <X size={12} />}
                          {statusLabel}
                        </span>
                      </div>
                    }
                    back={
                      <div className="flex h-[96px] flex-col rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
                        <p className="overflow-y-auto pr-5 text-xs leading-relaxed text-gray-200">{getAutomatedCheckExplanation(check.label)}</p>
                      </div>
                    }
                  />
                )
              })}
            </div>
          </section>

          {/* Hybrid Review */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionHeading
                title="Hybrid Review"
                info={RESULT_EXPLAINERS.hybrid}
                badge={
                  <span className="rounded border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-200">
                    Human Gate
                  </span>
                }
              />
              {diagnosticResult && frameMarkers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setGateExpanded(true)}
                  className="flex items-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-black shadow-lg shadow-amber-400/30 transition-all hover:brightness-110 active:scale-95"
                >
                  <Maximize2 size={13} />
                  Review {frameMarkers.length} markers
                </button>
              )}
            </div>

            {/* Frame marker summary */}
            {diagnosticResult && frameMarkers.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Frame Markers</span>
                  <span className="text-[10px] font-bold text-amber-300">
                    {Object.keys(markerDecisions).length}/{frameMarkers.length} reviewed
                  </span>
                </div>
                <div className="flex gap-2 text-[10px] text-gray-400">
                  <FlipCard
                    className="flex-1"
                    front={
                      <div className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500/80" />
                        {frameMarkers.filter((m) => m.type === 'low-attention').length} low attention
                      </div>
                    }
                    back={
                      <div className="rounded border border-red-400/20 bg-red-400/5 px-2 py-1">
                        <p className="pr-4 text-[9px] leading-snug text-red-200">
                          Frames where predicted attention drops below 75. The viewer may disengage at these moments.
                        </p>
                      </div>
                    }
                  />
                  <FlipCard
                    className="flex-1"
                    front={
                      <div className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-500/80" />
                        {frameMarkers.filter((m) => m.type === 'high-load').length} high load
                      </div>
                    }
                    back={
                      <div className="rounded border border-amber-400/20 bg-amber-400/5 px-2 py-1">
                        <p className="pr-4 text-[9px] leading-snug text-amber-200">
                          Frames with sensory load above 45%. Too much information at once can cause viewer fatigue.
                        </p>
                      </div>
                    }
                  />
                </div>
                {activeMarkerIndex !== null && (() => {
                  const m = frameMarkers.find((fm) => fm.frameIndex === activeMarkerIndex)
                  if (!m) return null
                  const decision = markerDecisions[m.frameIndex]
                  return (
                    <div className="rounded border border-white/10 bg-black/30 p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold ${m.type === 'low-attention' ? 'text-red-300' : 'text-amber-300'}`}>
                          {m.type === 'low-attention' ? '⚠ Low Attention' : '⚠ High Load'} · {m.timestampSeconds}s
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setMarkerDecision(m.frameIndex, 'ok')}
                            className={`flex h-6 w-6 items-center justify-center rounded border text-[10px] transition-all ${
                              decision === 'ok'
                                ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100'
                                : 'border-white/10 bg-white/5 text-gray-400 hover:text-emerald-300'
                            }`}
                          >
                            <Check size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setMarkerDecision(m.frameIndex, 'flagged')}
                            className={`flex h-6 w-6 items-center justify-center rounded border text-[10px] transition-all ${
                              decision === 'flagged'
                                ? 'border-red-400/40 bg-red-400/20 text-red-100'
                                : 'border-white/10 bg-white/5 text-gray-400 hover:text-red-300'
                            }`}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] leading-snug text-gray-400">{m.recommendation}</p>
                    </div>
                  )
                })()}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => navigateMarker('prev')}
                    className="flex h-7 flex-1 items-center justify-center gap-1 rounded border border-white/10 bg-white/5 text-[10px] font-bold text-gray-300 transition-all hover:bg-white/10 disabled:opacity-40"
                    disabled={!frameMarkers.length}
                  >
                    <ChevronLeft size={12} /> Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateMarker('next')}
                    className="flex h-7 flex-1 items-center justify-center gap-1 rounded border border-white/10 bg-white/5 text-[10px] font-bold text-gray-300 transition-all hover:bg-white/10 disabled:opacity-40"
                    disabled={!frameMarkers.length}
                  >
                    Next <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Hybrid review items */}
            <div className="space-y-2">
              {hybridReviewItems.map((item) => {
                const Icon = item.icon
                const decision = reviewDecisions[item.id]
                const rowBorder = item.needsAttention ? 'border-amber-400/25 bg-amber-400/10' : 'border-white/10 bg-white/[0.03]'
                return (
                  <FlipCard
                    key={item.id}
                    front={
                      <div className={`rounded-lg border p-3 ${rowBorder}`}>
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            item.needsAttention ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-gray-300'
                          }`}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 pr-5">
                              <span className="text-xs font-bold text-white">{item.label}</span>
                              <span className="shrink-0 text-[10px] font-bold text-seedtag-coral">{item.value}</span>
                            </div>
                          </div>
                          <div className="flex gap-1.5 ml-1">
                            <button
                              type="button"
                              disabled={!diagnosticResult}
                              onClick={() => setHybridDecision(item.id, 'confirmed')}
                              className={`flex h-7 w-7 items-center justify-center rounded border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                                decision === 'confirmed'
                                  ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100'
                                  : 'border-white/10 bg-white/5 text-gray-400 hover:text-emerald-300'
                              }`}
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={!diagnosticResult}
                              onClick={() => setHybridDecision(item.id, 'rejected')}
                              className={`flex h-7 w-7 items-center justify-center rounded border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                                decision === 'rejected'
                                  ? 'border-red-400/40 bg-red-400/20 text-red-100'
                                  : 'border-white/10 bg-white/5 text-gray-400 hover:text-red-300'
                              }`}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    }
                    back={
                      <div className={`rounded-lg border p-3 ${rowBorder} flex flex-col justify-center min-h-full`}>
                        <p className="mb-1 pr-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">{item.label}</p>
                        <p className="pr-5 text-[11px] leading-snug text-gray-200">{HYBRID_EXPLAINERS[item.id]}</p>
                      </div>
                    }
                  />
                )
              })}
            </div>
          </section>

          {/* Neural Signals */}
          <section className="space-y-3">
            <SectionHeading title="Neural Signals" info={RESULT_EXPLAINERS.neural} />
            <div className="space-y-3">
              {regionMetrics.map((metric) => {
                const isActive = metric.key === region || region === 'all'
                return (
                  <FlipCard
                    key={metric.name}
                    front={
                      <div className={`flex flex-col gap-2 rounded-lg px-2 py-1.5 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-45'}`}>
                        <div className="flex items-baseline justify-between pr-5">
                          <span className="text-xs font-bold text-white">{metric.name}</span>
                          <span className="font-mono text-[11px] font-bold" style={{ color: metric.value !== null ? metric.color : 'rgba(255,255,255,0.2)' }}>
                            {metric.value !== null ? `${metric.value.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/5 bg-white/5 p-[1px]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: metric.value !== null ? `${Math.max(8, metric.value)}%` : '0%' }}
                            transition={{ duration: 0.5 }}
                            style={{ background: isActive && metric.value !== null ? metric.color : undefined }}
                            className={`h-full rounded-full ${isActive && metric.value !== null ? '' : 'bg-gray-600'}`}
                          />
                        </div>
                      </div>
                    }
                    back={
                      <div className="rounded-lg px-2 py-1.5 space-y-1.5">
                        <p className="pr-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">{metric.name}</p>
                        {regionSignalInfo(metric.name, metric.value).split('\n').map((line, i) => (
                          <p key={i} className={`pr-5 leading-snug ${i === 0 ? 'text-[9px] text-gray-500' : i === 1 ? 'text-[10px] font-bold text-white' : 'text-[11px] text-gray-200'}`}>{line}</p>
                        ))}
                      </div>
                    }
                  />
                )
              })}
            </div>
          </section>
        </>
      ) : activeSection === 'insights' ? (
        <>
          {/* Model State */}
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Model State</p>
                <p className="mt-2 text-xl font-bold text-white">
                  {diagnosticResult ? 'Inference Complete' : voxelMode ? 'Voxel Preview' : 'Awaiting Diagnostic'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-seedtag-coral/15 text-seedtag-coral">
                <Brain size={20} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Activation</p>
                <p className="mt-1 text-xs font-bold text-white">{(activation * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Region</p>
                <p className="mt-1 text-xs font-bold text-white">{region.toUpperCase()}</p>
              </div>
            </div>
          </section>

          {/* Recommendations */}
          {(() => {
            const rec = buildRegionRecommendations(diagnosticResult)
            if (!rec) return null
            return (
              <section className="space-y-2">
                <SectionHeading title="Recommendations" info="Actionable insights derived from region activations." />
                <div className="space-y-2">
                  {rec.working.length > 0 && (
                    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 p-3 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">What&apos;s working</p>
                      {rec.working.map(w => (
                        <p key={w.label} className="text-xs text-gray-300 leading-snug">
                          <span className="font-semibold text-white">{w.label} — </span>{w.reason}
                        </p>
                      ))}
                    </div>
                  )}
                  {rec.failing.length > 0 && (
                    <div className="rounded-lg border border-red-500/25 bg-red-500/8 p-3 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">What&apos;s failing</p>
                      {rec.failing.map(f => (
                        <p key={f.label} className="text-xs text-gray-300 leading-snug">
                          <span className="font-semibold text-white">{f.label} — </span>{f.reason}
                        </p>
                      ))}
                    </div>
                  )}
                  {rec.action && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">What to fix</p>
                      <p className="text-xs text-gray-200 leading-snug">{rec.action.tip}</p>
                    </div>
                  )}
                </div>
              </section>
            )
          })()}

          {/* Model Log */}
          <section className="space-y-3">
            <SectionHeading title="Model Log" info="Short narrative interpretation of the diagnostic state, warnings and result readiness." />
            <div className="space-y-2">
              {buildNeuralLog(diagnosticResult).map((line) => (
                <div key={line} className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-gray-300">
                  {line}
                </div>
              ))}
            </div>
          </section>

          {/* Frame Response */}
          <section className="space-y-3">
            <SectionHeading
              title="Frame Response"
              info={RESULT_EXPLAINERS.frameResponse}
              badge={
                <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-gray-300">
                  {diagnosticResult?.frame_insights.length ?? 0} frames
                </span>
              }
            />
            <div className="space-y-2">
              {(diagnosticResult?.frame_insights ?? []).map((frame) => (
                <button
                  key={`${frame.frame_index}-${frame.timestamp_seconds}`}
                  type="button"
                  onClick={() => setSelectedFrame(frame)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition-all hover:border-seedtag-coral/30 hover:bg-seedtag-coral/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-white">{frame.timestamp_seconds.toFixed(2)}s</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{frame.cognitive_response}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] font-bold text-seedtag-coral">
                      {frame.attention_score.toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-gray-500">{frame.recommendation}</p>
                </button>
              ))}
              {!diagnosticResult && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-gray-400">
                  Frame-level predicted response appears after analysis.
                </div>
              )}
            </div>
          </section>
        </>
      ) : activeSection === 'history' ? (
        <>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">Loading history…</div>
          ) : historySummaries.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center">
              <Clock size={28} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm font-bold text-gray-400">No past diagnostics yet</p>
              <p className="mt-1 text-xs text-gray-600">Run an analysis to start building history.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historySummaries.map((entry) => (
                <button
                  key={entry.request_id}
                  type="button"
                  onClick={() => loadHistoryEntry(entry.request_id)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition-all hover:border-seedtag-coral/30 hover:bg-seedtag-coral/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-xs font-bold text-white">{entry.filename}</p>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      entry.approved
                        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                        : 'border-red-400/20 bg-red-400/10 text-red-300'
                    }`}>
                      {entry.approved ? 'Approved' : 'Revision'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-500">
                    <span className="text-seedtag-coral font-bold">{entry.attention_score.toFixed(1)}%</span>
                    <span>{entry.strategy_category}</span>
                    <span>{entry.frames_analyzed} frames</span>
                  </div>
                  <p className="mt-1 text-[9px] text-gray-600">{new Date(entry.analyzed_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : activeSection === 'lifecycle' ? (
        <section className="space-y-3">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8 text-gray-500 text-sm">Loading…</div>
          ) : historySummaries.length < 2 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="text-sm font-bold text-gray-400">Need at least 2 past runs</p>
              <p className="mt-1 text-xs text-gray-600">Run more analyses to enable A/B comparison.</p>
            </div>
          ) : (
            <>
              {(['a', 'b'] as const).map((side) => (
                <div key={side} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-seedtag-coral">Creative {side.toUpperCase()}</p>
                  <select
                    value={side === 'a' ? abIdA : abIdB}
                    onChange={(e) => {
                      if (side === 'a') { setAbIdA(e.target.value); setAbResultA(null) }
                      else { setAbIdB(e.target.value); setAbResultB(null) }
                    }}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-seedtag-coral/50"
                  >
                    <option value="">— Select a run —</option>
                    {historySummaries.map(h => (
                      <option key={h.request_id} value={h.request_id}>
                        {h.filename} · {h.attention_score.toFixed(0)}% · {new Date(h.analyzed_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                  {(side === 'a' ? abIdA : abIdB) && !(side === 'a' ? abResultA : abResultB) && (
                    <button type="button"
                      onClick={() => loadAbResult(side === 'a' ? abIdA : abIdB, side)}
                      disabled={side === 'a' ? abLoadingA : abLoadingB}
                      className="w-full rounded border border-seedtag-coral/30 bg-seedtag-coral/10 py-1.5 text-[10px] font-bold text-seedtag-coral hover:bg-seedtag-coral/20 transition-all disabled:opacity-50"
                    >
                      {(side === 'a' ? abLoadingA : abLoadingB) ? 'Loading…' : 'Load Creative'}
                    </button>
                  )}
                  {(side === 'a' ? abResultA : abResultB) && (
                    <p className="text-[10px] text-emerald-400 font-bold">✓ Loaded</p>
                  )}
                </div>
              ))}
            </>
          )}
        </section>
      ) : (
        /* Config / else */
        <>
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Diagnostics API</p>
              <InfoTip text={RESULT_EXPLAINERS.config} />
            </div>
            <p className="mt-2 break-all text-xs font-bold text-white">{DIAGNOSTICS_API_BASE}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
              Frontend requests upload and analysis through this base URL.
            </p>
          </section>

          <section className="space-y-3">
            <SectionHeading title="Runtime" info={RESULT_EXPLAINERS.config} />
            {[
              ['Dashboard', 'http://127.0.0.1:3005'],
              ['Backend Docs', 'http://127.0.0.1:8000/docs'],
              ['Frame Sampling', getFrameBudgetLabel(analysisDepth, frameRate)],
              ['Gemini', 'Server managed'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
                <p className="mt-1 break-all text-xs font-bold text-white">{value}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <SectionHeading
              title="Analysis Depth"
              info="Controls how many frames are sampled per second. Deeper passes are slower but better for fast edits and dense copy."
            />
            {[
              { depth: 'quick' as AnalysisDepth, fps: 1, label: 'Quick', detail: 'Fast pass for smoke tests.' },
              { depth: 'standard' as AnalysisDepth, fps: 2, label: 'Standard', detail: 'Recommended CTV QA balance.' },
              { depth: 'deep' as AnalysisDepth, fps: 3, label: 'Deep', detail: 'More frames for fast edits or dense offer copy.' },
              { depth: 'ultra' as AnalysisDepth, fps: 6, label: 'Ultra High', detail: '6 fps — maximum resolution for high-cut-rate or motion-heavy ads.' },
            ].map((profile) => {
              const selected = analysisDepth === profile.depth && frameRate === profile.fps
              return (
                <button
                  key={profile.depth}
                  type="button"
                  onClick={() => setAnalysisProfile(profile.depth, profile.fps)}
                  disabled={isUploading || isAnalyzing}
                  className={`w-full rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? 'border-seedtag-coral/40 bg-seedtag-coral/15'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-white">{profile.label}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-seedtag-coral">{profile.fps} fps</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{profile.detail}</p>
                </button>
              )
            })}
          </section>

          <section className="space-y-3">
            <SectionHeading title="Controls" info="Open local API docs or clear the current upload and analysis state." />
            <button
              type="button"
              onClick={() => window.open('http://127.0.0.1:8000/docs', '_blank', 'noopener,noreferrer')}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white transition-all hover:bg-white/10"
            >
              Open API Docs
            </button>
            <button
              type="button"
              onClick={resetSession}
              className="w-full rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs font-bold text-red-100 transition-all hover:bg-red-400/15"
            >
              Clear Current Session
            </button>
          </section>
        </>
      )}
    </div>
  )
}
