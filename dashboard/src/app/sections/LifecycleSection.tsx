'use client'

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, BarChart3, Activity, Trophy, ChevronUp, ChevronDown, Minus } from 'lucide-react'
import { AbMetricRow } from '@/components/ui'
import type { DiagnosticResult, HistorySummary } from '@/lib/types'
import { DIAGNOSTICS_API_BASE, apiHeaders } from '@/lib/api'

type Tab = 'ab' | 'benchmark' | 'postcampaign'

interface HistAvg { attention: number; approvalRate: number; frames: number }

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
  diagnosticResult: DiagnosticResult | null
  histAvg: HistAvg | null
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'ab',           label: 'A/B',         icon: TrendingUp },
  { id: 'benchmark',    label: 'Benchmark',    icon: BarChart3 },
  { id: 'postcampaign', label: 'Post-Campaign',icon: Activity },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.5)
    return <span className="flex items-center gap-0.5 text-gray-400"><Minus size={12} />{delta.toFixed(1)}%</span>
  if (delta > 0)
    return <span className="flex items-center gap-0.5 text-emerald-400"><ChevronUp size={12} />+{delta.toFixed(1)}%</span>
  return <span className="flex items-center gap-0.5 text-red-400"><ChevronDown size={12} />{delta.toFixed(1)}%</span>
}

function BenchmarkBar({ runs, selectedId }: { runs: HistorySummary[]; selectedId: string }) {
  const H = 56
  const PAD = 4
  const barW = Math.max(6, Math.min(18, Math.floor((400 - PAD * 2) / Math.max(runs.length, 1)) - 2))
  const gap = 2
  const totalW = runs.length * (barW + gap) - gap + PAD * 2
  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${H + 14}`} className="block w-full">
      {runs.map((r, i) => {
        const x = PAD + i * (barW + gap)
        const bh = Math.max(3, (r.attention_score / 100) * H)
        const y = H - bh
        const isSelected = r.request_id === selectedId
        return (
          <g key={r.request_id}>
            <rect x={x} y={y} width={barW} height={bh} rx={2}
              fill={isSelected ? '#E85D64' : 'rgba(255,255,255,0.12)'}
              opacity={isSelected ? 1 : 0.7}
            />
            {isSelected && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fill="#E85D64">
                {r.attention_score.toFixed(0)}
              </text>
            )}
          </g>
        )
      })}
      <line x1={PAD} y1={H - H * 0.62} x2={totalW - PAD} y2={H - H * 0.62}
        stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" strokeDasharray="3 2" />
      <text x={PAD - 2} y={H - H * 0.62 + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.3)">avg</text>
    </svg>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function LifecycleSection({
  abResultA, abResultB,
  historySummaries, isLoadingHistory,
  abIdA, abIdB, abLoadingA, abLoadingB,
  setAbIdA, setAbIdB, setAbResultA, setAbResultB,
  loadAbResult,
  diagnosticResult, histAvg,
}: Props) {
  const [tab, setTab] = useState<Tab>('ab')

  // ── Benchmark state ─────────────────────────────────────────────────────
  const [benchmarkId, setBenchmarkId] = useState<string>('')
  const [benchmarkResult, setBenchmarkResult] = useState<DiagnosticResult | null>(null)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)

  // Default to active result when entering benchmark tab
  useEffect(() => {
    if (tab === 'benchmark' && diagnosticResult && !benchmarkId) {
      setBenchmarkResult(diagnosticResult)
    }
  }, [tab, diagnosticResult, benchmarkId])

  const loadBenchmark = async (id: string) => {
    setBenchmarkId(id)
    setBenchmarkResult(null)
    if (!id) return
    setBenchmarkLoading(true)
    try {
      const r = await fetch(`${DIAGNOSTICS_API_BASE}/${id}`, { headers: apiHeaders() })
      if (!r.ok) throw new Error()
      setBenchmarkResult(await r.json())
    } catch { /* ignore */ }
    finally { setBenchmarkLoading(false) }
  }

  const benchStats = useMemo(() => {
    if (!historySummaries.length) return null
    const scores = historySummaries.map(h => h.attention_score)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    return {
      avg,
      max: Math.max(...scores),
      min: Math.min(...scores),
      count: scores.length,
      approvalRate: (historySummaries.filter(h => h.approved).length / scores.length) * 100,
    }
  }, [historySummaries])

  const benchRank = useMemo(() => {
    if (!benchmarkResult || !historySummaries.length) return null
    const score = benchmarkResult.attention_score
    const sorted = [...historySummaries].sort((a, b) => b.attention_score - a.attention_score)
    return sorted.findIndex(h => h.attention_score <= score) + 1
  }, [benchmarkResult, historySummaries])

  // ── Post-campaign state ──────────────────────────────────────────────────
  type PostEntry = { viewability: string; ctr: string }
  const [postData, setPostData] = useState<Record<string, PostEntry>>({})

  useEffect(() => {
    try {
      const s = localStorage.getItem('neuralseed_postcampaign')
      if (s) setPostData(JSON.parse(s))
    } catch { /* ignore */ }
  }, [])

  const updatePost = (id: string, field: keyof PostEntry, val: string) => {
    setPostData(prev => {
      const next = { ...prev, [id]: { viewability: '', ctr: '', ...prev[id], [field]: val } }
      try { localStorage.setItem('neuralseed_postcampaign', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const postRows = useMemo(() => {
    const rows = historySummaries.map(h => ({
      ...h,
      viewability: parseFloat(postData[h.request_id]?.viewability ?? '') || null,
      ctr: parseFloat(postData[h.request_id]?.ctr ?? '') || null,
    }))
    const ctrs = rows.filter(r => r.ctr !== null).map(r => r.ctr as number)
    const avgCtr = ctrs.length ? ctrs.reduce((a, b) => a + b, 0) / ctrs.length : null
    return rows.map(r => {
      let calibration: 'good' | 'off' | 'none' = 'none'
      if (r.ctr !== null && avgCtr !== null) {
        const predAbove = r.attention_score > (benchStats?.avg ?? 50)
        const ctrAbove  = r.ctr > avgCtr
        calibration = predAbove === ctrAbove ? 'good' : 'off'
      }
      return { ...r, calibration }
    })
  }, [historySummaries, postData, benchStats])

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 space-y-4 w-full">

      {/* Tab switcher */}
      <div className="flex rounded-xl border border-white/10 overflow-hidden">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                active
                  ? 'bg-white/10 text-white'
                  : 'bg-white/[0.03] text-gray-500 hover:bg-white/[0.06] hover:text-gray-300'
              }`}
            >
              <Icon size={11} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── A/B tab ─────────────────────────────────────────────────────── */}
      {tab === 'ab' && (
        <>
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
                const result    = side === 'a' ? abResultA : abResultB
                const loading   = side === 'a' ? abLoadingA : abLoadingB
                const accent    = side === 'a' ? 'text-seedtag-coral' : 'text-blue-400'
                return (
                  <div key={side} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                    <p className={`text-xs font-bold uppercase tracking-widest ${accent}`}>Creative {side.toUpperCase()}</p>
                    <select
                      value={currentId}
                      onChange={(e) => {
                        const id = e.target.value
                        if (side === 'a') { setAbIdA(id); setAbResultA(null) }
                        else              { setAbIdB(id); setAbResultB(null) }
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
                        <button type="button" onClick={() => {
                          if (side === 'a') { setAbIdA(''); setAbResultA(null) }
                          else              { setAbIdB(''); setAbResultB(null) }
                        }} className="text-xs text-gray-500 hover:text-white transition-colors">Clear</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {abResultA && abResultB && (() => {
            const aScore = abResultA.attention_score
            const bScore = abResultB.attention_score
            const winner = aScore > bScore ? 'A' : bScore > aScore ? 'B' : null
            const winnerColor = winner === 'A' ? 'text-seedtag-coral' : 'text-blue-400'
            return (
              <div className="space-y-4">
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

                <div className="grid grid-cols-2 gap-5">
                  {([abResultA, abResultB] as const).map((r, i) => {
                    const label    = i === 0 ? 'A' : 'B'
                    const accent   = i === 0 ? 'text-seedtag-coral' : 'text-blue-400'
                    const barColor = i === 0 ? 'bg-seedtag-coral' : 'bg-blue-400'
                    const bars = [
                      { label: 'Attention',    value: r.attention_score },
                      { label: 'Resonance',    value: r.neural_resonance * 100 },
                      { label: 'Confidence',   value: r.prediction_confidence * 100 },
                      { label: 'Sensory Load', value: r.sensory_load * 100 },
                      { label: 'Brand Voice',  value: r.hybrid_flags.brand_voice_score * 100 },
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
                          {bars.map(m => (
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

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Full Comparison</p>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Metric</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-seedtag-coral text-center">A</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-400 text-center">B</span>
                  </div>
                  <AbMetricRow label="Attention %"   valA={abResultA.attention_score}                    valB={abResultB.attention_score} />
                  <AbMetricRow label="Resonance"     valA={abResultA.neural_resonance * 100}             valB={abResultB.neural_resonance * 100} />
                  <AbMetricRow label="Confidence"    valA={abResultA.prediction_confidence * 100}        valB={abResultB.prediction_confidence * 100} />
                  <AbMetricRow label="Sensory Load"  valA={abResultA.sensory_load * 100}                 valB={abResultB.sensory_load * 100} higherIsBetter={false} />
                  <AbMetricRow label="Brand Voice"   valA={abResultA.hybrid_flags.brand_voice_score * 100} valB={abResultB.hybrid_flags.brand_voice_score * 100} />
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
        </>
      )}

      {/* ── Benchmark tab ───────────────────────────────────────────────── */}
      {tab === 'benchmark' && (
        <>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8 text-gray-500 text-sm">Loading history…</div>
          ) : historySummaries.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <BarChart3 size={28} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm font-bold text-gray-400">No history yet</p>
              <p className="mt-1 text-xs text-gray-600">Run at least one analysis to benchmark against.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Run selector */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Select run to benchmark</p>
                <select
                  value={benchmarkId}
                  onChange={(e) => loadBenchmark(e.target.value)}
                  disabled={benchmarkLoading}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:outline-none focus:border-seedtag-coral/50 disabled:opacity-50"
                >
                  <option value="">{diagnosticResult ? '— Current result (active) —' : '— Select a run —'}</option>
                  {historySummaries.map(h => (
                    <option key={h.request_id} value={h.request_id}>
                      {h.filename} · {h.attention_score.toFixed(0)}% · {new Date(h.analyzed_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                {benchmarkLoading && <p className="text-xs text-gray-500">Loading…</p>}
              </div>

              {/* Benchmark results */}
              {(benchmarkResult || diagnosticResult) && benchStats && (() => {
                const run = benchmarkResult ?? diagnosticResult!
                const delta = run.attention_score - benchStats.avg
                const rank  = benchRank ?? 1

                return (
                  <div className="space-y-4">
                    {/* Position card */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Trophy size={13} className="text-amber-400" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Rank</p>
                        </div>
                        <p className="text-3xl font-bold text-white">
                          #{rank}<span className="text-base text-gray-500 ml-1">of {benchStats.count}</span>
                        </p>
                      </div>
                      <div className="text-center border-x border-white/10">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">vs Avg</p>
                        <p className="text-3xl font-bold text-white">{run.attention_score.toFixed(1)}%</p>
                        <div className="mt-1 text-xs font-bold flex items-center justify-center gap-1">
                          <DeltaBadge delta={delta} />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Decision</p>
                        <p className={`text-sm font-bold mt-2 ${run.final_decision.approved ? 'text-emerald-400' : 'text-red-400'}`}>
                          {run.final_decision.approved ? 'Approved' : 'Revision'}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1">{run.final_decision.strategy_category}</p>
                      </div>
                    </div>

                    {/* Distribution bar chart */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 pt-4 pb-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
                        Attention distribution · {benchStats.count} runs · avg {benchStats.avg.toFixed(1)}%
                      </p>
                      <BenchmarkBar
                        runs={[...historySummaries].sort((a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime())}
                        selectedId={benchmarkId || (diagnosticResult?.request_id ?? '')}
                      />
                      <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                        <span>min {benchStats.min.toFixed(0)}%</span>
                        <span>avg {benchStats.avg.toFixed(0)}%</span>
                        <span>max {benchStats.max.toFixed(0)}%</span>
                      </div>
                    </div>

                    {/* Metric breakdown vs avg */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">This run vs. historical average</p>
                      {[
                        { label: 'Attention Score', value: run.attention_score, avg: benchStats.avg, unit: '%' },
                        { label: 'Neural Resonance', value: run.neural_resonance * 100, avg: null, unit: '%' },
                        { label: 'Confidence', value: run.prediction_confidence * 100, avg: null, unit: '%' },
                        { label: 'Approval Rate (historical)', value: null, avg: benchStats.approvalRate, unit: '%' },
                      ].filter(m => m.value !== null || m.avg !== null).map(m => (
                        <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                          <span className="text-xs text-gray-400">{m.label}</span>
                          <div className="flex items-center gap-3 text-xs font-bold">
                            {m.value !== null && (
                              <span className="text-white">{m.value.toFixed(1)}{m.unit}</span>
                            )}
                            {m.avg !== null && (
                              <span className="text-gray-500">avg {m.avg.toFixed(1)}{m.unit}</span>
                            )}
                            {m.value !== null && m.avg !== null && (
                              <DeltaBadge delta={m.value - m.avg} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}

      {/* ── Post-Campaign tab ────────────────────────────────────────────── */}
      {tab === 'postcampaign' && (
        <>
          {historySummaries.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <Activity size={28} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm font-bold text-gray-400">No history yet</p>
              <p className="mt-1 text-xs text-gray-600">Complete some analyses first, then enter post-campaign metrics here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Post-Campaign Calibration</p>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Enter actual campaign metrics per run. The calibration column shows whether the model's
                  predicted attention correctly anticipated real-world performance.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_80px_90px_90px_80px] gap-0 bg-white/[0.04] px-4 py-2.5">
                  {['Creative', 'Pred.', 'Viewability', 'CTR', 'Calibration'].map(h => (
                    <span key={h} className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{h}</span>
                  ))}
                </div>

                {/* Rows */}
                {postRows.map((row) => {
                  const { viewability: vi, ctr: ct, calibration } = row
                  return (
                    <div key={row.request_id}
                      className="grid grid-cols-[1fr_80px_90px_90px_80px] gap-0 px-4 py-3 border-t border-white/5 items-center">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{row.filename}</p>
                        <p className="text-[10px] text-gray-600">{new Date(row.analyzed_at).toLocaleDateString()}</p>
                      </div>
                      <span className="text-xs font-bold text-seedtag-coral">{row.attention_score.toFixed(0)}%</span>
                      <input
                        type="number"
                        min={0} max={100} step={0.1}
                        placeholder="—"
                        value={postData[row.request_id]?.viewability ?? ''}
                        onChange={(e) => updatePost(row.request_id, 'viewability', e.target.value)}
                        className="w-[74px] rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-seedtag-coral/40"
                      />
                      <input
                        type="number"
                        min={0} max={100} step={0.01}
                        placeholder="—"
                        value={postData[row.request_id]?.ctr ?? ''}
                        onChange={(e) => updatePost(row.request_id, 'ctr', e.target.value)}
                        className="w-[74px] rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-seedtag-coral/40"
                      />
                      <div className="flex items-center">
                        {calibration === 'none' && <span className="text-[10px] text-gray-600">—</span>}
                        {calibration === 'good' && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-emerald-400/10 border border-emerald-400/20 text-[9px] font-bold text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                            Aligned
                          </span>
                        )}
                        {calibration === 'off' && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-red-400/10 border border-red-400/20 text-[9px] font-bold text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block" />
                            Off
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Calibration summary */}
              {(() => {
                const withData = postRows.filter(r => r.calibration !== 'none')
                if (withData.length < 2) return (
                  <p className="text-[11px] text-gray-600 text-center py-2">
                    Enter metrics for at least 2 runs to see calibration summary.
                  </p>
                )
                const good = withData.filter(r => r.calibration === 'good').length
                const pct = (good / withData.length) * 100
                return (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Model Calibration</p>
                      <p className="text-2xl font-bold text-white">{pct.toFixed(0)}%</p>
                      <p className="text-[10px] text-gray-600">{good} of {withData.length} runs aligned</p>
                    </div>
                    <div className="h-14 w-14 rounded-full flex items-center justify-center border-2"
                      style={{ borderColor: pct >= 70 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#f87171' }}>
                      <span className="text-xs font-bold" style={{ color: pct >= 70 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#f87171' }}>
                        {pct >= 70 ? 'Good' : pct >= 50 ? 'OK' : 'Low'}
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}

    </div>
  )
}
