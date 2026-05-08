'use client'

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Brain,
  BarChart3,
  Clock,
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
  Film,
  Server,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import BrainViewer, { REGIONS as BRAIN_REGIONS, type RegionDetail } from '@/components/BrainViewer'
import VideoCortex, { type TimelineMarker } from '@/components/VideoCortex'
import AttentionChart from '@/components/AttentionChart'

const DIAGNOSTICS_API_BASE =
  process.env.NEXT_PUBLIC_TRIBE_API_BASE_URL ?? 'http://localhost:8000/api/v1/diagnostics'

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? ''

function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  return API_KEY ? { 'X-API-Key': API_KEY, ...extra } : { ...extra }
}

type BrainRegionKey = 'frontal' | 'temporal' | 'visual' | 'emotional' | 'all'
type DashboardSection = 'diagnostics' | 'insights' | 'config' | 'history' | 'lifecycle'

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
  attention_map?: number[][] | null
}

type HybridReviewKey = 'brandVoice' | 'pacing' | 'transitions'
type ReviewDecision = 'confirmed' | 'rejected'
type AnalysisDepth = 'quick' | 'standard' | 'deep' | 'ultra'
type MarkerDecision = 'ok' | 'flagged'

interface HistorySummary {
  request_id: string
  filename: string
  analyzed_at: string
  attention_score: number
  approved: boolean
  strategy_category: string
  frames_analyzed: number
}

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
    'Predicted brain region activations based on visual features. Prefrontal = attention, Visual = contrast/detail, Temporal = motion/audio, Amygdala = emotional engagement.',
  frameResponse:
    'Frame-by-frame predicted human response with timestamp, attention level and recommended edit action.',
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

const REGION_MEANINGS: Record<string, { driver: string; high: string; low: string }> = {
  'Prefrontal Cortex (Attention)': {
    driver: 'attention & message clarity',
    high: 'The message hierarchy is strong — viewers\' working memory locks onto the key communication.',
    low: 'Weak message hierarchy — the main communication is not cutting through.',
  },
  'Visual Cortex (V1-V4)': {
    driver: 'visual impact',
    high: 'Composition, contrast and visual rhythm are doing heavy lifting for recall.',
    low: 'Visual composition is underperforming — contrast, layout or motion needs rework.',
  },
  'Auditory Cortex (Temporal)': {
    driver: 'audio & copy resonance',
    high: 'Copy, voiceover or music is landing well and reinforcing the message.',
    low: 'Audio or on-screen text is not adding signal — consider stronger copy or sound design.',
  },
  'Amygdala (Emotional)': {
    driver: 'emotional response',
    high: 'The creative generates a genuine emotional response, boosting long-term memorability.',
    low: 'Emotional engagement is low — the creative feels functional but not memorable.',
  },
}

function buildBrainConclusion(result: DiagnosticResult | null): { headline: string; body: string; action: string } | null {
  if (!result) return null

  const entries = Object.entries(result.region_activations).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null

  const [dominantKey, dominantVal] = entries[0]
  const weakEntries = entries.filter(([, v]) => v < 0.4)
  const approved = result.final_decision.approved

  const dominant = REGION_MEANINGS[dominantKey]
  if (!dominant) return null

  // Overall verdict headline
  const headline = approved
    ? `Strong creative — leads with ${dominant.driver}`
    : `Needs work — ${dominant.driver} is the only clear strength`

  // Synthesized body: what the pattern means holistically
  const avgActivation = entries.reduce((s, [, v]) => s + v, 0) / entries.length
  const body = avgActivation >= 0.6
    ? 'This creative fires across all cognitive channels — high attention, emotional resonance, and visual impact working together.'
    : avgActivation >= 0.4
      ? `The creative has a clear lead in ${dominant.driver}, but other regions are underutilized — the message lacks full-spectrum impact.`
      : 'Activation is low across most brain regions. The creative is not generating consistent cognitive engagement.'

  // Single actionable recommendation
  const worstKey = weakEntries[0]?.[0]
  const worst = worstKey ? REGION_MEANINGS[worstKey] : null
  const action = worst
    ? `Priority fix: ${worst.low}`
    : `Maintain current strength in ${dominant.driver} and test variations to further boost recall.`

  return { headline, body, action }
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

interface RegionRec {
  working: { label: string; reason: string }[]
  failing: { label: string; reason: string }[]
  action: { label: string; tip: string } | null
}

function buildRegionRecommendations(result: DiagnosticResult | null): RegionRec | null {
  if (!result) return null
  const ra = result.region_activations

  const regions = [
    {
      key: 'Prefrontal Cortex (Attention)',
      label: 'Prefrontal',
      color: '#E85D64',
      workReason: 'Strong attention lock — message clarity is high.',
      failReason: 'Attention is weak — viewers may drift before the CTA.',
      fix: 'Add a clear focal point or product cue in the first 3 seconds.',
    },
    {
      key: 'Visual Cortex (V1-V4)',
      label: 'Visual',
      color: '#3B82F6',
      workReason: 'Visual impact is strong — composition and contrast are working.',
      failReason: 'Low visual salience — the frame lacks contrast or a clear subject.',
      fix: 'Improve contrast, use bolder colors, or simplify the composition.',
    },
    {
      key: 'Auditory Cortex (Temporal)',
      label: 'Temporal',
      color: '#F59E0B',
      workReason: 'Audio and language engagement is strong.',
      failReason: 'Audio/language signal is weak — voiceover or music isn\'t landing.',
      fix: 'Strengthen the voiceover, add music energy, or make on-screen text more prominent.',
    },
    {
      key: 'Amygdala (Emotional)',
      label: 'Emotional',
      color: '#8B5CF6',
      workReason: 'Strong emotional resonance — content is memorable.',
      failReason: 'Emotional response is low — content feels cold or detached.',
      fix: 'Add a human moment, a relatable scene, or a stronger emotional payoff at the end.',
    },
  ]

  const working: RegionRec['working'] = []
  const failing: RegionRec['failing'] = []
  let weakest: typeof regions[0] | null = null
  let weakestVal = 1

  for (const r of regions) {
    const val = ra[r.key] ?? 0
    if (val >= 0.65) working.push({ label: r.label, reason: r.workReason })
    else if (val < 0.40) failing.push({ label: r.label, reason: r.failReason })
    if (val < weakestVal) { weakestVal = val; weakest = r }
  }

  const action = weakest && weakestVal < 0.60
    ? { label: weakest.label, tip: weakest.fix }
    : null

  return { working, failing, action }
}

function getFrameBudgetLabel(depth: AnalysisDepth, frameRate: number) {
  if (depth === 'quick') return `${frameRate} fps quick pass`
  if (depth === 'deep') return `${frameRate} fps deep pass`
  if (depth === 'ultra') return `${frameRate} fps ultra-high pass`
  return `${frameRate} fps standard pass`
}

function buildRegionDetails(result: DiagnosticResult | null): Record<string, RegionDetail> {
  if (!result) return {}
  const ra = result.region_activations
  const insights = result.frame_insights ?? []

  const regionConfig = [
    {
      id: 'frontal',
      key: 'Prefrontal Cortex (Attention)',
      highWhy: 'The creative locks attention quickly — strong focal hierarchy and clear visual cues.',
      lowWhy: 'Attention signal is weak — the opening lacks a clear focal point or compelling hook.',
      highFix: 'Maintain the current pacing and visual hierarchy through the full duration.',
      lowFix: 'Add a bold focal element or product cue in the first 3 seconds to anchor attention.',
    },
    {
      id: 'visual',
      key: 'Visual Cortex (V1-V4)',
      highWhy: 'Strong visual cortex response — composition, contrast, and color are working well.',
      lowWhy: 'Visual processing is underperforming — low contrast or cluttered composition.',
      highFix: 'Keep the visual style consistent. Avoid over-editing.',
      lowFix: 'Simplify the frame, increase contrast, or introduce a stronger color accent.',
    },
    {
      id: 'temporal',
      key: 'Auditory Cortex (Temporal)',
      highWhy: 'Audio and motion engagement is strong — voiceover or music is driving rhythm.',
      lowWhy: 'Temporal lobe is underactivated — audio or on-screen text isn\'t registering.',
      highFix: 'The audio rhythm is working. Sync any supers or CTAs to the beat.',
      lowFix: 'Add voiceover energy, sync cuts to music, or increase on-screen text readability.',
    },
    {
      id: 'emotional',
      key: 'Amygdala (Emotional)',
      highWhy: 'Strong emotional resonance — content triggers a genuine feeling response.',
      lowWhy: 'Low emotional activation — content feels neutral or transactional.',
      highFix: 'Preserve the emotional arc. Don\'t cut the moment that creates the feeling.',
      lowFix: 'Add a human face, a relatable scenario, or a stronger emotional payoff at the close.',
    },
  ]

  const details: Record<string, import('@/components/BrainViewer').RegionDetail> = {}

  for (const r of regionConfig) {
    const val = ra[r.key] ?? 0
    const isHigh = val >= 0.60

    // Find key moments from frame insights for this region
    const related = insights.filter(f => f.dominant_region === r.key)
    let timeRef: string | undefined
    if (related.length > 0) {
      const strongest = related.reduce((a, b) => a.attention_score > b.attention_score ? a : b)
      const weakest = related.reduce((a, b) => a.attention_score < b.attention_score ? a : b)
      if (strongest.timestamp_seconds !== weakest.timestamp_seconds) {
        timeRef = `Strongest at ${strongest.timestamp_seconds}s, weakest at ${weakest.timestamp_seconds}s.`
      } else {
        timeRef = `Key moment at ${strongest.timestamp_seconds}s.`
      }
    }

    details[r.id] = {
      why: isHigh ? r.highWhy : r.lowWhy,
      fix: isHigh ? r.highFix : r.lowFix,
      timeRef,
    }
  }

  return details
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
    'Spelling + Grammar': 'Checks for spelling or grammar errors visible on screen. Text with mistakes damages brand credibility and can be rejected by CTV platforms.',
    'CTA Present': 'Detects whether the ad includes a visible call to action ("Visit our site", "Call now", etc.). Without a clear CTA, viewers don\'t know what to do after watching.',
    'Logo Visible': 'Verifies the brand logo is clearly visible at some point in the video. Essential for brand recall in CTV, where the logo must be legible on large screens.',
    'Safe Zones': 'Checks that key elements (text, logo, CTA) are within the safe margins of the screen. On CTV, edges may be cropped depending on the TV model.',
    Resolution: 'Confirms the video meets the minimum quality standard for CTV broadcast. Low-resolution videos may be rejected by ad platforms.',
    'QR Code': 'If the ad includes a QR code, verifies it has enough contrast and clarity to be scanned from a distance with a mobile phone.',
  }

  return explanations[label] ?? RESULT_EXPLAINERS.automated
}

const HYBRID_EXPLAINERS: Record<HybridReviewKey, string> = {
  brandVoice:
    'How well the visual tone and messaging match the brand identity. A low score may mean the creative doesn\'t "feel like" the brand even if it\'s technically correct. Review brand guidelines before approving.',
  pacing:
    'The editing rhythm and cut speed. For CTV (large screen, lean-back viewing), fast cuts can cause fatigue; slow cuts risk losing attention. Review flagged moments in the Human Gate before approving.',
  transitions:
    'Quality and coherence of scene transitions. Abrupt cuts or overused effects lower perceived production quality and can drag down the Resonance score. Flag rough edits for the editor.',
}

const REGION_EXPLAINERS: Record<string, string> = {
  'Visual (V1)':
    'Predicted activation of the visual processing area. High activation means the frame has enough contrast, color and motion to strongly engage the viewer\'s vision system.',
  'Temporal (Audio)':
    'Predicted activation of the auditory-processing area. Even without analyzing audio directly, editing rhythm and motion cues stimulate this predicted zone.',
  'Frontal (Attention)':
    'Predicted activation of the executive-attention area. High activation means the creative demands active cognitive engagement — the viewer is not passively watching.',
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
    if (API_KEY) request.setRequestHeader('X-API-Key', API_KEY)

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

// ─── Shared PDF asset loader ─────────────────────────────────────────────────
async function loadPdfAssets(doc: import('jspdf').jsPDF): Promise<string | null> {
  // Register fonts
  const loadFont = async (path: string, name: string, style: string) => {
    try {
      const buf = await fetch(path).then((r) => r.arrayBuffer())
      const bytes = new Uint8Array(buf)
      let b64 = ''
      for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i])
      b64 = btoa(b64)
      const filename = path.split('/').pop()!
      doc.addFileToVFS(filename, b64)
      doc.addFont(filename, name, style)
    } catch {/* skip if unavailable */}
  }
  await Promise.all([
    loadFont('/fonts/InstrumentSerif-Regular.ttf',  'InstrumentSerif', 'normal'),
    loadFont('/fonts/InstrumentSerif-Italic.ttf',   'InstrumentSerif', 'italic'),
    loadFont('/fonts/InstrumentSans-Regular.ttf',   'InstrumentSans',  'normal'),
    loadFont('/fonts/InstrumentSans-Bold.ttf',      'InstrumentSans',  'bold'),
    loadFont('/fonts/InstrumentSans-SemiBold.ttf',  'InstrumentSans',  'semibold'),
  ])

  // Render SVG icon to a PNG data-URL via canvas
  try {
    const svgText = await fetch('/seedtag-icon.svg').then((r) => r.text())
    const img = new Image()
    const loaded = new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej })
    img.src = 'data:image/svg+xml;base64,' + btoa(svgText)
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    canvas.getContext('2d')!.drawImage(img, 0, 0, 64, 64)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

async function downloadUserGuide() {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const iconDataUrl = await loadPdfAssets(doc)
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 16
  const ink: [number, number, number] = [26, 26, 26]
  const gray: [number, number, number] = [107, 114, 128]
  const border: [number, number, number] = [229, 229, 229]
  const coral: [number, number, number] = [232, 93, 100]
  const bgPage: [number, number, number] = [248, 248, 248]

  const fillPage = () => { doc.setFillColor(...bgPage); doc.rect(0, 0, pageWidth, 300, 'F') }

  const addPageHeader = (section: string) => {
    fillPage()
    if (iconDataUrl) doc.addImage(iconDataUrl, 'PNG', margin, 7, 7, 7)
    doc.setFont('InstrumentSerif', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(...coral)
    doc.text('NeuralSeed', margin + 10, 13)
    doc.setFont('InstrumentSans', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text(section, pageWidth - margin, 13, { align: 'right' })
    doc.setDrawColor(...coral)
    doc.setLineWidth(0.6)
    doc.line(margin, 18, pageWidth - margin, 18)
  }

  const addEntry = (y: number, label: string, body: string): number => {
    const bodyLines = doc.splitTextToSize(body, pageWidth - margin * 2 - 10)
    const cardH = 12 + bodyLines.length * 4.5
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.25)
    doc.roundedRect(margin, y, pageWidth - margin * 2, cardH, 2, 2, 'FD')
    doc.setFont('InstrumentSans', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...ink)
    doc.text(label, margin + 5, y + 7)
    doc.setFont('InstrumentSans', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text(bodyLines, margin + 5, y + 12)
    return y + cardH + 3
  }

  const addSection = (title: string, y: number) => {
    doc.setFont('InstrumentSans', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ink)
    doc.text(title, margin, y)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.25)
    doc.line(margin, y + 2, pageWidth - margin, y + 2)
    return y + 7
  }

  // ─── Page 1 — Main Metrics ────────────────────────────────────────
  addPageHeader('User Guide')
  doc.setFont('InstrumentSerif', 'italic')
  doc.setFontSize(18)
  doc.setTextColor(...ink)
  doc.text('NeuralSeed User Guide', margin, 30)
  doc.setFont('InstrumentSans', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...gray)
  const intro = 'NeuralSeed analyzes your video creative and predicts how a human audience would respond to it, second by second. It does not replace creative judgment — it gives you data to back it up.'
  doc.text(doc.splitTextToSize(intro, pageWidth - margin * 2), margin, 38)

  let y = 52
  y = addSection('Main Metrics', y)
  y = addEntry(y, 'Attention Prediction (%)', 'How likely viewers are to pay attention at each moment in the ad. Above 75 is strong; below 60 signals a risk of disengagement before the key message.')
  y = addEntry(y, 'Neural Resonance (Index)', 'How much sensory impact the ad generates: visual contrast, color, motion and complexity combined. The ideal range for CTV is 0.55–0.80. Too high can cause fatigue; too low may not register.')
  y = addEntry(y, 'Strategy Category', 'How the engine classifies the creative type: Eye-Catching (immediate visual impact), Storytelling (builds narrative), or Clever Concept (insight-driven).')
  y = addEntry(y, 'Prediction Confidence (%)', 'How reliable the overall diagnosis is. Above 80% is trustworthy. Below 70%, consider running again in Standard or Deep mode with more frames sampled.')
  y = addEntry(y, 'Sensory Load (%)', 'Average information density across all frames. High load (above 55%) can cause cognitive fatigue on large CTV screens. Aim to keep key message frames below 50%.')
  addEntry(y, 'Final Decision', 'Approved means the creative passed all attention, QA and signal thresholds. Revisions Required means at least one area needs attention before launching.')

  // ─── Page 2 — QA + Human Review ──────────────────────────────────
  doc.addPage()
  addPageHeader('User Guide')
  y = 26
  y = addSection('Automated QA Checks', y)
  y = addEntry(y, 'Spelling + Grammar', 'Detects visible text errors on screen. Mistakes damage brand credibility and can cause rejection by CTV ad platforms.')
  y = addEntry(y, 'CTA Present', 'Checks whether the ad includes a visible call to action. Without a CTA, viewers do not know what to do after watching — conversion potential drops significantly.')
  y = addEntry(y, 'Logo Visible', 'Verifies the brand logo appears clearly at some point in the video. Essential for brand recall on CTV large-screen viewing.')
  y = addEntry(y, 'Safe Zones', 'Checks that critical elements sit within the safe display area. On some TV models, the outer edges are cropped, hiding content placed too close to the border.')
  y = addEntry(y, 'Resolution', 'Confirms the video meets the minimum quality standard for CTV broadcast. Low-resolution videos may appear pixelated on 4K screens.')
  y = addEntry(y, 'QR Code (if present)', 'If the ad includes a QR code, verifies it has enough contrast and size to be scanned from a distance.')
  y += 3
  y = addSection('Human Review Signals', y)
  y = addEntry(y, 'Brand Voice', 'How well the visual tone and messaging align with brand identity. A low score means the creative may not feel like the brand even if technically correct.')
  y = addEntry(y, 'Pacing', 'The editing rhythm and cut speed. For CTV (lean-back context), very fast cuts cause visual fatigue. Very slow cuts risk losing attention.')
  addEntry(y, 'Transitions', 'Quality and coherence of scene transitions. Abrupt or overused effects lower perceived production quality and can drag down the Resonance score.')

  // ─── Page 3 — Neural Signals + Markers ───────────────────────────
  doc.addPage()
  addPageHeader('User Guide')
  y = 26
  y = addSection('Neural Signal Regions', y)
  y = addEntry(y, 'Visual Cortex (V1)', 'Predicted activation of the visual processing area. High activation means the frame has enough contrast, color and motion to strongly engage the viewer\'s vision system. Below 30% suggests visually flat content.')
  y = addEntry(y, 'Temporal (Audio)', 'Predicted activation of the auditory-processing area. Driven by visual rhythm and pacing even without direct audio analysis. High values indicate strong audio-visual synchrony.')
  y = addEntry(y, 'Prefrontal (Attention)', 'Predicted activation of the executive-attention area. High values mean the creative demands active cognitive engagement. Critical for brand message retention.')
  y = addEntry(y, 'Amygdala (Emotional)', 'Predicted emotional engagement level. High activation means the creative evokes a strong emotional response — joy, tension, empathy. Key for memorable ads.')
  y += 3
  y = addSection('Frame Markers & Heatmap', y)
  y = addEntry(y, 'Low Attention marker (red dot)', 'Marks a moment where predicted attention drops below 75. The viewer may disengage here. Click the dot to decide: OK (acceptable) or Flag (needs edit).')
  y = addEntry(y, 'High Load marker (amber dot)', 'Marks a frame where sensory load exceeds 45%. Too much information at once can cause cognitive fatigue. Review whether the frame can be simplified.')
  addEntry(y, 'Heatmap overlay (green / amber / red)', 'Shows spatial attention zones on the frame. Green = strong focal area (<40%). Amber = moderate attention (40-70%). Red = high cognitive load (>70%).')

  doc.save('neuralseed-user-guide.pdf')
}

async function captureCreativeDataUrl(previewUrl: string | null, isStaticImage: boolean, filename?: string): Promise<{ dataUrl: string; ar: number; filename: string } | null> {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    if (isStaticImage && previewUrl) {
      const img = new Image()
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = previewUrl })
      const scale = Math.min(1, 800 / img.naturalWidth)
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    } else {
      const video = document.querySelector('video')
      if (!video || !video.videoWidth) return null
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
    }
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), ar: canvas.width / canvas.height, filename: filename ?? '' }
  } catch { return null }
}

async function createDiagnosticPdf(
  result: DiagnosticResult,
  reviewDecisions: Partial<Record<HybridReviewKey, ReviewDecision>>,
  frameMarkers: FrameMarker[],
  markerDecisions: Record<number, MarkerDecision>,
  markerNotes: Record<number, string>,
  creative: { dataUrl: string; ar: number; filename: string } | null
) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const iconDataUrl = await loadPdfAssets(doc)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const pageBottom = pageHeight - 12

  // ── Design tokens ──────────────────────────────────────────────────
  const ink: [number, number, number]   = [26, 26, 26]
  const gray: [number, number, number]  = [107, 114, 128]
  const border: [number, number, number]= [229, 229, 229]
  const coral: [number, number, number] = [232, 93, 100]
  const track: [number, number, number] = [245, 197, 199]
  const bgPage: [number, number, number]= [248, 248, 248]
  const green: [number, number, number] = [22, 163, 74]
  const red: [number, number, number]   = [220, 38, 38]
  const amber: [number, number, number] = [217, 119, 6]

  // ── Primitives ─────────────────────────────────────────────────────
  const fillPage = () => { doc.setFillColor(...bgPage); doc.rect(0, 0, pageWidth, pageHeight, 'F') }

  const addHeader = (subtitle?: string) => {
    fillPage()
    if (iconDataUrl) doc.addImage(iconDataUrl, 'PNG', margin, 7, 7, 7)
    doc.setFont('InstrumentSerif', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(...coral)
    doc.text('NeuralSeed', margin + 10, 13)
    doc.setFont('InstrumentSans', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text(subtitle ?? new Date(result.timestamp).toLocaleDateString(), pageWidth - margin, 13, { align: 'right' })
    doc.setDrawColor(...coral)
    doc.setLineWidth(0.6)
    doc.line(margin, 18, pageWidth - margin, 18)
  }

  const addCard = (x: number, y: number, w: number, h: number) => {
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.25)
    doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  }

  const addProgressBar = (x: number, y: number, w: number, norm: number) => {
    doc.setFillColor(...track)
    doc.roundedRect(x, y, w, 3, 1, 1, 'F')
    const fw = Math.max(0, Math.min(1, norm)) * w
    if (fw > 0.5) { doc.setFillColor(...coral); doc.roundedRect(x, y, fw, 3, 1, 1, 'F') }
  }

  const addSectionLabel = (label: string, y: number) => {
    doc.setFont('InstrumentSans', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...gray)
    doc.text(label.toUpperCase(), margin, y)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.2)
    doc.line(margin, y + 2, pageWidth - margin, y + 2)
  }

  // ── PAGE 1 — Overview ──────────────────────────────────────────────
  addHeader('Creative Diagnostics Report')

  // Verdict — full width
  const verdictColor = result.final_decision.approved ? green : red
  doc.setFont('InstrumentSerif', 'italic')
  doc.setFontSize(26)
  doc.setTextColor(...verdictColor)
  doc.text(result.final_decision.approved ? 'Approved' : 'Revisions Required', margin, 34)

  doc.setFont('InstrumentSans', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...gray)
  doc.text(
    `${result.final_decision.strategy_category}  ·  ${result.frames_analyzed} frames  ·  ${new Date(result.timestamp).toLocaleString()}`,
    margin, 41
  )

  // 4 metric cards
  const cw = (pageWidth - margin * 2 - 12) / 4
  const metricCards = [
    { label: 'Attention',     value: `${result.attention_score.toFixed(0)}%`,             norm: result.attention_score / 100 },
    { label: 'Resonance',     value: result.neural_resonance.toFixed(2),                  norm: result.neural_resonance },
    { label: 'Confidence',    value: formatRatio(result.prediction_confidence),            norm: result.prediction_confidence },
    { label: 'Sensory Load',  value: `${(result.sensory_load * 100).toFixed(0)}%`,        norm: result.sensory_load },
  ]
  metricCards.forEach((m, i) => {
    const cx = margin + i * (cw + 4)
    addCard(cx, 46, cw, 32)
    doc.setFont('InstrumentSans', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...gray)
    doc.text(m.label.toUpperCase(), cx + 4, 53)
    doc.setFont('InstrumentSerif', 'italic')
    doc.setFontSize(16)
    doc.setTextColor(...ink)
    doc.text(m.value, cx + 4, 65)
    addProgressBar(cx + 4, 69, cw - 8, m.norm)
  })

  // Neural signals — 2-column metric rows
  addSectionLabel('Neural Signals', 88)
  const regions: [string, number][] = [
    ['Prefrontal (Attention)', result.region_activations['Prefrontal Cortex (Attention)'] ?? 0],
    ['Visual Cortex (V1)',     result.region_activations['Visual Cortex (V1-V4)'] ?? 0],
    ['Temporal (Audio)',       result.region_activations['Auditory Cortex (Temporal)'] ?? 0],
    ['Amygdala (Emotional)',   result.region_activations['Amygdala (Emotional)'] ?? 0],
  ]
  const rColW = (pageWidth - margin * 2 - 6) / 2
  regions.forEach(([label, val], i) => {
    const col = i % 2; const row = Math.floor(i / 2)
    const rx = margin + col * (rColW + 6)
    const ry = 93 + row * 18
    addCard(rx, ry, rColW, 14)
    doc.setFont('InstrumentSans', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...ink)
    doc.text(label, rx + 4, ry + 6)
    doc.setTextColor(...gray)
    doc.text(`${(val * 100).toFixed(0)}%`, rx + rColW - 4, ry + 6, { align: 'right' })
    addProgressBar(rx + 4, ry + 8.5, rColW - 8, val)
  })

  // QA Checks
  addSectionLabel('Automated QA', 134)
  const qaItems: [string, boolean | null][] = [
    ['Spelling + Grammar', result.ai_automated.spelling_grammar_passed],
    ['CTA Present',         result.ai_automated.cta_present],
    ['Logo Visible',        result.ai_automated.logo_visible],
    ['Safe Zones',          result.ai_automated.safe_zones_passed],
    ['Resolution',          result.ai_automated.resolution_passed],
    ...(result.ai_automated.qr_code_scannable != null
      ? [['QR Scannable', result.ai_automated.qr_code_scannable] as [string, boolean | null]]
      : []),
  ]
  const qColW = (pageWidth - margin * 2 - 4) / 2
  qaItems.forEach(([label, passed], i) => {
    const col = i % 2; const row = Math.floor(i / 2)
    const qx = margin + col * (qColW + 4)
    const qy = 139 + row * 13
    addCard(qx, qy, qColW, 9)
    const dotC: [number, number, number] = passed === true ? green : passed === false ? red : gray
    doc.setFillColor(...dotC)
    doc.circle(qx + 5, qy + 4.5, 1.8, 'F')
    doc.setFont('InstrumentSans', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...ink)
    doc.text(label, qx + 10, qy + 6)
    doc.setTextColor(...dotC)
    doc.text(passed === true ? 'Pass' : passed === false ? 'Fail' : '—', qx + qColW - 4, qy + 6, { align: 'right' })
  })

  // Executive summary block
  const qRows = Math.ceil(qaItems.length / 2)
  const summaryY = 139 + qRows * 13 + 6
  addSectionLabel('Executive Summary', summaryY)
  doc.setFont('InstrumentSans', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...gray)
  const summaryLines = [
    `Sensory load: ${(result.sensory_load * 100).toFixed(1)}%   Brand voice: ${formatRatio(result.hybrid_flags.brand_voice_score)}   Checks passed: ${Object.values(result.ai_automated).filter(Boolean).length} / 6`,
    result.hybrid_flags.pacing_warnings.length ? `Pacing: ${result.hybrid_flags.pacing_warnings.join('; ')}` : '',
    result.hybrid_flags.transition_warnings.length ? `Transitions: ${result.hybrid_flags.transition_warnings.join('; ')}` : '',
  ].filter(Boolean)
  let cursorY = summaryY + 6
  summaryLines.forEach((line) => {
    doc.text(doc.splitTextToSize(line, pageWidth - margin * 2), margin, cursorY)
    cursorY += 5
  })

  // ── PAGE 2 — Creative Preview (only if image captured) ───────────
  if (creative) {
    doc.addPage()
    addHeader('Creative Preview')
    const maxW = pageWidth - margin * 2
    const maxH = pageHeight - 50
    const imgW = creative.ar >= 1 ? maxW : maxH * creative.ar
    const imgH = creative.ar >= 1 ? maxW / creative.ar : maxH
    const fw = Math.min(imgW, maxW)
    const fh = Math.min(imgH, maxH)
    const ix = margin + (maxW - fw) / 2
    const iy = 26 + (maxH - fh) / 2
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.3)
    doc.roundedRect(ix - 2, iy - 2, fw + 4, fh + 4, 3, 3, 'FD')
    doc.addImage(creative.dataUrl, 'JPEG', ix, iy, fw, fh)
    doc.setFont('InstrumentSans', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text(creative.filename ?? 'Creative', pageWidth / 2, iy + fh + 8, { align: 'center' })
  }

  // ── PAGE 3 — Human Review + Action Plan ───────────────────────────
  doc.addPage()
  addHeader('Human Review & Action Plan')
  cursorY = 26

  addSectionLabel('Human Review', cursorY)
  cursorY += 7
  buildHybridReviewItems(result).forEach((item) => {
    const decision = reviewDecisions[item.id]
    const statusC: [number, number, number] = decision === 'confirmed' ? green : decision === 'rejected' ? red : gray
    const statusLabel = decision === 'confirmed' ? 'Confirmed' : decision === 'rejected' ? 'Rejected' : 'Pending'
    const bodyLines = doc.splitTextToSize(`${item.value} — ${item.detail}`, pageWidth - margin * 2 - 10).slice(0, 2)
    const cardH = bodyLines.length > 1 ? 24 : 18
    if (cursorY + cardH > pageBottom) { doc.addPage(); addHeader('Human Review'); cursorY = 26 }
    addCard(margin, cursorY, pageWidth - margin * 2, cardH)
    doc.setFont('InstrumentSans', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...ink)
    doc.text(item.label, margin + 5, cursorY + 7)
    doc.setTextColor(...statusC)
    doc.text(statusLabel, pageWidth - margin - 5, cursorY + 7, { align: 'right' })
    doc.setFont('InstrumentSans', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text(bodyLines, margin + 5, cursorY + 13)
    cursorY += cardH + 3
  })

  if (result.actionable_steps.length > 0) {
    cursorY += 4
    addSectionLabel('Action Plan', cursorY)
    cursorY += 7
    result.actionable_steps.forEach((step, index) => {
      const ratioLines = doc.splitTextToSize(step.rationale, pageWidth - margin * 2 - 10).slice(0, 2)
      const cardH = 12 + ratioLines.length * 4.5
      if (cursorY + cardH > pageBottom) { doc.addPage(); addHeader('Action Plan'); cursorY = 26 }
      addCard(margin, cursorY, pageWidth - margin * 2, cardH)
      doc.setFillColor(...coral)
      doc.roundedRect(margin + 4, cursorY + 3, 18, 5.5, 1, 1, 'F')
      doc.setFont('InstrumentSans', 'bold')
      doc.setFontSize(5.5)
      doc.setTextColor(255, 255, 255)
      doc.text(`${index + 1}. ${step.priority}`, margin + 5, cursorY + 7)
      doc.setFontSize(8)
      doc.setTextColor(...ink)
      doc.text(doc.splitTextToSize(step.title, pageWidth - margin * 2 - 30).slice(0, 1)[0], margin + 26, cursorY + 7)
      doc.setTextColor(...gray)
      doc.text(step.frame_range, pageWidth - margin - 5, cursorY + 7, { align: 'right' })
      doc.setFont('InstrumentSans', 'normal')
      doc.setFontSize(7)
      doc.text(ratioLines, margin + 5, cursorY + 11)
      cursorY += cardH + 3
    })
  }

  // ── PAGE 3 — Frame Table ───────────────────────────────────────────
  doc.addPage()
  addHeader('Frame-Level Predicted Response')
  addSectionLabel('Frame Diagnostics', 26)
  cursorY = 33

  // Table header
  doc.setFillColor(...ink)
  doc.rect(margin, cursorY, pageWidth - margin * 2, 7, 'F')
  doc.setFont('InstrumentSans', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(255, 255, 255)
  ;['TIME', 'ATTN', 'REGION', 'RESPONSE'].forEach((h, i) => {
    doc.text(h, margin + [3, 21, 42, 88][i], cursorY + 5)
  })
  cursorY += 9

  result.frame_insights.slice(0, 22).forEach((frame, index) => {
    if (cursorY > pageBottom - 10) { doc.addPage(); addHeader('Frame-Level Response'); cursorY = 26 }
    const rowH = 9
    doc.setFillColor(index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 250)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.15)
    doc.rect(margin, cursorY, pageWidth - margin * 2, rowH, 'FD')
    doc.setFont('InstrumentSans', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...ink)
    doc.text(`${frame.timestamp_seconds.toFixed(1)}s`, margin + 3, cursorY + 6)
    const attnC: [number, number, number] = frame.attention_score >= 75 ? green : frame.attention_score >= 52 ? amber : red
    doc.setTextColor(...attnC)
    doc.text(`${frame.attention_score.toFixed(0)}%`, margin + 21, cursorY + 6)
    doc.setFont('InstrumentSans', 'normal')
    doc.setTextColor(...gray)
    const regionShort = frame.dominant_region.replace(' Cortex (Attention)', '').replace(' (V1-V4)', '').replace(' (Temporal)', '').replace(' (Emotional)', '')
    doc.text(doc.splitTextToSize(regionShort, 42)[0], margin + 42, cursorY + 6)
    doc.text(doc.splitTextToSize(frame.cognitive_response, 82)[0], margin + 88, cursorY + 6)
    cursorY += rowH
  })

  // ── PAGE 4 — Frame Markers (if any) ───────────────────────────────
  if (frameMarkers.length > 0) {
    doc.addPage()
    addHeader('Human Gate — Frame Review')
    const reviewedCount = Object.keys(markerDecisions).length
    doc.setFont('InstrumentSans', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text(
      `${reviewedCount} of ${frameMarkers.length} reviewed  ·  ${frameMarkers.filter(m => m.type === 'low-attention').length} low-attention  ·  ${frameMarkers.filter(m => m.type === 'high-load').length} high-load`,
      pageWidth - margin, 26, { align: 'right' }
    )
    addSectionLabel('Frame Markers', 26)
    cursorY = 33

    frameMarkers.forEach((m) => {
      const decision = markerDecisions[m.frameIndex]
      const note = markerNotes[m.frameIndex] ?? ''
      const noteLines = note.trim() ? doc.splitTextToSize(note.trim(), pageWidth - margin * 2 - 10).slice(0, 2) : []
      const cardH = 24 + noteLines.length * 4.5
      if (cursorY + cardH > pageBottom) { doc.addPage(); addHeader('Human Gate'); cursorY = 26 }

      const typeC: [number, number, number] = m.type === 'low-attention' ? red : amber
      const decisionC: [number, number, number] = decision === 'ok' ? green : decision === 'flagged' ? red : gray
      const decisionLabel = decision === 'ok' ? 'OK' : decision === 'flagged' ? 'Flagged' : 'Pending'

      addCard(margin, cursorY, pageWidth - margin * 2, cardH)

      // Timestamp
      doc.setFont('InstrumentSans', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...ink)
      doc.text(`${m.timestampSeconds.toFixed(1)}s`, margin + 5, cursorY + 8)

      // Type badge
      const badgeW = m.type === 'low-attention' ? 24 : 19
      doc.setFillColor(...typeC)
      doc.roundedRect(margin + 22, cursorY + 3, badgeW, 6, 1, 1, 'F')
      doc.setFont('InstrumentSans', 'bold')
      doc.setFontSize(5.5)
      doc.setTextColor(255, 255, 255)
      doc.text(m.type === 'low-attention' ? 'Low Attn' : 'Hi Load', margin + 23, cursorY + 7.5)

      // Decision
      doc.setFont('InstrumentSans', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...decisionC)
      doc.text(decisionLabel, pageWidth - margin - 5, cursorY + 8, { align: 'right' })

      // Metrics
      doc.setFont('InstrumentSans', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...gray)
      doc.text(`Attention: ${m.attentionScore.toFixed(0)}%  ·  Load: ${(m.sensoryLoad * 100).toFixed(0)}%`, margin + 5, cursorY + 15)
      doc.text(doc.splitTextToSize(m.recommendation, pageWidth - margin * 2 - 10)[0], margin + 5, cursorY + 20)

      if (noteLines.length > 0) {
        doc.setTextColor(...ink)
        doc.text(noteLines, margin + 5, cursorY + 24)
      }

      cursorY += cardH + 3
    })
  }

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
  badge,
}: {
  title: string
  value: string
  unit: string
  trend?: string
  icon?: LucideIcon
  info: string
  badge?: { text: string; variant: 'green' | 'amber' | 'red' | 'blue' | 'gray' }
}) => {
  const badgeStyles: Record<string, string> = {
    green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    red: 'border-red-400/30 bg-red-400/10 text-red-300',
    blue: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
    gray: 'border-white/10 bg-white/5 text-gray-400',
  }
  return (
    <FlipCard
      front={
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            {Icon && <Icon size={40} className="text-seedtag-coral" />}
          </div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm text-gray-400">{title}</p>
            {badge && (
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeStyles[badge.variant]}`}>
                {badge.text}
              </span>
            )}
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
      }
      back={
        <div className="glass-card p-5 flex flex-col justify-center min-h-full">
          <p className="mb-2 pr-6 text-[10px] font-bold uppercase tracking-widest text-gray-500">{title}</p>
          <p className="text-xs leading-relaxed text-gray-200">{info}</p>
        </div>
      }
    />
  )
}

const FlipCard = ({
  front,
  back,
  className = '',
}: {
  front: ReactNode
  back: ReactNode
  className?: string
}) => {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className={className} style={{ perspective: '800px' }}>
      <div
        style={{
          display: 'grid',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.42s cubic-bezier(0.4,0,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front */}
        <div style={{ gridArea: '1/1', backfaceVisibility: 'hidden', position: 'relative' }}>
          {front}
          <button
            type="button"
            onClick={() => setFlipped(true)}
            title="What is this?"
            className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[11px] font-bold leading-none text-gray-400 transition-all hover:border-seedtag-coral/60 hover:text-seedtag-coral"
          >
            +
          </button>
        </div>
        {/* Back */}
        <div
          style={{
            gridArea: '1/1',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'relative',
          }}
        >
          {back}
          <button
            type="button"
            onClick={() => setFlipped(false)}
            title="Back"
            className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[13px] leading-none text-gray-400 transition-all hover:text-white"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

function StaticImageViewer({
  imageUrl,
  heatmap,
  isAnalyzing,
  isDone,
  selectedFileName,
  onSelectFile,
  onUpload,
  onAnalyze,
  canAnalyze,
  onReset,
}: {
  imageUrl: string
  heatmap: number[][] | null
  isAnalyzing: boolean
  isDone: boolean
  selectedFileName: string | null
  onSelectFile: (f: File) => void
  onUpload: () => Promise<unknown>
  onAnalyze: () => Promise<void>
  canAnalyze: boolean
  onReset: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !heatmap) { if (canvas) { const ctx = canvas.getContext('2d'); ctx?.clearRect(0, 0, canvas.width, canvas.height) } return }
    canvas.width = img.clientWidth
    canvas.height = img.clientHeight
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const grid = heatmap.length
    const cellW = canvas.width / grid
    const cellH = canvas.height / grid
    heatmap.forEach((row, r) => {
      row.forEach((v, c) => {
        const alpha = 0.15 + v * 0.55
        ctx.fillStyle = v < 0.4 ? `rgba(34,197,94,${alpha})` : v < 0.7 ? `rgba(251,191,36,${alpha})` : `rgba(239,68,68,${alpha})`
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH)
      })
    })
  }, [heatmap])

  const handleUploadAndAnalyze = async () => { await onUpload(); await onAnalyze() }

  return (
    <div className="glass-card overflow-hidden relative w-full border-white/5 bg-black">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelectFile(f) }} />
      <div className="bg-black flex items-center justify-center" style={{ minHeight: '320px', maxHeight: '60vh' }}>
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={imageUrl} alt="Creative" className="block max-w-full" style={{ maxHeight: '60vh', display: 'block' }} />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ mixBlendMode: 'screen', filter: 'blur(18px) saturate(1.4)', opacity: heatmap ? 1 : 0, transition: 'opacity 0.4s' }} />
          {isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-seedtag-coral border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-300">Analyzing image...</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-white/5">
        <span className="text-[10px] text-gray-500 truncate max-w-[160px]">{selectedFileName ?? 'Static image'}</span>
        <div className="flex gap-2">
          {isDone ? (
            <button type="button" onClick={onReset}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:bg-white/10 transition-all">
              New Creative
            </button>
          ) : (
            <>
              <button type="button" onClick={() => inputRef.current?.click()}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:bg-white/10 transition-all">
                Change
              </button>
              {canAnalyze && !isAnalyzing && (
                <button type="button" onClick={handleUploadAndAnalyze}
                  className="rounded-lg border border-seedtag-coral/40 bg-seedtag-coral/20 px-3 py-1.5 text-[10px] font-bold text-seedtag-coral hover:bg-seedtag-coral/30 transition-all">
                  Analyze
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


function DeltaBadge({ current, avg, higherIsBetter = true }: { current: number; avg: number; higherIsBetter?: boolean }) {
  const delta = current - avg
  const good = higherIsBetter ? delta >= 0 : delta <= 0
  if (Math.abs(delta) < 0.5) return <span className="text-[10px] text-gray-500">≈ avg</span>
  return (
    <span className={`text-[10px] font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)} {good ? '↑' : '↓'}
    </span>
  )
}

function AbMetricRow({ label, valA, valB, higherIsBetter = true }: { label: string; valA: number | null; valB: number | null; higherIsBetter?: boolean }) {
  const winner = valA !== null && valB !== null
    ? (higherIsBetter ? (valA >= valB ? 'a' : 'b') : (valA <= valB ? 'a' : 'b'))
    : null
  return (
    <div className="grid grid-cols-3 gap-2 items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{label}</span>
      <div className={`text-center rounded-lg py-1 text-xs font-bold ${winner === 'a' ? 'bg-seedtag-coral/20 text-seedtag-coral' : 'text-gray-300'}`}>
        {valA !== null ? valA.toFixed(1) : '—'}
        {winner === 'a' && <span className="ml-1 text-[9px]">✓</span>}
      </div>
      <div className={`text-center rounded-lg py-1 text-xs font-bold ${winner === 'b' ? 'bg-seedtag-coral/20 text-seedtag-coral' : 'text-gray-300'}`}>
        {valB !== null ? valB.toFixed(1) : '—'}
        {winner === 'b' && <span className="ml-1 text-[9px]">✓</span>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [activation, setActivation] = useState(0.4)
  const [region, setRegion] = useState<BrainRegionKey>('all')
  const [hoveredRegion, setHoveredRegion] = useState<BrainRegionKey | null>(null)
  const [showConclusion, setShowConclusion] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isStaticImage = Boolean(selectedFile && /\.(png|jpe?g|webp)$/i.test(selectedFile.name))
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
  const [formatType, setFormatType] = useState<'bespoke' | 'frame' | 'standard_video'>('bespoke')
  const [reviewDecisions, setReviewDecisions] = useState<Partial<Record<HybridReviewKey, ReviewDecision>>>({})
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null)
  const [heatmapEnabled, setHeatmapEnabled] = useState(true)
  const [selectedFrame, setSelectedFrame] = useState<FrameInsight | null>(null)
  const [markerDecisions, setMarkerDecisions] = useState<Record<number, MarkerDecision>>({})
  const [markerNotes, setMarkerNotes] = useState<Record<number, string>>({})
  const [videoSeekTarget, setVideoSeekTarget] = useState<number | null>(null)
  const [gateExpanded, setGateExpanded] = useState(false)
  const [historySummaries, setHistorySummaries] = useState<HistorySummary[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyEditMode, setHistoryEditMode] = useState(false)
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set())
  const [isDeletingHistory, setIsDeletingHistory] = useState(false)
  const [lifecycleTab, setLifecycleTab] = useState<'benchmark' | 'ab'>('benchmark')
  const [abIdA, setAbIdA] = useState<string>('')
  const [abIdB, setAbIdB] = useState<string>('')
  const [abResultA, setAbResultA] = useState<DiagnosticResult | null>(null)
  const [abResultB, setAbResultB] = useState<DiagnosticResult | null>(null)
  const [abLoadingA, setAbLoadingA] = useState(false)
  const [abLoadingB, setAbLoadingB] = useState(false)

  const histAvg = useMemo(() => historySummaries.length > 0 ? {
    attention: historySummaries.reduce((s, h) => s + h.attention_score, 0) / historySummaries.length,
    approvalRate: historySummaries.filter(h => h.approved).length / historySummaries.length * 100,
    frames: historySummaries.reduce((s, h) => s + h.frames_analyzed, 0) / historySummaries.length,
  } : null, [historySummaries])

  const toggleHistorySelection = (id: string) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const exitHistoryEditMode = () => {
    setHistoryEditMode(false)
    setSelectedHistoryIds(new Set())
  }

  const deleteSelectedEntries = async () => {
    if (selectedHistoryIds.size === 0) return
    setIsDeletingHistory(true)
    const ids = Array.from(selectedHistoryIds)
    await Promise.all(
      ids.map((id) =>
        fetch(`${DIAGNOSTICS_API_BASE}/${id}`, { method: 'DELETE', headers: apiHeaders() }).catch(() => null)
      )
    )
    setHistorySummaries((prev) => prev.filter((s) => !selectedHistoryIds.has(s.request_id)))
    exitHistoryEditMode()
    setIsDeletingHistory(false)
  }

  const backupSelectedEntries = async () => {
    if (selectedHistoryIds.size === 0) return
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    const ids = Array.from(selectedHistoryIds)
    await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`${DIAGNOSTICS_API_BASE}/${id}`, { headers: apiHeaders() })
          if (!r.ok) return
          const data = await r.json()
          const entry = historySummaries.find((s) => s.request_id === id)
          const name = entry ? entry.filename.replace(/\.[^.]+$/, '') : id.slice(0, 8)
          zip.file(`${name}_${id.slice(0, 8)}.json`, JSON.stringify(data, null, 2))
        } catch { /* skip failed entries */ }
      })
    )
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tribe_backup_${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadAbResult = async (id: string, side: 'a' | 'b') => {
    if (!id) return
    side === 'a' ? setAbLoadingA(true) : setAbLoadingB(true)
    try {
      const r = await fetch(`${DIAGNOSTICS_API_BASE}/${id}`, { headers: apiHeaders() })
      if (!r.ok) throw new Error()
      const data: DiagnosticResult = await r.json()
      side === 'a' ? setAbResultA(data) : setAbResultB(data)
    } catch { setErrorMessage('Failed to load result.') }
    finally { side === 'a' ? setAbLoadingA(false) : setAbLoadingB(false) }
  }

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
      { key: 'visual',    value: diagnosticResult.region_activations['Visual Cortex (V1-V4)'] ?? 0 },
      { key: 'temporal',  value: diagnosticResult.region_activations['Auditory Cortex (Temporal)'] ?? 0 },
      { key: 'frontal',   value: diagnosticResult.region_activations['Prefrontal Cortex (Attention)'] ?? 0 },
      { key: 'emotional', value: diagnosticResult.region_activations['Amygdala (Emotional)'] ?? 0 },
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

  const activeHeatmap = useMemo(() => {
    if (!diagnosticResult) return null
    if (isStaticImage) return diagnosticResult.frame_insights[0]?.attention_map ?? null
    if (activeMarkerIndex === null) return null
    const insight = diagnosticResult.frame_insights.find((f) => f.frame_index === activeMarkerIndex)
    return insight?.attention_map ?? null
  }, [activeMarkerIndex, diagnosticResult, isStaticImage])

  const activeHeatmapType = useMemo(() => {
    if (activeMarkerIndex === null) return null
    const m = frameMarkers.find((fm) => fm.frameIndex === activeMarkerIndex)
    return m?.type ?? null
  }, [activeMarkerIndex, frameMarkers])

  const reviewSummary = useMemo(() => {
    const decisions = Object.values(reviewDecisions)

    return {
      confirmed: decisions.filter((decision) => decision === 'confirmed').length,
      rejected: decisions.filter((decision) => decision === 'rejected').length,
    }
  }, [reviewDecisions])

  const regionMetrics = useMemo(() => {
    const colorMap = {
      visual:    BRAIN_REGIONS.find(r => r.key === 'Visual Cortex (V1-V4)')?.color ?? '#3B82F6',
      temporal:  BRAIN_REGIONS.find(r => r.key === 'Auditory Cortex (Temporal)')?.color ?? '#F59E0B',
      frontal:   BRAIN_REGIONS.find(r => r.key === 'Prefrontal Cortex (Attention)')?.color ?? '#E85D64',
      emotional: BRAIN_REGIONS.find(r => r.key === 'Amygdala (Emotional)')?.color ?? '#8B5CF6',
    }
    if (!diagnosticResult) {
      return [
        { name: 'Frontal (Attention)', value: null, key: 'frontal'   as BrainRegionKey, color: colorMap.frontal },
        { name: 'Visual (V1)',         value: null, key: 'visual'    as BrainRegionKey, color: colorMap.visual },
        { name: 'Temporal (Audio)',    value: null, key: 'temporal'  as BrainRegionKey, color: colorMap.temporal },
        { name: 'Emotional',           value: null, key: 'emotional' as BrainRegionKey, color: colorMap.emotional },
      ]
    }

    return [
      {
        name: 'Frontal (Attention)',
        value: (diagnosticResult.region_activations['Prefrontal Cortex (Attention)'] ?? 0) * 100,
        key: 'frontal' as BrainRegionKey,
        color: colorMap.frontal,
      },
      {
        name: 'Visual (V1)',
        value: (diagnosticResult.region_activations['Visual Cortex (V1-V4)'] ?? 0) * 100,
        key: 'visual' as BrainRegionKey,
        color: colorMap.visual,
      },
      {
        name: 'Temporal (Audio)',
        value: (diagnosticResult.region_activations['Auditory Cortex (Temporal)'] ?? 0) * 100,
        key: 'temporal' as BrainRegionKey,
        color: colorMap.temporal,
      },
      {
        name: 'Emotional',
        value: (diagnosticResult.region_activations['Amygdala (Emotional)'] ?? 0) * 100,
        key: 'emotional' as BrainRegionKey,
        color: colorMap.emotional,
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
      config: {
        title: 'System Config',
        eyebrow: 'Runtime and endpoint controls',
        panelTitle: 'System Config',
        icon: Settings,
      },
      history: {
        title: 'Diagnostic History',
        eyebrow: 'Past runs — click to reload',
        panelTitle: 'History',
        icon: Clock,
      },
      lifecycle: {
        title: 'Creative Lifecycle',
        eyebrow: 'Benchmark & A/B comparison',
        panelTitle: 'Lifecycle',
        icon: TrendingUp,
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
      setErrorMessage('Select a video or image file before uploading.')
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
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          request_id: currentUpload.request_id,
          frame_rate: frameRate,
          analysis_depth: analysisDepth,
          format_type: formatType,
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
    const creative = await captureCreativeDataUrl(previewUrl, isStaticImage, selectedFile?.name ?? uploadResult?.filename)
    await createDiagnosticPdf(diagnosticResult, reviewDecisions, frameMarkers, markerDecisions, markerNotes, creative)
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
    if (section === 'history' || section === 'lifecycle') {
      setIsLoadingHistory(true)
      fetch(DIAGNOSTICS_API_BASE, { headers: apiHeaders() })
        .then((r) => r.json())
        .then((data: HistorySummary[]) => setHistorySummaries(data))
        .catch(() => setErrorMessage('Could not load history. Is the backend running?'))
        .finally(() => setIsLoadingHistory(false))
    }
  }

  const loadHistoryEntry = async (requestId: string) => {
    setErrorMessage(null)
    setInfoMessage('Loading past diagnostic…')
    try {
      const response = await fetch(`${DIAGNOSTICS_API_BASE}/${requestId}`, { headers: apiHeaders() })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: DiagnosticResult = await response.json()
      setDiagnosticResult(data)
      setActivation(Math.max(0.18, Math.min(1, data.attention_score / 100)))
      setRegion(getPrimaryRegion(data.region_activations))
      setMarkerDecisions({})
      setMarkerNotes({})
      setActiveSection('diagnostics')
      setInfoMessage(`Loaded: ${requestId.slice(0, 8)}…`)
    } catch {
      setErrorMessage('Failed to load diagnostic result.')
    }
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
      {/* Decorative brain — root level, behind everything, never intercepts events */}
      {activeSection !== 'insights' && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.18]" style={{ pointerEvents: 'none' }}>
          <BrainViewer decorative activationLevel={0.25} />
        </div>
      )}
      <div className="ui-layer flex w-full h-full" style={{ position: 'relative', zIndex: 1 }}>
        <motion.aside 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-64 glass-panel m-4 flex flex-col p-6 h-[calc(100vh-32px)] border-white/5"
        >
          <div className="flex items-center gap-2 mb-10 px-2 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/seedtag-icon.svg" alt="Seedtag icon" className="w-9 h-9" />
            </div>
            <div>
              <h1 className="text-[28px] leading-none" style={{ fontFamily: 'var(--font-instrument-serif)', fontStyle: 'italic', letterSpacing: '0.04em' }}>
                Neural<span className="text-seedtag-coral">Seed</span>
              </h1>
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
              icon={Settings}
              label="System Config"
              active={activeSection === 'config'}
              onClick={() => openSection('config')}
            />
            <SidebarItem
              icon={Clock}
              label="History"
              active={activeSection === 'history'}
              onClick={() => openSection('history')}
            />
            <SidebarItem
              icon={TrendingUp}
              label="Lifecycle"
              active={activeSection === 'lifecycle'}
              onClick={() => openSection('lifecycle')}
            />
          </nav>

          <div className="mt-auto">
            <div className="glass-card p-4 bg-white/[0.03] border-white/10 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Engine Status</span>
                <div className="flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${diagnosticResult ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-gray-600'}`} />
                  <span className="text-[10px] font-bold text-gray-300">{diagnosticResult ? 'Ready' : 'Idle'}</span>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/5 px-3 py-2">
                  <p className="text-[9px] text-gray-500 mb-0.5">Frames</p>
                  <p className="text-base font-bold text-white leading-none">{diagnosticResult?.frames_analyzed ?? '—'}</p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-2">
                  <p className="text-[9px] text-gray-500 mb-0.5">Confidence</p>
                  <p className="text-base font-bold text-white leading-none">
                    {diagnosticResult ? `${(diagnosticResult.prediction_confidence * 100).toFixed(0)}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Decision badge */}
              {diagnosticResult && (
                <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  diagnosticResult.final_decision.approved
                    ? 'bg-emerald-400/10 border border-emerald-400/20'
                    : 'bg-amber-400/10 border border-amber-400/20'
                }`}>
                  <span className="text-[9px] text-gray-400 uppercase tracking-wider">Decision</span>
                  <span className={`text-xs font-bold ${
                    diagnosticResult.final_decision.approved ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {diagnosticResult.final_decision.approved ? 'Approved' : 'Revisions'}
                  </span>
                </div>
              )}

              {/* Dominant region */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-gray-500">Dominant region</span>
                <span className="text-[10px] font-bold text-seedtag-coral truncate ml-2">
                  {diagnosticResult ? getRegionLabel(getPrimaryRegion(diagnosticResult.region_activations)) : '—'}
                </span>
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
              <button
                type="button"
                onClick={downloadUserGuide}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-bold text-gray-400 transition-all hover:bg-white/10 hover:text-white flex items-center justify-center gap-2"
              >
                <Download size={12} /> User Guide
              </button>
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

          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-4 pb-6 pt-2 gap-3">

            {/* Neural Insights — BrainViewer fills center */}
            {activeSection === 'insights' && (() => {
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
            })()}

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className={`w-[70%] mx-auto rounded-2xl backdrop-blur-xl bg-black/60 ring-1 ring-white/[0.06] ${activeSection !== 'diagnostics' ? 'hidden' : ''}`}
            >
              {isStaticImage && previewUrl ? (
                <StaticImageViewer
                  imageUrl={previewUrl}
                  heatmap={heatmapEnabled ? activeHeatmap : null}
                  isAnalyzing={isAnalyzing}
                  isDone={Boolean(diagnosticResult)}
                  selectedFileName={selectedFile?.name ?? null}
                  onSelectFile={selectFile}
                  onUpload={uploadVideo}
                  onAnalyze={analyzeCreative}
                  canAnalyze={Boolean(uploadResult?.request_id || selectedFile)}
                  onReset={resetSession}
                />
              ) : (
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
                onDepthChange={(d) => setAnalysisProfile(d, d === 'quick' ? 1 : d === 'deep' ? 3 : d === 'ultra' ? 6 : 2)}
                formatType={formatType}
                onFormatChange={setFormatType}
                markers={timelineMarkers}
                activeMarkerIndex={activeMarkerIndex}
                onMarkerClick={handleMarkerClick}
                seekTarget={videoSeekTarget}
                heatmap={heatmapEnabled ? activeHeatmap : null}
                heatmapType={activeHeatmapType}
              />
              )}
            </motion.div>

            {/* Marker info panel — always in DOM when diagnostic has markers, no layout jump */}
            {activeSection === 'diagnostics' && diagnosticResult && frameMarkers.length > 0 && (() => {
              const m = activeMarkerIndex !== null
                ? frameMarkers.find((fm) => fm.frameIndex === activeMarkerIndex) ?? null
                : null
              const decision = m ? markerDecisions[m.frameIndex] : undefined
              const currentIdx = m ? frameMarkers.findIndex((fm) => fm.frameIndex === m.frameIndex) : -1

              return (
                <div className={`w-full rounded-xl border px-5 py-4 flex items-center gap-5 transition-colors duration-200 ${
                  m
                    ? m.type === 'low-attention'
                      ? 'border-red-400/50 bg-[#1a0505]'
                      : 'border-amber-400/50 bg-[#1a1000]'
                    : 'border-white/10 bg-[#0e0e0e]'
                }`}>
                  {m ? (
                    <>
                      {/* Badge */}
                      <div className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-widest ${
                        m.type === 'low-attention' ? 'bg-red-500/40 text-red-200' : 'bg-amber-400/40 text-amber-200'
                      }`}>
                        {m.type === 'low-attention' ? 'Low Attention' : 'High Load'}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-3 mb-1">
                          <span className="text-sm font-bold text-white">{m.timestampSeconds}s</span>
                          <span className="text-xs text-gray-400">
                            Attention: <strong className="text-white">{m.attentionScore.toFixed(0)}</strong>
                            &nbsp;·&nbsp;Load: <strong className="text-white">{(m.sensoryLoad * 100).toFixed(0)}%</strong>
                            &nbsp;·&nbsp;{currentIdx + 1} of {frameMarkers.length}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 leading-snug truncate">{m.recommendation}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => navigateMarker('prev')} disabled={currentIdx <= 0}
                          className="flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-white/5 text-gray-400 transition-all hover:bg-white/10 disabled:opacity-30">
                          <ChevronLeft size={15} />
                        </button>
                        <button type="button" onClick={() => navigateMarker('next')} disabled={currentIdx >= frameMarkers.length - 1}
                          className="flex h-8 w-8 items-center justify-center rounded border border-white/10 bg-white/5 text-gray-400 transition-all hover:bg-white/10 disabled:opacity-30">
                          <ChevronRight size={15} />
                        </button>
                        <div className="w-px h-5 bg-white/10" />
                        <button type="button" onClick={() => setMarkerDecision(m.frameIndex, 'ok')}
                          className={`flex h-8 w-8 items-center justify-center rounded border transition-all ${
                            decision === 'ok' ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100' : 'border-white/10 bg-white/5 text-gray-400 hover:border-emerald-400/30 hover:text-emerald-300'
                          }`}>
                          <Check size={15} />
                        </button>
                        <button type="button" onClick={() => setMarkerDecision(m.frameIndex, 'flagged')}
                          className={`flex h-8 w-8 items-center justify-center rounded border transition-all ${
                            decision === 'flagged' ? 'border-red-400/40 bg-red-400/20 text-red-100' : 'border-white/10 bg-white/5 text-gray-400 hover:border-red-400/30 hover:text-red-300'
                          }`}>
                          <X size={15} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Click a marker on the timeline to inspect · {frameMarkers.length} marker{frameMarkers.length !== 1 ? 's' : ''} detected
                    </p>
                  )}
                </div>
              )
            })()}

            {/* Attention Timeline Chart — below marker panel, above stat cards */}
            {activeSection === 'diagnostics' && diagnosticResult && diagnosticResult.frame_insights.length >= 2 && (
              <AttentionChart
                frames={diagnosticResult.frame_insights}
                markers={timelineMarkers}
                activeMarkerIndex={activeMarkerIndex}
                onMarkerClick={handleMarkerClick}
              />
            )}

            {/* Stat cards */}
            {activeSection === 'diagnostics' && (
            <div className="grid grid-cols-3 gap-4">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                <StatCard
                  title="Attention Score"
                  value={diagnosticResult ? `${diagnosticResult.attention_score.toFixed(1)}` : '—'}
                  unit={diagnosticResult ? '%' : ''}
                  trend={diagnosticResult ? `${diagnosticResult.frames_analyzed} Frames` : 'Run a diagnostic'}
                  icon={Target}
                  info={RESULT_EXPLAINERS.attention}
                  badge={diagnosticResult ? {
                    text: diagnosticResult.attention_score >= 70 ? 'Strong' : diagnosticResult.attention_score >= 40 ? 'Moderate' : 'Low',
                    variant: diagnosticResult.attention_score >= 70 ? 'green' : diagnosticResult.attention_score >= 40 ? 'amber' : 'red',
                  } : undefined}
                />
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                <StatCard
                  title="Emotional Impact"
                  value={diagnosticResult ? `${(diagnosticResult.neural_resonance * 100).toFixed(0)}` : '—'}
                  unit={diagnosticResult ? '%' : ''}
                  trend={diagnosticResult ? `${(diagnosticResult.sensory_load * 100).toFixed(1)}% Sensory Load` : 'Run a diagnostic'}
                  icon={Zap}
                  info={RESULT_EXPLAINERS.resonance}
                  badge={diagnosticResult ? {
                    text: diagnosticResult.neural_resonance >= 0.65 ? 'Strong' : diagnosticResult.neural_resonance >= 0.40 ? 'Moderate' : 'Low',
                    variant: diagnosticResult.neural_resonance >= 0.65 ? 'green' : diagnosticResult.neural_resonance >= 0.40 ? 'amber' : 'red',
                  } : undefined}
                />
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
                <StatCard
                  title="Creative Type"
                  value={diagnosticResult?.final_decision.strategy_category ?? '—'}
                  unit=""
                  trend={diagnosticResult ? (diagnosticResult.final_decision.approved ? 'Approved' : 'Needs Revision') : 'Run a diagnostic'}
                  icon={Brain}
                  info={RESULT_EXPLAINERS.strategy}
                  badge={diagnosticResult ? {
                    text: diagnosticResult.final_decision.approved ? 'Approved' : 'Revision',
                    variant: diagnosticResult.final_decision.approved ? 'green' : 'amber',
                  } : undefined}
                />
              </motion.div>
            </div>
            )}

            {/* Lifecycle expanded center view */}
            {activeSection === 'lifecycle' && (
              <div className="flex-1 space-y-4">
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
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-4">Strategy Distribution — {historySummaries.length} past run{historySummaries.length !== 1 ? 's' : ''}</p>
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
            )}

            {/* ── History — Finder-style center view ── */}
            {activeSection === 'history' && (
              <div className="flex-1 flex flex-col gap-4 min-h-0">
                {/* Toolbar */}
                <div className="flex items-center justify-between shrink-0">
                  <p className="text-xs text-gray-500">
                    {isLoadingHistory ? 'Loading…' : `${historySummaries.length} past run${historySummaries.length !== 1 ? 's' : ''}`}
                    {historyEditMode && selectedHistoryIds.size > 0 && (
                      <span className="ml-2 text-seedtag-coral font-bold">· {selectedHistoryIds.size} selected</span>
                    )}
                  </p>
                  {!isLoadingHistory && historySummaries.length > 0 && (
                    historyEditMode ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryIds(new Set(historySummaries.map(s => s.request_id)))}
                          className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={exitHistoryEditMode}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:bg-white/10 transition-all"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setHistoryEditMode(true)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-gray-300 hover:bg-white/10 transition-all"
                      >
                        Edit
                      </button>
                    )
                  )}
                </div>

                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
                    <div className="w-6 h-6 border-2 border-seedtag-coral border-t-transparent rounded-full animate-spin mr-3" />
                    Loading history…
                  </div>
                ) : historySummaries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                    <Clock size={40} className="text-gray-700" />
                    <p className="text-sm font-bold text-gray-400">No past diagnostics yet</p>
                    <p className="text-xs text-gray-600">Run an analysis to start building history.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3 overflow-y-auto custom-scrollbar pb-20">
                    {historySummaries.map((entry) => {
                      const isSelected = selectedHistoryIds.has(entry.request_id)
                      return (
                        <div
                          key={entry.request_id}
                          className={`relative group rounded-xl border bg-white/[0.02] text-left transition-all overflow-hidden cursor-pointer ${
                            historyEditMode
                              ? isSelected
                                ? 'border-seedtag-coral/60 bg-seedtag-coral/10'
                                : 'border-white/10 hover:border-white/20'
                              : 'border-white/10 hover:border-seedtag-coral/40 hover:bg-seedtag-coral/5'
                          }`}
                          onClick={() => {
                            if (historyEditMode) {
                              toggleHistorySelection(entry.request_id)
                            } else {
                              loadHistoryEntry(entry.request_id)
                              openSection('diagnostics')
                            }
                          }}
                        >
                          {/* Colored header strip */}
                          <div className={`h-1.5 w-full ${entry.approved ? 'bg-emerald-400' : 'bg-amber-400'}`} />

                          {/* Checkbox overlay (edit mode) */}
                          {historyEditMode && (
                            <div className={`absolute top-3 right-3 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                              isSelected ? 'border-seedtag-coral bg-seedtag-coral' : 'border-white/30 bg-black/40'
                            }`}>
                              {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                            </div>
                          )}

                          <div className="p-4">
                            {/* Icon + badge */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                entry.approved ? 'bg-emerald-400/10' : 'bg-amber-400/10'
                              }`}>
                                <Film size={18} className={entry.approved ? 'text-emerald-400' : 'text-amber-400'} />
                              </div>
                              {!historyEditMode && (
                                <span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                                  entry.approved
                                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                                    : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                                }`}>
                                  {entry.approved ? 'Approved' : 'Revision'}
                                </span>
                              )}
                            </div>

                            {/* Filename */}
                            <p className={`text-xs font-bold truncate leading-snug mb-1 transition-colors ${
                              historyEditMode ? 'text-white' : 'text-white group-hover:text-seedtag-coral'
                            }`}>
                              {entry.filename}
                            </p>

                            {/* Score + strategy */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-bold text-seedtag-coral">{entry.attention_score.toFixed(0)}%</span>
                              <span className="text-[10px] text-gray-500 truncate">{entry.strategy_category}</span>
                            </div>

                            {/* Attention bar */}
                            <div className="h-1 w-full rounded-full bg-white/10 mb-3">
                              <div className="h-1 rounded-full bg-seedtag-coral/60" style={{ width: `${Math.min(entry.attention_score, 100)}%` }} />
                            </div>

                            {/* Footer meta */}
                            <div className="flex items-center justify-between text-[9px] text-gray-600">
                              <span>{entry.frames_analyzed} frames</span>
                              <span>{new Date(entry.analyzed_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Floating action bar */}
                {historyEditMode && selectedHistoryIds.size > 0 && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111]/95 px-5 py-3 shadow-2xl backdrop-blur-md">
                    <span className="text-xs font-bold text-white">
                      {selectedHistoryIds.size} run{selectedHistoryIds.size !== 1 ? 's' : ''} selected
                    </span>
                    <div className="h-4 w-px bg-white/10" />
                    <button
                      type="button"
                      onClick={backupSelectedEntries}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-gray-200 transition-all hover:bg-white/10"
                    >
                      <Download size={13} /> Backup ZIP
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedEntries}
                      disabled={isDeletingHistory}
                      className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/15 px-4 py-2 text-xs font-bold text-red-200 transition-all hover:bg-red-400/25 disabled:opacity-50"
                    >
                      {isDeletingHistory
                        ? <><div className="w-3 h-3 border border-red-300 border-t-transparent rounded-full animate-spin" /> Deleting…</>
                        : <><X size={13} /> Delete</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── System Config — center view ── */}
            {activeSection === 'config' && (
              <div className="flex-1 max-w-3xl mx-auto w-full space-y-6 py-2">

                {/* API Endpoint */}
                <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Server size={14} className="text-seedtag-coral" />
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Diagnostics API</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-white break-all">{DIAGNOSTICS_API_BASE}</p>
                  <p className="mt-2 text-[11px] text-gray-500">Frontend requests upload and analysis through this base URL.</p>
                </section>

                {/* Runtime — 2-col grid */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Runtime</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Dashboard', value: 'http://127.0.0.1:3005' },
                      { label: 'Backend Docs', value: 'http://127.0.0.1:8000/docs' },
                      { label: 'Frame Sampling', value: getFrameBudgetLabel(analysisDepth, frameRate) },
                      { label: 'Gemini', value: 'Server managed' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
                        <p className="text-xs font-bold text-white break-all">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Analysis Depth — 4 cards */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Analysis Depth</p>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { depth: 'quick' as AnalysisDepth, fps: 1, label: 'Quick', detail: 'Fast pass for smoke tests.' },
                      { depth: 'standard' as AnalysisDepth, fps: 2, label: 'Standard', detail: 'Recommended CTV QA balance.' },
                      { depth: 'deep' as AnalysisDepth, fps: 3, label: 'Deep', detail: 'More frames for fast edits.' },
                      { depth: 'ultra' as AnalysisDepth, fps: 6, label: 'Ultra High', detail: '6 fps — max resolution.' },
                    ].map((profile) => {
                      const selected = analysisDepth === profile.depth && frameRate === profile.fps
                      return (
                        <button
                          key={profile.depth}
                          type="button"
                          onClick={() => setAnalysisProfile(profile.depth, profile.fps)}
                          disabled={isUploading || isAnalyzing}
                          className={`rounded-xl border p-4 text-left transition-all disabled:opacity-50 ${
                            selected
                              ? 'border-seedtag-coral/40 bg-seedtag-coral/15'
                              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white">{profile.label}</span>
                            <span className="text-[10px] font-bold text-seedtag-coral">{profile.fps} fps</span>
                          </div>
                          <p className="text-[10px] leading-relaxed text-gray-400">{profile.detail}</p>
                        </button>
                      )
                    })}
                  </div>
                </section>

                {/* Controls */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Controls</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => window.open('http://127.0.0.1:8000/docs', '_blank', 'noopener,noreferrer')}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white transition-all hover:bg-white/10"
                    >
                      Open API Docs
                    </button>
                    <button
                      type="button"
                      onClick={resetSession}
                      className="flex-1 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs font-bold text-red-100 transition-all hover:bg-red-400/15"
                    >
                      Clear Current Session
                    </button>
                  </div>
                </section>
              </div>
            )}

            {errorMessage && (
              <div className="glass-card border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                {errorMessage}
              </div>
            )}

            {infoMessage && !errorMessage && (
              <div className="glass-card border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                {infoMessage}
              </div>
            )}

          </div>

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
          className={`w-[440px] glass-panel m-4 flex flex-col p-6 h-[calc(100vh-32px)] border-white/5 ${
            ['history', 'config'].includes(activeSection) ? 'hidden' : ''
          }`}
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

              {/* Hybrid review items (Brand Voice / Pacing / Transitions) */}
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
                        <div className="rounded-lg px-2 py-1.5">
                          <p className="mb-1 pr-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">{metric.name}</p>
                          <p className="pr-5 text-[11px] leading-snug text-gray-200">{REGION_EXPLAINERS[metric.name] ?? RESULT_EXPLAINERS.neural}</p>
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

                {/* ── Recommendations ─────────────────────────── */}
                {(() => {
                  const rec = buildRegionRecommendations(diagnosticResult)
                  if (!rec) return null
                  return (
                    <section className="space-y-2">
                      <SectionHeading title="Recommendations" info="Actionable insights derived from region activations." />
                      <div className="space-y-2">
                        {rec.working.length > 0 && (
                          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 p-3 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">What's working</p>
                            {rec.working.map(w => (
                              <p key={w.label} className="text-xs text-gray-300 leading-snug">
                                <span className="font-semibold text-white">{w.label} — </span>{w.reason}
                              </p>
                            ))}
                          </div>
                        )}
                        {rec.failing.length > 0 && (
                          <div className="rounded-lg border border-red-500/25 bg-red-500/8 p-3 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">What's failing</p>
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
                        <p className="mt-1 text-[9px] text-gray-600">
                          {new Date(entry.analyzed_at).toLocaleString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : activeSection === 'lifecycle' ? (
              <>
                  {/* Tab switcher */}
                  <div className="flex rounded-lg border border-white/10 overflow-hidden mb-1">
                    {(['benchmark', 'ab'] as const).map((tab) => (
                      <button key={tab} type="button" onClick={() => setLifecycleTab(tab)}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                          lifecycleTab === tab ? 'bg-seedtag-coral text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}>
                        {tab === 'benchmark' ? 'Benchmark' : 'A/B Compare'}
                      </button>
                    ))}
                  </div>

                  {lifecycleTab === 'benchmark' ? (
                    isLoadingHistory ? (
                      <div className="flex items-center justify-center py-12 text-gray-500 text-sm">Loading…</div>
                    ) : !diagnosticResult ? (
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center">
                        <TrendingUp size={28} className="mx-auto mb-3 text-gray-600" />
                        <p className="text-sm font-bold text-gray-400">No current diagnostic</p>
                        <p className="mt-1 text-xs text-gray-600">Run an analysis first to compare against history.</p>
                      </div>
                    ) : histAvg === null ? (
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center">
                        <p className="text-sm font-bold text-gray-400">No history yet</p>
                        <p className="mt-1 text-xs text-gray-600">Run more analyses to build a benchmark baseline.</p>
                      </div>
                    ) : (
                      <section className="space-y-3">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                            vs. average of {historySummaries.length} past run{historySummaries.length !== 1 ? 's' : ''}
                          </p>
                          {[
                            { label: 'Attention', current: diagnosticResult.attention_score, avg: histAvg.attention, unit: '%', higherIsBetter: true },
                            { label: 'Approval rate', current: diagnosticResult.final_decision.approved ? 100 : 0, avg: histAvg.approvalRate, unit: '%', higherIsBetter: true },
                            { label: 'Frames analyzed', current: diagnosticResult.frames_analyzed, avg: histAvg.frames, unit: '', higherIsBetter: true },
                          ].map(({ label, current, avg, unit, higherIsBetter }) => (
                            <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-white">{current.toFixed(1)}{unit}</span>
                                <span className="text-[10px] text-gray-600">avg {avg.toFixed(1)}{unit}</span>
                                <DeltaBadge current={current} avg={avg} higherIsBetter={higherIsBetter} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Strategy distribution</p>
                          {Array.from(new Set(historySummaries.map(h => h.strategy_category))).map(cat => {
                            const count = historySummaries.filter(h => h.strategy_category === cat).length
                            const pct = (count / historySummaries.length) * 100
                            return (
                              <div key={cat} className="mb-1.5">
                                <div className="flex justify-between text-[10px] mb-0.5">
                                  <span className={`font-bold ${diagnosticResult.final_decision.strategy_category === cat ? 'text-seedtag-coral' : 'text-gray-400'}`}>
                                    {cat} {diagnosticResult.final_decision.strategy_category === cat ? '← current' : ''}
                                  </span>
                                  <span className="text-gray-500">{count} run{count !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-white/10">
                                  <div className="h-1.5 rounded-full bg-seedtag-coral/60" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    )
                  ) : (
                    /* A/B tab */
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
                          {/* Selectors */}
                          {(['a', 'b'] as const).map((side) => (
                            <div key={side} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-seedtag-coral">Creative {side.toUpperCase()}</p>
                              <select
                                value={side === 'a' ? abIdA : abIdB}
                                onChange={(e) => { side === 'a' ? setAbIdA(e.target.value) : setAbIdB(e.target.value); side === 'a' ? setAbResultA(null) : setAbResultB(null) }}
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

                          {/* Comparison table */}
                          {abResultA && abResultB && (
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                              <div className="grid grid-cols-3 gap-2 mb-2">
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
                          )}
                        </>
                      )}
                    </section>
                  )}
                </>
              )
            : (
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
                    heatmap={heatmapEnabled ? activeHeatmap : null}
                    heatmapType={activeHeatmapType}
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

                      {/* Heatmap colour legend */}
                      <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 space-y-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Heatmap overlay</p>
                          <button
                            type="button"
                            onClick={() => setHeatmapEnabled((v) => !v)}
                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                              heatmapEnabled
                                ? 'bg-seedtag-coral/20 text-seedtag-coral border border-seedtag-coral/30'
                                : 'bg-white/5 text-gray-500 border border-white/10'
                            }`}
                          >
                            {heatmapEnabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
                          <span className="text-[10px] text-gray-300 leading-tight"><strong className="text-green-400">Verde</strong> — zona de foco activo (&lt; 40%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="text-[10px] text-gray-300 leading-tight"><strong className="text-amber-400">Amarillo</strong> — atención moderada (40–70%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
                          <span className="text-[10px] text-gray-300 leading-tight"><strong className="text-red-400">Rojo</strong> — alta carga cognitiva (&gt; 70%)</span>
                        </div>
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

      {/* Frame detail modal */}
      {selectedFrame && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setSelectedFrame(null)}
        >
          <div
            className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[#0c0c0f] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Frame {selectedFrame.frame_index + 1}</p>
                <p className="text-xl font-bold text-white">{selectedFrame.timestamp_seconds.toFixed(2)}s</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedFrame.dominant_region}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFrame(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Metrics bars */}
            <div className="space-y-3 mb-5">
              {[
                { label: 'Attention Score', value: selectedFrame.attention_score, max: 100, color: 'bg-seedtag-coral' },
                { label: 'Emotional Response', value: selectedFrame.emotional_response * 100, max: 100, color: 'bg-purple-400' },
                { label: 'Sensory Load', value: selectedFrame.sensory_load * 100, max: 100, color: 'bg-amber-400' },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-gray-400 font-medium">{m.label}</span>
                    <span className="font-bold text-white">{m.value.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full">
                    <div className={`h-2 rounded-full ${m.color} transition-all`} style={{ width: `${Math.min(m.value, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Cognitive response */}
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Cognitive Response</p>
              <p className="text-sm text-gray-200 leading-relaxed">{selectedFrame.cognitive_response}</p>
            </div>

            {/* Recommendation */}
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 mb-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400/70 mb-1.5">Recommendation</p>
              <p className="text-sm text-amber-100/80 leading-relaxed">{selectedFrame.recommendation}</p>
            </div>

            {/* Attention heatmap */}
            {selectedFrame.attention_map && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Attention Heatmap</p>
                <div
                  className="w-full rounded-lg overflow-hidden"
                  style={{ display: 'grid', gridTemplateRows: `repeat(${selectedFrame.attention_map.length}, 1fr)`, aspectRatio: '1' }}
                >
                  {selectedFrame.attention_map.map((row, r) => (
                    <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
                      {row.map((v, c) => (
                        <div
                          key={c}
                          style={{
                            background: v < 0.4
                              ? `rgba(34,197,94,${0.15 + v * 0.55})`
                              : v < 0.7
                                ? `rgba(251,191,36,${0.15 + v * 0.55})`
                                : `rgba(239,68,68,${0.15 + v * 0.55})`,
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  {[['bg-green-500', 'Focus zone'], ['bg-amber-400', 'Moderate load'], ['bg-red-500', 'High load']].map(([bg, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${bg}`} />
                      <span className="text-[10px] text-gray-500">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
