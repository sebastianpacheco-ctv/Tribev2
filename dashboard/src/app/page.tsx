'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Brain,
  BarChart3,
  Settings,
  Download,
  Zap,
  Eye,
  Layers,
  TrendingUp,
  Target,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Check,
  X,
  CircleDashed,
  Info,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  StickyNote,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import BrainViewer from '@/components/BrainViewer'
import VideoCortex, { type TimelineMarker } from '@/components/VideoCortex'

const DIAGNOSTICS_API_BASE =
  process.env.NEXT_PUBLIC_TRIBE_API_BASE_URL ?? 'http://localhost:8000/api/v1/diagnostics'

type BrainRegionKey = 'frontal' | 'temporal' | 'visual' | 'all'
type DashboardSection = 'diagnostics' | 'insights' | 'registry' | 'config'

interface UploadResponse {
  request_id: string
  filename: string
  status: string
  message: string
}

interface DiagnosticResult {
  request_id: string
  timestamp: string
  ai_automated: {
    spelling_grammar_passed: boolean
    cta_present: boolean
    logo_visible: boolean
    safe_zones_passed: boolean
    resolution_passed: boolean
    qr_code_scannable: boolean | null
  }
  hybrid_flags: {
    pacing_warnings: string[]
    transition_warnings: string[]
    brand_voice_score: number
  }
  attention_score: number
  neural_resonance: number
  region_activations: Record<string, number>
  prediction_confidence: number
  sensory_load: number
  frames_analyzed: number
  frame_insights: FrameInsight[]
  actionable_steps: ActionableStep[]
  final_decision: {
    strategy_category: string
    approved: boolean
    revisions_required: boolean
  }
}

interface ActionableStep {
  priority: string
  title: string
  rationale: string
  frame_range: string
}

interface FrameInsight {
  frame_index: number
  timestamp_seconds: number
  dominant_region: string
  attention_score: number
  emotional_response: number
  sensory_load: number
  cognitive_response: string
  recommendation: string
}

type HybridReviewKey = 'brandVoice' | 'pacing' | 'transitions'
type ReviewDecision = 'confirmed' | 'rejected'
type AnalysisDepth = 'quick' | 'standard' | 'deep'
type MarkerDecision = 'ok' | 'flagged'

interface FrameMarker {
  frameIndex: number
  timestampSeconds: number
  type: 'low-attention' | 'high-load'
  attentionScore: number
  sensoryLoad: number
  recommendation: string
  cognitiveResponse: string
}

const RESULT_EXPLAINERS = {
  attention:
    'Predicted ability of the frame sequence to hold focused attention. Higher scores mean the creative is more likely to be noticed and encoded.',
  resonance:
    'Estimated emotional and sensory resonance from visual contrast, color, motion and complexity. It is predictive, not a clinical measurement.',
  strategy:
    'The inferred creative strategy category used to interpret the diagnostic: Eye-Catching, Storytelling or Clever Concept.',
  finalGate:
    'Final QA gate combining automated checks, predicted attention, confidence, pacing and hybrid review signals.',
  actionable:
    'Prioritized edit recommendations. Each item includes why it matters and where in the creative to look.',
  automated:
    'Objective QA checks inferred from the video signal, such as CTA presence, logo visibility, resolution and QR readability.',
  hybrid:
    'Human-in-the-loop review area for judgment calls like brand voice, pacing and transitions.',
  neural:
    'Predicted cortical-style region activations derived from frame-level visual features.',
  brainMap:
    'Schematic cortical map showing the currently active predicted region. This approximates the model output visually; it is not a medical brain scan.',
  frameResponse:
    'Frame-by-frame predicted human response with timestamp, attention level and recommended edit action.',
  registry:
    'Operational record for the current creative: upload state, analysis state, request ID and sample actions.',
  config:
    'Runtime settings for local endpoints and frame sampling depth.',
}

interface AutomatedCheckItem {
  label: string
  passed: boolean | null
}

interface HybridReviewItem {
  id: HybridReviewKey
  label: string
  value: string
  detail: string
  needsAttention: boolean
  icon: LucideIcon
}

function formatRatio(value: number, precision = 1) {
  return `${(value * 100).toFixed(precision)}%`
}

function getRegionLabel(regionKey: BrainRegionKey) {
  if (regionKey === 'frontal') return 'Prefrontal Attention'
  if (regionKey === 'temporal') return 'Temporal Audio'
  if (regionKey === 'visual') return 'Visual Cortex'
  return 'Whole Brain'
}

function getPrimaryRegion(activations?: Record<string, number>): BrainRegionKey {
  if (!activations) {
    return 'all'
  }

  const ordered: Array<{ key: BrainRegionKey; value: number }> = [
    { key: 'frontal', value: activations['Prefrontal Cortex (Attention)'] ?? 0 },
    { key: 'temporal', value: activations['Auditory Cortex (Temporal)'] ?? 0 },
    { key: 'visual', value: activations['Visual Cortex (V1-V4)'] ?? 0 },
  ]

  return ordered.sort((left, right) => right.value - left.value)[0]?.key ?? 'all'
}

function buildNeuralLog(result: DiagnosticResult | null) {
  if (!result) {
    return [
      'Upload a video to begin live cortical analysis.',
      'NeuralSeed will extract frames and score creative resonance.',
      'Gemini-generated hybrid flags will appear here after inference.',
      'Export becomes available once the final diagnostic JSON is ready.',
    ]
  }

  const lines = [
    `Final decision: ${result.final_decision.approved ? 'Approved' : 'Revisions required'} under ${result.final_decision.strategy_category}.`,
    `Brand voice alignment scored ${(result.hybrid_flags.brand_voice_score * 100).toFixed(1)}%.`,
    `Automated checks: CTA ${result.ai_automated.cta_present ? 'detected' : 'not detected'}, logo ${result.ai_automated.logo_visible ? 'visible' : 'uncertain'}.`,
    `Sensory load registered at ${(result.sensory_load * 100).toFixed(1)} across ${result.frames_analyzed} analyzed frames.`,
  ]

  const pacingWarning = result.hybrid_flags.pacing_warnings[0]
  const transitionWarning = result.hybrid_flags.transition_warnings[0]

  if (pacingWarning) {
    lines[2] = `Pacing warning: ${pacingWarning}`
  }

  if (transitionWarning) {
    lines[3] = `Transition warning: ${transitionWarning}`
  }

  return lines
}

function getFrameBudgetLabel(depth: AnalysisDepth, frameRate: number) {
  if (depth === 'quick') {
    return `${frameRate} fps quick pass`
  }
  if (depth === 'deep') {
    return `${frameRate} fps deep pass`
  }
  return `${frameRate} fps standard pass`
}

function buildAutomatedChecks(result: DiagnosticResult | null): AutomatedCheckItem[] {
  const flags = result?.ai_automated

  return [
    { label: 'Spelling + Grammar', passed: flags?.spelling_grammar_passed ?? null },
    { label: 'CTA Present', passed: flags?.cta_present ?? null },
    { label: 'Logo Visible', passed: flags?.logo_visible ?? null },
    { label: 'Safe Zones', passed: flags?.safe_zones_passed ?? null },
    { label: 'Resolution', passed: flags?.resolution_passed ?? null },
    { label: 'QR Code', passed: flags?.qr_code_scannable ?? null },
  ]
}

function getAutomatedCheckExplanation(label: string) {
  const explanations: Record<string, string> = {
    'Spelling + Grammar': 'Checks whether the creative appears safe from obvious copy quality issues. Full OCR review should be added for production.',
    'CTA Present': 'Detects whether the video has enough visual evidence for a clear call to action or final conversion cue.',
    'Logo Visible': 'Estimates whether brand presence is visually salient enough to be remembered.',
    'Safe Zones': 'Checks whether key elements are likely to remain inside CTV-safe visible areas.',
    Resolution: 'Confirms the analyzed frames have enough resolution for reliable QA scoring.',
    'QR Code': 'Estimates whether QR-like detail has enough contrast to be scannable.',
  }

  return explanations[label] ?? RESULT_EXPLAINERS.automated
}

function buildHybridReviewItems(result: DiagnosticResult | null): HybridReviewItem[] {
  const brandVoiceScore = result?.hybrid_flags.brand_voice_score ?? 0
  const pacingWarnings = result?.hybrid_flags.pacing_warnings ?? []
  const transitionWarnings = result?.hybrid_flags.transition_warnings ?? []

  return [
    {
      id: 'brandVoice',
      label: 'Brand Voice',
      value: result ? formatRatio(brandVoiceScore) : 'Pending',
      detail: result ? 'Strategic fit check' : 'Awaiting diagnostic',
      needsAttention: result ? brandVoiceScore < 0.7 : false,
      icon: UserCheck,
    },
    {
      id: 'pacing',
      label: 'Pacing',
      value: result ? `${pacingWarnings.length} flags` : 'Pending',
      detail: pacingWarnings[0] ?? (result ? 'No pacing warnings' : 'Awaiting diagnostic'),
      needsAttention: pacingWarnings.length > 0,
      icon: Activity,
    },
    {
      id: 'transitions',
      label: 'Transitions',
      value: result ? `${transitionWarnings.length} flags` : 'Pending',
      detail: transitionWarnings[0] ?? (result ? 'No transition warnings' : 'Awaiting diagnostic'),
      needsAttention: transitionWarnings.length > 0,
      icon: Layers,
    },
  ]
}

async function extractErrorMessage(response: Response) {
  try {
    const data = await response.json()
    if (typeof data?.detail === 'string') {
      return data.detail
    }
    if (typeof data?.message === 'string') {
      return data.message
    }
  } catch {
    return `Request failed with status ${response.status}.`
  }

  return `Request failed with status ${response.status}.`
}

function uploadVideoWithProgress(file: File, onProgress: (progress: number) => void) {
  return new Promise<UploadResponse>((resolve, reject) => {
    const payload = new FormData()
    payload.append('file', file)

    const request = new XMLHttpRequest()
    request.open('POST', `${DIAGNOSTICS_API_BASE}/upload`)
    request.responseType = 'json'

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
        return
      }

      onProgress(40)
    }

    request.onload = () => {
      const responseBody = request.response ?? {}

      if (request.status >= 200 && request.status < 300) {
        onProgress(100)
        resolve(responseBody as UploadResponse)
        return
      }

      const message =
        typeof responseBody?.detail === 'string'
          ? responseBody.detail
          : typeof responseBody?.message === 'string'
            ? responseBody.message
            : `Upload failed with status ${request.status}.`

      reject(new Error(message))
    }

    request.onerror = () => reject(new Error('Upload failed.'))
    request.onabort = () => reject(new Error('Upload was cancelled.'))

    onProgress(2)
    request.send(payload)
  })
}

function getReviewDecisionLabel(decision?: ReviewDecision) {
  if (decision === 'confirmed') return 'Confirmed'
  if (decision === 'rejected') return 'Rejected'
  return 'Pending human review'
}

async function createDiagnosticPdf(
  result: DiagnosticResult,
  reviewDecisions: Partial<Record<HybridReviewKey, ReviewDecision>>
) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const pageBottom = pageHeight - margin
  const coral: [number, number, number] = [232, 93, 100]
  const dark: [number, number, number] = [22, 22, 24]
  const muted: [number, number, number] = [110, 116, 128]
  const light: [number, number, number] = [248, 248, 248]

  const addHeader = (title: string, subtitle?: string) => {
    doc.setFillColor(...dark)
    doc.rect(0, 0, pageWidth, 28, 'F')
    doc.setTextColor(...light)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(title, margin, 13)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(210, 210, 210)
    doc.text(subtitle ?? `Request ${result.request_id}`, margin, 21)
    doc.setDrawColor(...coral)
    doc.setLineWidth(1.2)
    doc.line(margin, 27.5, pageWidth - margin, 27.5)
    doc.setTextColor(...dark)
  }

  const addSectionTitle = (title: string, y: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...dark)
    doc.text(title, margin, y)
    doc.setDrawColor(...coral)
    doc.setLineWidth(0.4)
    doc.line(margin, y + 2, pageWidth - margin, y + 2)
  }

  const addMetricCard = (x: number, y: number, width: number, label: string, value: string, note: string) => {
    doc.setFillColor(250, 250, 250)
    doc.setDrawColor(224, 224, 224)
    doc.roundedRect(x, y, width, 27, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(label.toUpperCase(), x + 4, y + 7)
    doc.setTextColor(...dark)
    doc.setFontSize(15)
    doc.text(value, x + 4, y + 17)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(doc.splitTextToSize(note, width - 8), x + 4, y + 23)
  }

  addHeader('NeuralSeed Creative Diagnostics', 'Predictive human response and CTV QA report')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...dark)
  doc.text(result.final_decision.approved ? 'Approved' : 'Revisions Required', margin, 47)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text(`Strategy: ${result.final_decision.strategy_category}`, margin, 56)
  doc.text(`Generated: ${new Date(result.timestamp).toLocaleString()}`, margin, 63)

  const cardWidth = (pageWidth - margin * 2 - 8) / 3
  addMetricCard(margin, 76, cardWidth, 'Attention', `${result.attention_score.toFixed(1)}%`, 'Predicted focus')
  addMetricCard(margin + cardWidth + 4, 76, cardWidth, 'Resonance', result.neural_resonance.toFixed(2), 'Emotional index')
  addMetricCard(margin + cardWidth * 2 + 8, 76, cardWidth, 'Confidence', formatRatio(result.prediction_confidence), `${result.frames_analyzed} frames`)

  addSectionTitle('Cortical Activation Map', 118)
  const activationMap = [
    ['Prefrontal', result.region_activations['Prefrontal Cortex (Attention)'] ?? 0, 67, 139, 23, 13, coral],
    ['Visual', result.region_activations['Visual Cortex (V1-V4)'] ?? 0, 128, 142, 25, 14, [110, 231, 183] as [number, number, number]],
    ['Temporal', result.region_activations['Auditory Cortex (Temporal)'] ?? 0, 96, 154, 30, 10, [96, 165, 250] as [number, number, number]],
    ['Amygdala', result.region_activations['Amygdala (Emotional)'] ?? 0, 106, 146, 10, 10, [251, 191, 36] as [number, number, number]],
  ] as const
  doc.setDrawColor(210, 210, 210)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, 127, pageWidth - margin * 2, 38, 2, 2, 'FD')
  doc.setDrawColor(190, 190, 190)
  doc.setFillColor(235, 235, 235)
  doc.ellipse(105, 146, 60, 22, 'FD')
  activationMap.forEach(([, value, x, y, rx, ry, color]) => {
    const intensity = Math.max(0.18, Math.min(0.92, value))
    const blended = color.map((channel) => Math.round(channel * intensity + 235 * (1 - intensity))) as [number, number, number]
    doc.setFillColor(...blended)
    doc.ellipse(x, y, rx, ry, 'F')
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...muted)
  doc.text('Schematic predicted activation map. Not a clinical scan.', margin + 82, 134)
  activationMap.forEach(([label, value], index) => {
    doc.text(`${label}: ${(value * 100).toFixed(1)}%`, margin + 82, 143 + index * 5)
  })

  addSectionTitle('Executive Summary', 182)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...dark)
  const summary = [
    `Final gate: ${result.final_decision.approved ? 'Approved' : 'Revisions required'}.`,
    `Sensory load: ${(result.sensory_load * 100).toFixed(1)}%. Brand voice score: ${formatRatio(result.hybrid_flags.brand_voice_score)}.`,
    `Automated checks passed: ${Object.values(result.ai_automated).filter(Boolean).length}/6.`,
    `Pacing warnings: ${result.hybrid_flags.pacing_warnings.join('; ') || 'None'}.`,
    `Transition warnings: ${result.hybrid_flags.transition_warnings.join('; ') || 'None'}.`,
  ]
  let cursorY = 193
  summary.forEach((line) => {
    doc.text(doc.splitTextToSize(line, pageWidth - margin * 2), margin, cursorY)
    cursorY += 7
  })

  const humanReviewRows = buildHybridReviewItems(result)
  const getHumanReviewRowHeight = (item: HybridReviewItem) => {
    const detailLines = doc
      .splitTextToSize(`${item.value} - ${item.detail}`, pageWidth - margin * 2 - 8)
      .slice(0, 2)
    return detailLines.length > 1 ? 25 : 18
  }
  const humanReviewSectionHeight = humanReviewRows.reduce(
    (height, item) => height + getHumanReviewRowHeight(item) + 4,
    20,
  )

  if (cursorY + 8 + humanReviewSectionHeight > pageBottom) {
    doc.addPage()
    addHeader('Human Hybrid Review', 'Human-in-the-loop review decisions')
    addSectionTitle('Human Hybrid Review', 42)
    cursorY = 54
  } else {
    addSectionTitle('Human Hybrid Review', cursorY + 8)
    cursorY += 20
  }

  humanReviewRows.forEach((item) => {
    const decision = reviewDecisions[item.id]
    const status = getReviewDecisionLabel(decision)
    const detailLines = doc
      .splitTextToSize(`${item.value} - ${item.detail}`, pageWidth - margin * 2 - 8)
      .slice(0, 2)
    const boxHeight = detailLines.length > 1 ? 25 : 18
    const statusColor: [number, number, number] =
      decision === 'confirmed'
        ? [22, 163, 74]
        : decision === 'rejected'
          ? [220, 38, 38]
          : muted

    if (cursorY + boxHeight > pageBottom) {
      doc.addPage()
      addHeader('Human Hybrid Review', 'Human-in-the-loop review decisions')
      addSectionTitle('Human Hybrid Review', 42)
      cursorY = 54
    }

    doc.setFillColor(250, 250, 250)
    doc.setDrawColor(224, 224, 224)
    doc.roundedRect(margin, cursorY - 6, pageWidth - margin * 2, boxHeight, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...dark)
    doc.text(item.label, margin + 4, cursorY)
    doc.setTextColor(...statusColor)
    doc.text(status, pageWidth - margin - 4, cursorY, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(detailLines, margin + 4, cursorY + 7)
    cursorY += boxHeight + 4
  })

  doc.addPage()
  addHeader('Action Plan', 'Prioritized edit recommendations')
  addSectionTitle('Actionable Steps', 42)
  cursorY = 53
  result.actionable_steps.forEach((step, index) => {
    const boxHeight = 24
    doc.setFillColor(255, 248, 248)
    doc.setDrawColor(238, 190, 194)
    doc.roundedRect(margin, cursorY - 6, pageWidth - margin * 2, boxHeight, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...coral)
    doc.text(`${index + 1}. ${step.priority} - ${step.frame_range}`, margin + 4, cursorY)
    doc.setFontSize(9)
    doc.setTextColor(...dark)
    doc.text(doc.splitTextToSize(step.title, pageWidth - margin * 2 - 8), margin + 4, cursorY + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...muted)
    doc.text(doc.splitTextToSize(step.rationale, pageWidth - margin * 2 - 8), margin + 4, cursorY + 12)
    cursorY += boxHeight + 4
  })

  doc.addPage()
  addHeader('Frame-Level Predicted Response')
  addSectionTitle('Top Frame Diagnostics', 42)
  cursorY = 54

  doc.setFillColor(...dark)
  doc.rect(margin, cursorY - 6, pageWidth - margin * 2, 9, 'F')
  doc.setTextColor(...light)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('TIME', margin + 3, cursorY)
  doc.text('ATTN', margin + 24, cursorY)
  doc.text('REGION', margin + 46, cursorY)
  doc.text('RESPONSE / RECOMMENDATION', margin + 92, cursorY)
  cursorY += 8

  result.frame_insights.slice(0, 18).forEach((frame, index) => {
    if (cursorY > 270) {
      doc.addPage()
      addHeader('Frame-Level Predicted Response')
      cursorY = 42
    }
    const rowHeight = 16
    doc.setFillColor(index % 2 === 0 ? 250 : 244, index % 2 === 0 ? 250 : 244, index % 2 === 0 ? 250 : 244)
    doc.rect(margin, cursorY - 6, pageWidth - margin * 2, rowHeight, 'F')
    doc.setTextColor(...dark)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(`${frame.timestamp_seconds.toFixed(1)}s`, margin + 3, cursorY)
    doc.text(`${frame.attention_score.toFixed(0)}%`, margin + 24, cursorY)
    doc.text(doc.splitTextToSize(frame.dominant_region.replace(' Cortex', ''), 42), margin + 46, cursorY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...muted)
    doc.text(doc.splitTextToSize(`${frame.cognitive_response} ${frame.recommendation}`, 86), margin + 92, cursorY)
    cursorY += rowHeight
  })

  doc.save(`neuralseed-report-${result.request_id}.pdf`)
}

const SidebarItem = ({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all ${
    active ? 'bg-seedtag-coral text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
  }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
)

const InfoTip = ({ text }: { text: string }) => (
  <span className="group/tip relative inline-flex" title={text}>
    <Info size={13} className="cursor-help text-gray-500 transition-colors group-hover/tip:text-seedtag-coral" />
    <span className="pointer-events-none absolute right-0 top-5 z-50 w-64 rounded-lg border border-white/10 bg-[#111] p-3 text-[11px] font-medium leading-relaxed text-gray-200 opacity-0 shadow-2xl shadow-black/40 transition-opacity group-hover/tip:opacity-100">
      {text}
    </span>
  </span>
)

const SectionHeading = ({ title, info, badge }: { title: string; info: string; badge?: ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2">
      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</h4>
      <InfoTip text={info} />
    </div>
    {badge}
  </div>
)

const StatCard = ({
  title,
  value,
  unit,
  trend,
  icon: Icon,
  info,
}: {
  title: string
  value: string
  unit: string
  trend?: string
  icon?: LucideIcon
  info: string
}) => (
  <div className="glass-card p-5 relative overflow-visible group">
    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
       {Icon && <Icon size={40} className="text-seedtag-coral" />}
    </div>
    <div className="mb-1 flex items-center gap-2">
      <p className="text-sm text-gray-400">{title}</p>
      <InfoTip text={info} />
    </div>
    <div className="flex items-baseline gap-2">
      <h3 className="text-2xl font-bold">{value}</h3>
      <span className="text-gray-500 text-sm font-medium">{unit}</span>
    </div>
    {trend && (
      <p className="text-xs mt-2 text-seedtag-coral font-medium flex items-center gap-1">
        <Activity size={12} /> {trend}
      </p>
    )}
  </div>
)

function BrainActivationMap({
  activeRegion,
  activationLevel,
  activations,
}: {
  activeRegion: BrainRegionKey
  activationLevel: number
  activations?: Record<string, number>
}) {
  const regionValues = {
    visual: activations?.['Visual Cortex (V1-V4)'] ?? (activeRegion === 'visual' || activeRegion === 'all' ? activationLevel : 0.22),
    temporal: activations?.['Auditory Cortex (Temporal)'] ?? (activeRegion === 'temporal' || activeRegion === 'all' ? activationLevel : 0.2),
    frontal: activations?.['Prefrontal Cortex (Attention)'] ?? (activeRegion === 'frontal' || activeRegion === 'all' ? activationLevel : 0.24),
    emotional: activations?.['Amygdala (Emotional)'] ?? activationLevel * 0.8,
  }

  const regionOpacity = (key: keyof typeof regionValues) => {
    if (activeRegion === 'all') {
      return 0.25 + regionValues[key] * 0.65
    }
    if (
      (activeRegion === 'visual' && key === 'visual') ||
      (activeRegion === 'temporal' && key === 'temporal') ||
      (activeRegion === 'frontal' && key === 'frontal')
    ) {
      return 0.95
    }
    return 0.24
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <SectionHeading
        title="Cortical Activation Map"
        info={RESULT_EXPLAINERS.brainMap}
        badge={
          <span className="rounded border border-seedtag-coral/20 bg-seedtag-coral/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-seedtag-coral">
            {getRegionLabel(activeRegion)}
          </span>
        }
      />
      <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3">
        <svg viewBox="0 0 320 190" className="h-44 w-full" role="img" aria-label="Predicted cortical activation map">
          <defs>
            <filter id="regionGlow">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M70 105C58 72 82 38 119 32c20-22 58-16 70 4 34-2 58 20 62 50 22 13 24 50 3 70-18 18-48 20-70 8-20 15-58 13-75-5-25 5-52-12-55-36-2-7 0-13 16-18Z"
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="3"
          />
          <ellipse
            cx="112"
            cy="72"
            rx="47"
            ry="31"
            fill="#E85D64"
            opacity={regionOpacity('frontal')}
            filter="url(#regionGlow)"
          />
          <ellipse
            cx="207"
            cy="88"
            rx="49"
            ry="34"
            fill="#6EE7B7"
            opacity={regionOpacity('visual')}
            filter="url(#regionGlow)"
          />
          <ellipse
            cx="150"
            cy="132"
            rx="57"
            ry="28"
            fill="#60A5FA"
            opacity={regionOpacity('temporal')}
            filter="url(#regionGlow)"
          />
          <circle
            cx="169"
            cy="108"
            r="20"
            fill="#FBBF24"
            opacity={0.25 + regionValues.emotional * 0.65}
            filter="url(#regionGlow)"
          />
          <text x="77" y="26" fill="rgba(255,255,255,0.72)" fontSize="11" fontWeight="700">Prefrontal</text>
          <text x="222" y="45" fill="rgba(255,255,255,0.72)" fontSize="11" fontWeight="700">Visual</text>
          <text x="111" y="178" fill="rgba(255,255,255,0.72)" fontSize="11" fontWeight="700">Temporal</text>
          <text x="183" y="116" fill="rgba(255,255,255,0.72)" fontSize="10" fontWeight="700">Amygdala</text>
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          ['Visual', regionValues.visual],
          ['Temporal', regionValues.temporal],
          ['Prefrontal', regionValues.frontal],
          ['Emotional', regionValues.emotional],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{label as string}</p>
            <p className="mt-1 text-xs font-bold text-white">{((value as number) * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const [activation, setActivation] = useState(0.4)
  const [region, setRegion] = useState<BrainRegionKey>('all')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<DashboardSection>('diagnostics')
  const [voxelMode, setVoxelMode] = useState(false)
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>('standard')
  const [frameRate, setFrameRate] = useState(2)
  const [reviewDecisions, setReviewDecisions] = useState<Partial<Record<HybridReviewKey, ReviewDecision>>>({})
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null)
  const [markerDecisions, setMarkerDecisions] = useState<Record<number, MarkerDecision>>({})
  const [markerNotes, setMarkerNotes] = useState<Record<number, string>>({})
  const [videoSeekTarget, setVideoSeekTarget] = useState<number | null>(null)
  const [gateExpanded, setGateExpanded] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  useEffect(() => {
    if (!isAnalyzing) {
      return
    }

    const timer = window.setInterval(() => {
      setAnalysisProgress((current) => {
        if (current >= 92) {
          return current
        }

        const increment = current < 35 ? 6 : current < 70 ? 3.5 : 1.25
        return Math.min(92, current + increment)
      })
    }, 450)

    return () => window.clearInterval(timer)
  }, [isAnalyzing])

  const orderedRegions = useMemo(() => {
    if (!diagnosticResult) {
      return ['visual', 'temporal', 'frontal'] as BrainRegionKey[]
    }

    const mapped: Array<{ key: BrainRegionKey; value: number }> = [
      { key: 'visual', value: diagnosticResult.region_activations['Visual Cortex (V1-V4)'] ?? 0 },
      { key: 'temporal', value: diagnosticResult.region_activations['Auditory Cortex (Temporal)'] ?? 0 },
      { key: 'frontal', value: diagnosticResult.region_activations['Prefrontal Cortex (Attention)'] ?? 0 },
    ]

    return mapped.sort((left, right) => right.value - left.value).map((entry) => entry.key)
  }, [diagnosticResult])

  const automatedChecks = useMemo(() => buildAutomatedChecks(diagnosticResult), [diagnosticResult])
  const hybridReviewItems = useMemo(() => buildHybridReviewItems(diagnosticResult), [diagnosticResult])

  const frameMarkers = useMemo((): FrameMarker[] => {
    if (!diagnosticResult) return []
    return diagnosticResult.frame_insights
      .filter((f) => f.attention_score < 75 || f.sensory_load >= 0.45)
      .map((f) => ({
        frameIndex: f.frame_index,
        timestampSeconds: f.timestamp_seconds,
        type: (f.attention_score < 75 ? 'low-attention' : 'high-load') as 'low-attention' | 'high-load',
        attentionScore: f.attention_score,
        sensoryLoad: f.sensory_load,
        recommendation: f.recommendation,
        cognitiveResponse: f.cognitive_response,
      }))
  }, [diagnosticResult])

  const timelineMarkers = useMemo((): TimelineMarker[] =>
    frameMarkers.map((m) => ({ frameIndex: m.frameIndex, timestampSeconds: m.timestampSeconds, type: m.type })),
    [frameMarkers]
  )

  const reviewSummary = useMemo(() => {
    const decisions = Object.values(reviewDecisions)

    return {
      confirmed: decisions.filter((decision) => decision === 'confirmed').length,
      rejected: decisions.filter((decision) => decision === 'rejected').length,
    }
  }, [reviewDecisions])

  const regionMetrics = useMemo(() => {
    if (!diagnosticResult) {
      return [
        { name: 'Visual (V1)', value: activation * 90 + 10, key: 'visual' as BrainRegionKey },
        { name: 'Temporal (Audio)', value: activation * 75 + 12, key: 'temporal' as BrainRegionKey },
        { name: 'Frontal (Attention)', value: activation * 85 + 8, key: 'frontal' as BrainRegionKey },
      ]
    }

    return [
      {
        name: 'Visual (V1)',
        value: (diagnosticResult.region_activations['Visual Cortex (V1-V4)'] ?? 0) * 100,
        key: 'visual' as BrainRegionKey,
      },
      {
        name: 'Temporal (Audio)',
        value: (diagnosticResult.region_activations['Auditory Cortex (Temporal)'] ?? 0) * 100,
        key: 'temporal' as BrainRegionKey,
      },
      {
        name: 'Frontal (Attention)',
        value: (diagnosticResult.region_activations['Prefrontal Cortex (Attention)'] ?? 0) * 100,
        key: 'frontal' as BrainRegionKey,
      },
    ]
  }, [activation, diagnosticResult])

  const sectionMeta = useMemo(() => {
    const metadata: Record<DashboardSection, { title: string; eyebrow: string; panelTitle: string; icon: LucideIcon }> = {
      diagnostics: {
        title: 'Visual Cortex Analysis',
        eyebrow: 'Creative QA workspace',
        panelTitle: 'Scorecard QA',
        icon: ShieldCheck,
      },
      insights: {
        title: 'Neural Insight Console',
        eyebrow: 'Region signals and model log',
        panelTitle: 'Neural Insights',
        icon: BarChart3,
      },
      registry: {
        title: 'Sample Registry',
        eyebrow: 'Upload and analysis state',
        panelTitle: 'Sample Registry',
        icon: Layers,
      },
      config: {
        title: 'System Config',
        eyebrow: 'Runtime and endpoint controls',
        panelTitle: 'System Config',
        icon: Settings,
      },
    }

    return metadata[activeSection]
  }, [activeSection])

  const selectFile = (file: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setUploadResult(null)
    setDiagnosticResult(null)
    setErrorMessage(null)
    setInfoMessage('Creative loaded locally. Upload it to enable engine analysis.')
    setUploadProgress(0)
    setAnalysisProgress(0)
    setActivation(0.32)
    setRegion('all')
    setReviewDecisions({})
  }

  const uploadVideo = async () => {
    if (!selectedFile) {
      setErrorMessage('Select a video file before uploading.')
      return null
    }

    setIsUploading(true)
    setUploadProgress(0)
    setErrorMessage(null)
    setInfoMessage(null)

    try {
      const data = await uploadVideoWithProgress(selectedFile, setUploadProgress)
      setUploadResult(data)
      setInfoMessage('Upload complete. Run diagnostic to generate the QA scorecard.')
      return data
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed.')
      setUploadProgress(0)
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const analyzeCreative = async () => {
    setErrorMessage(null)
    setInfoMessage(null)

    const currentUpload = uploadResult ?? (await uploadVideo())
    if (!currentUpload) {
      return
    }

    setIsAnalyzing(true)
    setAnalysisProgress(8)

    try {
      const response = await fetch(`${DIAGNOSTICS_API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: currentUpload.request_id,
          frame_rate: frameRate,
          analysis_depth: analysisDepth,
        }),
      })

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response))
      }

      const data = (await response.json()) as DiagnosticResult
      setDiagnosticResult(data)
      setReviewDecisions({})
      setAnalysisProgress(100)
      setActiveSection('diagnostics')
      setInfoMessage('Diagnostic complete. Automated and hybrid review checks are ready.')
      setActivation(Math.max(0.18, Math.min(1, data.attention_score / 100)))
      setRegion(getPrimaryRegion(data.region_activations))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Analysis failed.')
      setAnalysisProgress(0)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const exportReport = async () => {
    if (!diagnosticResult) {
      setErrorMessage('Run an analysis before exporting the report.')
      return
    }

    setErrorMessage(null)
    setInfoMessage('Preparing PDF export.')
    await createDiagnosticPdf(diagnosticResult, reviewDecisions)
    setInfoMessage('PDF report exported.')
  }

  const setHybridDecision = (id: HybridReviewKey, decision: ReviewDecision) => {
    setReviewDecisions((current) => ({
      ...current,
      [id]: decision,
    }))
    setInfoMessage(`${decision === 'confirmed' ? 'Confirmed' : 'Rejected'} ${id.replace(/([A-Z])/g, ' $1').toLowerCase()} review.`)
  }

  const handleMarkerClick = (frameIndex: number, timestampSeconds: number) => {
    setActiveMarkerIndex(frameIndex)
    setVideoSeekTarget(timestampSeconds)
  }

  const navigateMarker = (direction: 'prev' | 'next') => {
    if (!frameMarkers.length) return
    if (activeMarkerIndex === null) {
      const first = frameMarkers[0]
      setActiveMarkerIndex(first.frameIndex)
      setVideoSeekTarget(first.timestampSeconds)
      return
    }
    const currentIdx = frameMarkers.findIndex((m) => m.frameIndex === activeMarkerIndex)
    const nextIdx = direction === 'next'
      ? Math.min(frameMarkers.length - 1, currentIdx + 1)
      : Math.max(0, currentIdx - 1)
    const next = frameMarkers[nextIdx]
    setActiveMarkerIndex(next.frameIndex)
    setVideoSeekTarget(next.timestampSeconds)
  }

  const setMarkerDecision = (frameIndex: number, decision: MarkerDecision) => {
    setMarkerDecisions((current) => ({ ...current, [frameIndex]: decision }))
  }

  const openSection = (section: DashboardSection) => {
    setActiveSection(section)
    setErrorMessage(null)
    setInfoMessage(null)
  }

  const openVoxelView = () => {
    setVoxelMode((current) => !current)
    setActiveSection('insights')
    setRegion('all')
    setActivation((current) => Math.max(current, 0.62))
    setInfoMessage('Voxel view is active. Use the 3D canvas to inspect cortical activation.')
  }

  const setAnalysisProfile = (depth: AnalysisDepth, nextFrameRate: number) => {
    setAnalysisDepth(depth)
    setFrameRate(nextFrameRate)
    setInfoMessage(`Analysis profile set to ${getFrameBudgetLabel(depth, nextFrameRate)}.`)
  }

  const resetSession = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadResult(null)
    setDiagnosticResult(null)
    setIsUploading(false)
    setIsAnalyzing(false)
    setUploadProgress(0)
    setAnalysisProgress(0)
    setErrorMessage(null)
    setInfoMessage('Session cleared. Select a new creative to start again.')
    setReviewDecisions({})
    setActiveMarkerIndex(null)
    setMarkerDecisions({})
    setMarkerNotes({})
    setVideoSeekTarget(null)
    setGateExpanded(false)
    setActivation(0.4)
    setRegion('all')
    setVoxelMode(false)
  }

  const handleTimeUpdate = (progress: number) => {
    if (!diagnosticResult) {
      const nextActivation = 0.3 + Math.sin(progress / 6) * 0.2
      setActivation(Math.max(0.15, Math.min(0.85, nextActivation)))

      if (progress < 33) setRegion('visual')
      else if (progress < 66) setRegion('temporal')
      else if (progress < 99) setRegion('frontal')
      else setRegion('all')
      return
    }

    const baseActivation = diagnosticResult.attention_score / 100
    const wave = Math.sin(progress / 10) * 0.08
    setActivation(Math.max(0.18, Math.min(1, baseActivation * 0.85 + wave)))

    const regionIndex = Math.min(
      orderedRegions.length - 1,
      Math.floor((progress / 100) * orderedRegions.length)
    )
    setRegion(orderedRegions[regionIndex] ?? getPrimaryRegion(diagnosticResult.region_activations))
  }

  const PanelIcon = sectionMeta.icon

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-black selection:bg-seedtag-coral/30">
      <BrainViewer activationLevel={activation} activeRegion={region} />

      <div className="ui-layer flex w-full h-full">
        <motion.aside 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-64 glass-panel m-4 flex flex-col p-6 h-[calc(100vh-32px)] border-white/5"
        >
          <div className="flex items-center gap-2 mb-10 px-2 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 bg-seedtag-coral rounded-xl flex items-center justify-center shadow-lg shadow-seedtag-coral/20">
              <Brain size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-none">Neural<span className="text-seedtag-coral">Seed</span></h1>
              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-1 block">Predictive Foundation</span>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            <SidebarItem
              icon={Activity}
              label="Diagnostics"
              active={activeSection === 'diagnostics'}
              onClick={() => openSection('diagnostics')}
            />
            <SidebarItem
              icon={BarChart3}
              label="Neural Insights"
              active={activeSection === 'insights'}
              onClick={() => openSection('insights')}
            />
            <SidebarItem
              icon={Layers}
              label="Sample Registry"
              active={activeSection === 'registry'}
              onClick={() => openSection('registry')}
            />
            <SidebarItem
              icon={Settings}
              label="System Config"
              active={activeSection === 'config'}
              onClick={() => openSection('config')}
            />
          </nav>

          <div className="mt-auto">
            <div className="glass-card p-5 bg-white/[0.03] border-white/10 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Engine Status</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${diagnosticResult ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-gray-600'}`} />
                  <span className="text-xs font-bold text-gray-300">
                    {diagnosticResult ? 'Ready' : 'Idle'}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Frames analyzed</p>
                  <p className="text-2xl font-bold text-white font-mono">
                    {diagnosticResult?.frames_analyzed ?? '—'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Confidence</p>
                    <p className="text-lg font-bold text-white font-mono">
                      {diagnosticResult ? `${(diagnosticResult.prediction_confidence * 100).toFixed(0)}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Decision</p>
                    <p className={`text-lg font-bold font-mono ${
                      diagnosticResult?.final_decision.approved ? 'text-emerald-400' : diagnosticResult ? 'text-amber-400' : 'text-gray-600'
                    }`}>
                      {diagnosticResult ? (diagnosticResult.final_decision.approved ? 'Approved' : 'Revisions') : '—'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Dominant region</p>
                  <p className="text-sm font-bold text-seedtag-coral">
                    {diagnosticResult ? getRegionLabel(getPrimaryRegion(diagnosticResult.region_activations)) : '—'}
                  </p>
                </div>
              </div>
              {diagnosticResult && (
                <button
                  type="button"
                  onClick={resetSession}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                >
                  + New Creative
                </button>
              )}
            </div>
          </div>
        </motion.aside>

        <section className="flex-1 flex flex-col p-4 relative">
          <header className="flex justify-between items-center mb-6 px-4">
            <div>
              <h2 className="text-3xl font-bold text-gradient">{sectionMeta.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 text-sm">{sectionMeta.eyebrow}:</span>
                <span className="text-white text-sm font-medium">
                  {selectedFile?.name ?? 'Awaiting creative upload'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">
                  {isAnalyzing
                    ? 'Analyzing Creative'
                    : isUploading
                      ? 'Uploading Video'
                      : diagnosticResult
                        ? 'Diagnostic Complete'
                        : uploadResult
                          ? 'Upload Ready'
                          : 'Inference Ready'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => openSection('config')}
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:border-seedtag-coral/50 transition-colors"
                aria-label="Open system config"
                title="Open system config"
              >
                <Settings size={18} className="text-gray-400" />
              </button>
            </div>
          </header>

          <div className="flex-1 flex flex-col justify-center px-4 pb-2 pt-2 gap-3">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="w-[70%] mx-auto bg-black"
            >
              <VideoCortex
                onTimeUpdate={handleTimeUpdate}
                videoUrl={previewUrl}
                selectedFileName={selectedFile?.name ?? uploadResult?.filename ?? null}
                requestId={uploadResult?.request_id ?? diagnosticResult?.request_id ?? null}
                isUploading={isUploading}
                isAnalyzing={isAnalyzing}
                uploadProgress={uploadProgress}
                analysisProgress={analysisProgress}
                onSelectFile={selectFile}
                onUpload={uploadVideo}
                onAnalyze={analyzeCreative}
                canAnalyze={Boolean(uploadResult?.request_id || selectedFile)}
                isDone={Boolean(diagnosticResult)}
                onReset={resetSession}
                analysisDepth={analysisDepth}
                onDepthChange={(d) => setAnalysisProfile(d, d === 'quick' ? 1 : d === 'deep' ? 3 : 2)}
                markers={timelineMarkers}
                activeMarkerIndex={activeMarkerIndex}
                onMarkerClick={handleMarkerClick}
                seekTarget={videoSeekTarget}
              />
            </motion.div>

            {/* Marker info panel — appears below video when a marker is active */}
            <AnimatePresence>
              {activeMarkerIndex !== null && (() => {
                const m = frameMarkers.find((fm) => fm.frameIndex === activeMarkerIndex)
                if (!m) return null
                const decision = markerDecisions[m.frameIndex]
                const currentIdx = frameMarkers.findIndex((fm) => fm.frameIndex === activeMarkerIndex)
                return (
                  <motion.div
                    key={m.frameIndex}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className={`w-full rounded-xl border px-4 py-3 flex items-start gap-4 ${
                      m.type === 'low-attention'
                        ? 'border-red-400/25 bg-red-500/10'
                        : 'border-amber-400/25 bg-amber-400/10'
                    }`}
                  >
                    {/* Badge */}
                    <div className={`shrink-0 mt-0.5 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                      m.type === 'low-attention' ? 'bg-red-500/20 text-red-300' : 'bg-amber-400/20 text-amber-300'
                    }`}>
                      {m.type === 'low-attention' ? 'Low Attention' : 'High Load'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-xs font-bold text-white">{m.timestampSeconds}s</span>
                        <span className="text-[10px] text-gray-400">
                          Attention: <strong className="text-white">{m.attentionScore.toFixed(0)}</strong>
                          &nbsp;·&nbsp;Load: <strong className="text-white">{(m.sensoryLoad * 100).toFixed(0)}%</strong>
                          &nbsp;·&nbsp;{currentIdx + 1} of {frameMarkers.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 leading-snug">{m.recommendation}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => navigateMarker('prev')}
                        disabled={currentIdx <= 0}
                        className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/5 text-gray-400 transition-all hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateMarker('next')}
                        disabled={currentIdx >= frameMarkers.length - 1}
                        className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/5 text-gray-400 transition-all hover:bg-white/10 disabled:opacity-30"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <div className="w-px h-5 bg-white/10" />
                      <button
                        type="button"
                        onClick={() => setMarkerDecision(m.frameIndex, 'ok')}
                        className={`flex h-7 w-7 items-center justify-center rounded border transition-all ${
                          decision === 'ok'
                            ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-emerald-400/30 hover:text-emerald-300'
                        }`}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarkerDecision(m.frameIndex, 'flagged')}
                        className={`flex h-7 w-7 items-center justify-center rounded border transition-all ${
                          decision === 'flagged'
                            ? 'border-red-400/40 bg-red-400/20 text-red-100'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:border-red-400/30 hover:text-red-300'
                        }`}
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveMarkerIndex(null)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/5 text-gray-500 transition-all hover:text-gray-300"
                        aria-label="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </motion.div>
                )
              })()}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-4 px-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              <StatCard
                title="Attention Prediction"
                value={`${(diagnosticResult?.attention_score ?? activation * 100).toFixed(1)}`}
                unit="%"
                trend={diagnosticResult ? `${diagnosticResult.frames_analyzed} Frames` : 'Awaiting Upload'}
                icon={Target}
                info={RESULT_EXPLAINERS.attention}
              />
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
              <StatCard
                title="Neural Resonance"
                value={`${(diagnosticResult?.neural_resonance ?? 0.8 + activation * 0.2).toFixed(2)}`}
                unit="Index"
                trend={diagnosticResult ? `${(diagnosticResult.sensory_load * 100).toFixed(1)}% Load` : 'Simulated'}
                icon={Zap}
                info={RESULT_EXPLAINERS.resonance}
              />
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
              <StatCard
                title="Strategy Category"
                value={diagnosticResult?.final_decision.strategy_category ?? region.toUpperCase()}
                unit=""
                trend={diagnosticResult ? (diagnosticResult.final_decision.approved ? 'Approved' : 'Needs Revision') : 'Processing'}
                icon={Brain}
                info={RESULT_EXPLAINERS.strategy}
              />
            </motion.div>
          </div>

          {errorMessage && (
            <div className="mb-4 px-4">
              <div className="glass-card border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                {errorMessage}
              </div>
            </div>
          )}

          {infoMessage && !errorMessage && (
            <div className="mb-4 px-4">
              <div className="glass-card border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                {infoMessage}
              </div>
            </div>
          )}

          <motion.footer 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="glass-panel p-5 flex items-center justify-between border-white/5"
          >
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Model Confidence</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${((diagnosticResult?.prediction_confidence ?? 0.924) * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold">
                    {((diagnosticResult?.prediction_confidence ?? 0.924) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Stimuli Batch</span>
                <span className="text-xs font-medium text-white">
                  {diagnosticResult
                    ? `${diagnosticResult.frames_analyzed} frames @ ${frameRate} fps`
                    : getFrameBudgetLabel(analysisDepth, frameRate)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={openVoxelView}
                className={`flex items-center gap-2 px-5 py-3 border rounded-xl transition-all font-bold text-sm ${
                  voxelMode
                    ? 'border-seedtag-coral/40 bg-seedtag-coral/20 text-white'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <Eye size={16} />
                Voxel View
              </button>
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-8 py-3 bg-seedtag-coral text-white rounded-xl font-bold shadow-lg shadow-seedtag-coral/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={16} />
                Export Report
              </button>
            </div>
          </motion.footer>

        </section>

        <motion.aside 
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-[360px] glass-panel m-4 flex flex-col p-6 h-[calc(100vh-32px)] border-white/5"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold flex items-center gap-2">
              <PanelIcon size={18} className="text-seedtag-coral" />
              {sectionMeta.panelTitle}
            </h3>
            <span className="text-[10px] bg-white/5 px-2 py-1 rounded border border-white/10 text-gray-400 font-mono">
              ID: {(diagnosticResult?.request_id ?? uploadResult?.request_id ?? 'PENDING').slice(0, 8)}
            </span>
          </div>

          <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {activeSection === 'diagnostics' ? (
              <>
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
                    <div
                      key={check.label}
                      className="flex min-h-[64px] flex-col justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                    >
                      <span className="flex items-start gap-1 text-xs font-medium leading-tight text-white">
                        {check.label}
                        <InfoTip text={getAutomatedCheckExplanation(check.label)} />
                      </span>
                      <span className={`flex items-center justify-center gap-1 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${statusClass}`}>
                        {check.passed === null ? <CircleDashed size={12} /> : check.passed ? <Check size={12} /> : <X size={12} />}
                        {statusLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

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
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Frame Markers
                    </span>
                    <span className="text-[10px] font-bold text-amber-300">
                      {Object.keys(markerDecisions).length}/{frameMarkers.length} reviewed
                    </span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-red-500/80" />
                      {frameMarkers.filter((m) => m.type === 'low-attention').length} low attention
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500/80" />
                      {frameMarkers.filter((m) => m.type === 'high-load').length} high load
                    </span>
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

              {/* Hybrid review items (Brand Voice / Pacing / Transitions) */}
              <div className="space-y-2">
                {hybridReviewItems.map((item) => {
                  const Icon = item.icon
                  const decision = reviewDecisions[item.id]

                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 ${
                        item.needsAttention
                          ? 'border-amber-400/25 bg-amber-400/10'
                          : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          item.needsAttention ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-gray-300'
                        }`}>
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
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
                  )
                })}
              </div>
            </section>

            <section className="space-y-3">
              <SectionHeading title="Neural Signals" info={RESULT_EXPLAINERS.neural} />
              <div className="space-y-3">
                {regionMetrics.map((metric) => {
                  const isActive = metric.key === region || region === 'all'

                  return (
                    <div key={metric.name} className={`flex flex-col gap-2 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-45'}`}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-bold text-white">{metric.name}</span>
                        <span className="font-mono text-[11px] font-bold text-seedtag-coral">
                          {metric.value.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/5 bg-white/5 p-[1px]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(8, metric.value)}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full rounded-full ${isActive ? 'bg-seedtag-coral' : 'bg-gray-600'}`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
              </>
            ) : activeSection === 'insights' ? (
              <>
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

                <BrainActivationMap
                  activeRegion={region}
                  activationLevel={activation}
                  activations={diagnosticResult?.region_activations}
                />

                <section className="space-y-3">
                  <SectionHeading title="Region Signals" info={RESULT_EXPLAINERS.neural} />
                  <div className="space-y-3">
                    {regionMetrics.map((metric) => {
                      const isActive = metric.key === region || region === 'all'

                      return (
                        <button
                          key={metric.name}
                          type="button"
                          onClick={() => {
                            setRegion(metric.key)
                            setActivation(Math.max(0.18, Math.min(1, metric.value / 100)))
                          }}
                          className={`flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-all ${
                            isActive
                              ? 'border-seedtag-coral/35 bg-seedtag-coral/10'
                              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs font-bold text-white">{metric.name}</span>
                            <span className="font-mono text-[11px] font-bold text-seedtag-coral">
                              {metric.value.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-seedtag-coral transition-all duration-300" style={{ width: `${Math.max(8, metric.value)}%` }} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section className="space-y-3">
                  <SectionHeading
                    title="Model Log"
                    info="Short narrative interpretation of the diagnostic state, warnings and result readiness."
                  />
                  <div className="space-y-2">
                    {buildNeuralLog(diagnosticResult).map((line) => (
                      <div key={line} className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-gray-300">
                        {line}
                      </div>
                    ))}
                  </div>
                </section>

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
                    {(diagnosticResult?.frame_insights ?? []).slice(0, 10).map((frame) => (
                      <button
                        key={`${frame.frame_index}-${frame.timestamp_seconds}`}
                        type="button"
                        onClick={() => {
                          const regionKey: BrainRegionKey = frame.dominant_region.includes('Visual')
                            ? 'visual'
                            : frame.dominant_region.includes('Temporal')
                              ? 'temporal'
                              : frame.dominant_region.includes('Prefrontal')
                                ? 'frontal'
                                : 'all'
                          setRegion(regionKey)
                          setActivation(Math.max(0.18, Math.min(1, frame.attention_score / 100)))
                        }}
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
            ) : activeSection === 'registry' ? (
              <>
                <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Current Sample</p>
                    <InfoTip text={RESULT_EXPLAINERS.registry} />
                  </div>
                  <p className="mt-2 break-words text-sm font-bold text-white">
                    {selectedFile?.name ?? uploadResult?.filename ?? 'No creative selected'}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-black/20 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Upload</p>
                      <p className="mt-1 text-xs font-bold text-white">{uploadResult ? 'Ready' : selectedFile ? 'Local' : 'Empty'}</p>
                    </div>
                    <div className="rounded-lg bg-black/20 p-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Analysis</p>
                      <p className="mt-1 text-xs font-bold text-white">{diagnosticResult ? 'Complete' : 'Pending'}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <SectionHeading title="Request Details" info={RESULT_EXPLAINERS.registry} />
                  {[
                    ['Request ID', diagnosticResult?.request_id ?? uploadResult?.request_id ?? 'Not created'],
                    ['Frames', diagnosticResult ? `${diagnosticResult.frames_analyzed}` : 'Not analyzed'],
                    ['Sampling', getFrameBudgetLabel(analysisDepth, frameRate)],
                    ['Decision', diagnosticResult ? (diagnosticResult.final_decision.approved ? 'Approved' : 'Revisions required') : 'Pending'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
                      <p className="mt-1 break-words text-xs font-bold text-white">{value}</p>
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <SectionHeading
                    title="Sample Actions"
                    info="Actions for the current creative: upload, rerun analysis, or export the formatted diagnostic report."
                  />
                  <button
                    type="button"
                    onClick={() => uploadVideo()}
                    disabled={!selectedFile || isUploading || isAnalyzing}
                    className="w-full rounded-lg border border-seedtag-coral/30 bg-seedtag-coral/15 px-4 py-3 text-xs font-bold text-white transition-all hover:bg-seedtag-coral/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Upload Current Creative
                  </button>
                  <button
                    type="button"
                    onClick={() => analyzeCreative()}
                    disabled={(!selectedFile && !uploadResult) || isUploading || isAnalyzing}
                    className="w-full rounded-lg bg-seedtag-coral px-4 py-3 text-xs font-bold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Run Diagnostic
                  </button>
                  <button
                    type="button"
                    onClick={exportReport}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white transition-all hover:bg-white/10"
                  >
                    Export Report
                  </button>
                </section>
              </>
            ) : (
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

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/5 pt-5">
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-200">Confirmed</p>
              <p className="mt-1 text-xl font-bold text-white">{reviewSummary.confirmed}</p>
            </div>
            <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-200">Rejected</p>
              <p className="mt-1 text-xl font-bold text-white">{reviewSummary.rejected}</p>
            </div>
          </div>
        </motion.aside>

      </div>

      {/* Human Gate — expanded overlay */}
      <AnimatePresence>
        {gateExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="glass-panel flex w-full max-w-[90vw] max-h-[90vh] overflow-hidden rounded-2xl border-white/10"
            >
              {/* Left: video */}
              <div className="flex flex-col flex-1 min-w-0 p-5 gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    Human Gate Review
                  </h2>
                  <button
                    type="button"
                    onClick={() => setGateExpanded(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition-all hover:border-red-400/30 hover:text-red-300"
                    aria-label="Close review"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="w-[90%] mx-auto">
                  <VideoCortex
                    onTimeUpdate={handleTimeUpdate}
                    videoUrl={previewUrl}
                    selectedFileName={selectedFile?.name ?? uploadResult?.filename ?? null}
                    requestId={uploadResult?.request_id ?? diagnosticResult?.request_id ?? null}
                    isUploading={false}
                    isAnalyzing={false}
                    uploadProgress={uploadProgress}
                    analysisProgress={analysisProgress}
                    onSelectFile={selectFile}
                    onUpload={uploadVideo}
                    onAnalyze={analyzeCreative}
                    canAnalyze={false}
                    hideControls
                    markers={timelineMarkers}
                    activeMarkerIndex={activeMarkerIndex}
                    onMarkerClick={handleMarkerClick}
                    seekTarget={videoSeekTarget}
                  />
                </div>
                <p className="text-[10px] text-gray-500 text-center">
                  Click a marker on the timeline or use Prev / Next to navigate
                </p>
              </div>

              {/* Right: review panel */}
              <div className="w-[420px] shrink-0 flex flex-col gap-4 border-l border-white/10 p-6 overflow-y-auto custom-scrollbar">
                {/* Marker counter */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    Frame Markers
                  </span>
                  <span className="text-xs font-bold text-amber-300">
                    {Object.keys(markerDecisions).length} / {frameMarkers.length} reviewed
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${frameMarkers.length ? (Object.keys(markerDecisions).length / frameMarkers.length) * 100 : 0}%` }}
                  />
                </div>

                {/* Active marker card */}
                {activeMarkerIndex !== null && (() => {
                  const m = frameMarkers.find((fm) => fm.frameIndex === activeMarkerIndex)
                  if (!m) return null
                  const decision = markerDecisions[m.frameIndex]
                  const note = markerNotes[m.frameIndex] ?? ''
                  const currentIdx = frameMarkers.findIndex((fm) => fm.frameIndex === m.frameIndex)

                  return (
                    <div className="space-y-3">
                      {/* Navigator */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigateMarker('prev')}
                          disabled={currentIdx <= 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition-all hover:bg-white/10 disabled:opacity-30"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold text-white">
                          {currentIdx + 1} of {frameMarkers.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigateMarker('next')}
                          disabled={currentIdx >= frameMarkers.length - 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition-all hover:bg-white/10 disabled:opacity-30"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>

                      {/* Marker info */}
                      <div className={`rounded-lg border p-3 space-y-2 ${
                        m.type === 'low-attention'
                          ? 'border-red-400/25 bg-red-500/10'
                          : 'border-amber-400/25 bg-amber-400/10'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold uppercase tracking-widest ${
                            m.type === 'low-attention' ? 'text-red-300' : 'text-amber-300'
                          }`}>
                            {m.type === 'low-attention' ? 'Low Attention' : 'High Load'}
                          </span>
                          <span className="text-xs font-mono text-gray-400">{m.timestampSeconds}s</span>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400">
                          <span>Attention: <strong className="text-white">{m.attentionScore.toFixed(0)}</strong></span>
                          <span>Load: <strong className="text-white">{(m.sensoryLoad * 100).toFixed(0)}%</strong></span>
                        </div>
                        <p className="text-sm leading-snug text-gray-300">{m.cognitiveResponse}</p>
                        <p className="text-sm leading-snug text-gray-400 italic">{m.recommendation}</p>
                      </div>

                      {/* Decision buttons */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMarkerDecision(m.frameIndex, 'ok')}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all ${
                            decision === 'ok'
                              ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100'
                              : 'border-white/10 bg-white/5 text-gray-300 hover:border-emerald-400/30 hover:text-emerald-200'
                          }`}
                        >
                          <Check size={14} /> OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setMarkerDecision(m.frameIndex, 'flagged')}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all ${
                            decision === 'flagged'
                              ? 'border-red-400/40 bg-red-400/20 text-red-100'
                              : 'border-white/10 bg-white/5 text-gray-300 hover:border-red-400/30 hover:text-red-200'
                          }`}
                        >
                          <X size={14} /> Flag
                        </button>
                      </div>

                      {/* Note */}
                      <div className="space-y-1">
                        <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-gray-500">
                          <StickyNote size={12} /> Note
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Add a note for this frame…"
                          value={note}
                          onChange={(e) => setMarkerNotes((current) => ({ ...current, [m.frameIndex]: e.target.value }))}
                          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-amber-400/30 focus:ring-0"
                        />
                      </div>
                    </div>
                  )
                })()}

                {activeMarkerIndex === null && (
                  <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                    <span className="text-2xl">👆</span>
                    <p className="text-xs text-gray-400">Click a marker on the timeline<br />or use Prev / Next to start</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigateMarker('next')}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-200 transition-all hover:bg-amber-400/20"
                      >
                        Start Review <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-t border-white/10 pt-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Signal Review</p>
                  {hybridReviewItems.map((item) => {
                    const Icon = item.icon
                    const decision = reviewDecisions[item.id]
                    return (
                      <div key={item.id} className="flex items-center gap-2">
                        <Icon size={13} className={item.needsAttention ? 'text-amber-300' : 'text-gray-400'} />
                        <span className="flex-1 text-[11px] text-gray-300">{item.label}</span>
                        <span className="text-[10px] text-seedtag-coral">{item.value}</span>
                        <button type="button" disabled={!diagnosticResult} onClick={() => setHybridDecision(item.id, 'confirmed')}
                          className={`flex h-6 w-6 items-center justify-center rounded border transition-all disabled:opacity-30 ${decision === 'confirmed' ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100' : 'border-white/10 bg-white/5 text-gray-400 hover:text-emerald-300'}`}>
                          <Check size={11} />
                        </button>
                        <button type="button" disabled={!diagnosticResult} onClick={() => setHybridDecision(item.id, 'rejected')}
                          className={`flex h-6 w-6 items-center justify-center rounded border transition-all disabled:opacity-30 ${decision === 'rejected' ? 'border-red-400/40 bg-red-400/20 text-red-100' : 'border-white/10 bg-white/5 text-gray-400 hover:text-red-300'}`}>
                          <X size={11} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
