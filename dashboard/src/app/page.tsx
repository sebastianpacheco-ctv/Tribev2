'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart3,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Download,
  FileText,
  FlaskConical,
  Settings,
  ShieldCheck,
  StickyNote,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import BrainViewer, { REGIONS as BRAIN_REGIONS } from '@/components/BrainViewer'
import VideoCortex, { type TimelineMarker } from '@/components/VideoCortex'
import AttentionChart from '@/components/AttentionChart'

import { DIAGNOSTICS_API_BASE, analyzeUrlPreview, apiHeaders, extractErrorMessage, uploadVideoWithProgress } from '@/lib/api'
import {
  buildAutomatedChecks,
  buildHybridReviewItems,
  dominantRegionToKey,
  getFrameBudgetLabel,
  getPrimaryRegion,
  getRegionLabel,
  RESULT_EXPLAINERS,
} from '@/lib/diagnostics'
import { captureCreativeDataUrl, createDiagnosticPdf, downloadUserGuide } from '@/lib/pdf'
import type {
  AnalysisDepth,
  BrainRegionKey,
  DashboardSection,
  DiagnosticResult,
  FrameInsight,
  FrameMarker,
  HistorySummary,
  HybridReviewKey,
  MarkerDecision,
  ReviewDecision,
  UploadResponse,
} from '@/lib/types'

import { StatCard } from '@/components/ui'
import { ConfigSection } from './sections/ConfigSection'
import TourOverlay from '@/components/TourOverlay'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DiagnosticsPanel } from './sections/DiagnosticsPanel'
import { ExecSummarySection } from './sections/ExecSummarySection'
import { HistorySection } from './sections/HistorySection'
import { LifecycleSection } from './sections/LifecycleSection'
import { NeuralInsightsSection } from './sections/NeuralInsightsSection'

// ─── Local components ─────────────────────────────────────────────────────────

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

// ─── Dashboard ────────────────────────────────────────────────────────────────

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
  const [engineType, setEngineType] = useState<'clip' | 'tribe'>('clip')
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
  const [lifecycleTab] = useState<'ab'>('ab')
  const [abIdA, setAbIdA] = useState<string>('')
  const [abIdB, setAbIdB] = useState<string>('')
  const [abResultA, setAbResultA] = useState<DiagnosticResult | null>(null)
  const [abResultB, setAbResultB] = useState<DiagnosticResult | null>(null)
  const [abLoadingA, setAbLoadingA] = useState(false)
  const [abLoadingB, setAbLoadingB] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file')
  const [urlInput, setUrlInput] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [historySearch, setHistorySearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'approved' | 'revision'>('all')
  const [tourActive, setTourActive] = useState(false)

  // ── Derived state ──────────────────────────────────────────────────────────

  const histAvg = useMemo(() => historySummaries.length > 0 ? {
    attention: historySummaries.reduce((s, h) => s + h.attention_score, 0) / historySummaries.length,
    approvalRate: historySummaries.filter(h => h.approved).length / historySummaries.length * 100,
    frames: historySummaries.reduce((s, h) => s + h.frames_analyzed, 0) / historySummaries.length,
  } : null, [historySummaries])

  const orderedRegions = useMemo(() => {
    if (!diagnosticResult) return ['visual', 'temporal', 'frontal'] as BrainRegionKey[]
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
      confirmed: decisions.filter((d) => d === 'confirmed').length,
      rejected: decisions.filter((d) => d === 'rejected').length,
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
      { name: 'Frontal (Attention)', value: (diagnosticResult.region_activations['Prefrontal Cortex (Attention)'] ?? 0) * 100, key: 'frontal'   as BrainRegionKey, color: colorMap.frontal },
      { name: 'Visual (V1)',         value: (diagnosticResult.region_activations['Visual Cortex (V1-V4)'] ?? 0) * 100,        key: 'visual'    as BrainRegionKey, color: colorMap.visual },
      { name: 'Temporal (Audio)',    value: (diagnosticResult.region_activations['Auditory Cortex (Temporal)'] ?? 0) * 100,   key: 'temporal'  as BrainRegionKey, color: colorMap.temporal },
      { name: 'Emotional',           value: (diagnosticResult.region_activations['Amygdala (Emotional)'] ?? 0) * 100,        key: 'emotional' as BrainRegionKey, color: colorMap.emotional },
    ]
  }, [activation, diagnosticResult])

  const sectionMeta = useMemo(() => {
    const metadata: Record<DashboardSection, { title: string; eyebrow: string; panelTitle: string; icon: LucideIcon }> = {
      diagnostics: { title: 'Visual Cortex Analysis',  eyebrow: 'Creative QA workspace',          panelTitle: 'Scorecard QA',    icon: ShieldCheck },
      insights:    { title: 'Neural Insight Console',  eyebrow: 'Region signals and model log',   panelTitle: 'Neural Insights', icon: BarChart3 },
      exec:        { title: 'Executive Summary',       eyebrow: 'Key findings for stakeholders',  panelTitle: 'Summary',         icon: FileText },
      config:      { title: 'System Config',           eyebrow: 'Runtime and endpoint controls',  panelTitle: 'System Config',   icon: Settings },
      history:     { title: 'Diagnostic History',      eyebrow: 'Past runs — click to reload',    panelTitle: 'History',         icon: Clock },
      lifecycle:   { title: 'Creative Compare',         eyebrow: 'A/B creative comparison',        panelTitle: 'Compare',         icon: TrendingUp },
    }
    return metadata[activeSection]
  }, [activeSection])

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  useEffect(() => {
    if (!isAnalyzing) return
    const timer = window.setInterval(() => {
      setAnalysisProgress((current) => {
        if (current >= 92) return current
        const increment = current < 35 ? 6 : current < 70 ? 3.5 : 1.25
        return Math.min(92, current + increment)
      })
    }, 450)
    return () => window.clearInterval(timer)
  }, [isAnalyzing])

  // ── Handlers ───────────────────────────────────────────────────────────────

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
        } catch { /* skip */ }
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

  const selectFile = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
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
    if (!selectedFile) { setErrorMessage('Select a video or image file before uploading.'); return null }
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
    if (!currentUpload) return
    setIsAnalyzing(true)
    setAnalysisProgress(8)
    try {
      const response = await fetch(`${DIAGNOSTICS_API_BASE}/analyze`, {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ request_id: currentUpload.request_id, frame_rate: frameRate, analysis_depth: analysisDepth, format_type: formatType, engine_type: engineType }),
      })
      if (!response.ok) throw new Error(await extractErrorMessage(response))
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
    if (!diagnosticResult) { setErrorMessage('Run an analysis before exporting the report.'); return }
    setErrorMessage(null)
    setInfoMessage('Preparing PDF export.')
    const creative = await captureCreativeDataUrl(previewUrl, isStaticImage, selectedFile?.name ?? uploadResult?.filename)
    await createDiagnosticPdf(diagnosticResult, reviewDecisions, frameMarkers, markerDecisions, markerNotes, creative)
    setInfoMessage('PDF report exported.')
  }

  const setHybridDecision = (id: HybridReviewKey, decision: ReviewDecision) => {
    setReviewDecisions((current) => ({ ...current, [id]: decision }))
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

  const setAnalysisProfile = (depth: AnalysisDepth, nextFrameRate: number) => {
    setAnalysisDepth(depth)
    setFrameRate(nextFrameRate)
    setInfoMessage(`Analysis profile set to ${getFrameBudgetLabel(depth, nextFrameRate)}.`)
  }

  const resetSession = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
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
    setScreenshotUrl(null)
    setUploadMode('file')
  }

  const analyzeFromUrl = async () => {
    const url = urlInput.trim()
    if (!url) { setErrorMessage('Enter a URL to analyze.'); return }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setErrorMessage('URL must start with http:// or https://')
      return
    }
    setIsAnalyzing(true)
    setErrorMessage(null)
    setAnalysisProgress(10)
    try {
      const result = await analyzeUrlPreview(url, analysisDepth, formatType)
      setDiagnosticResult(result)
      setScreenshotUrl(`${DIAGNOSTICS_API_BASE}/${result.request_id}/screenshot`)
      setAnalysisProgress(100)
      setInfoMessage('URL preview analyzed successfully.')
      openSection('diagnostics')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'URL analysis failed.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const loadDemoData = () => {
    const demo: DiagnosticResult = {
      request_id: 'demo-001',
      timestamp: new Date().toISOString(),
      attention_score: 73.4,
      neural_resonance: 0.68,
      region_activations: {
        'Prefrontal Cortex (Attention)': 0.734,
        'Auditory Cortex (Temporal)': 0.412,
        'Visual Cortex (V1-V4)': 0.581,
        'Amygdala (Emotional)': 0.68,
      },
      prediction_confidence: 0.87,
      sensory_load: 0.44,
      frames_analyzed: 18,
      ai_automated: {
        spelling_grammar_passed: true,
        cta_present: true,
        logo_visible: true,
        safe_zones_passed: true,
        resolution_passed: true,
        qr_code_scannable: null,
      },
      hybrid_flags: {
        pacing_warnings: ['Sensory load is moderate; verify that the offer remains readable in the densest frames.'],
        transition_warnings: [],
        brand_voice_score: 0.78,
      },
      actionable_steps: [
        { priority: 'Medium', title: 'Strengthen the focal point in mid-roll frames.', rationale: 'Predicted prefrontal attention dips slightly between 8s–12s.', frame_range: '8s-12s' },
        { priority: 'Low', title: 'Consider adding a subtitle for the CTA.', rationale: 'CTA contrast is sufficient but subtitles improve accessibility on CTV.', frame_range: 'Final 3 seconds' },
      ],
      frame_insights: [
        { frame_index: 0, timestamp_seconds: 0, dominant_region: 'Visual Cortex (V1-V4)', attention_score: 65.2, emotional_response: 0.52, sensory_load: 0.38, cognitive_response: 'Opening scene — moderate visual engagement. Consider a stronger hook.', recommendation: 'Add a high-contrast product shot in the first 2 seconds.', attention_map: null },
        { frame_index: 1, timestamp_seconds: 3, dominant_region: 'Prefrontal Cortex (Attention)', attention_score: 78.1, emotional_response: 0.71, sensory_load: 0.41, cognitive_response: 'Product reveal drives prefrontal activation. Viewer attention locked.', recommendation: 'Good. Maintain visual clarity through this beat.', attention_map: null },
        { frame_index: 2, timestamp_seconds: 6, dominant_region: 'Amygdala (Emotional)', attention_score: 82.4, emotional_response: 0.84, sensory_load: 0.47, cognitive_response: 'Emotional peak — strong resonance across all regions.', recommendation: 'Ideal placement for brand logo or key message.', attention_map: null },
        { frame_index: 3, timestamp_seconds: 9, dominant_region: 'Prefrontal Cortex (Attention)', attention_score: 69.3, emotional_response: 0.62, sensory_load: 0.52, cognitive_response: 'Attention holds but sensory load rises — visual complexity is high.', recommendation: 'Simplify background elements in this section.', attention_map: null },
        { frame_index: 4, timestamp_seconds: 12, dominant_region: 'Visual Cortex (V1-V4)', attention_score: 74.8, emotional_response: 0.58, sensory_load: 0.43, cognitive_response: 'CTA area — solid visual salience, legibility is good.', recommendation: 'Ensure CTA text is at least 48px equivalent at broadcast resolution.', attention_map: null },
        { frame_index: 5, timestamp_seconds: 15, dominant_region: 'Prefrontal Cortex (Attention)', attention_score: 76.2, emotional_response: 0.65, sensory_load: 0.39, cognitive_response: 'End card — strong brand recall signal. Viewer exits with brand top-of-mind.', recommendation: 'Optimal. Keep logo placement consistent across variants.', attention_map: null },
      ],
      final_decision: {
        strategy_category: 'Storytelling',
        approved: true,
        revisions_required: false,
      },
    }
    resetSession()
    setDiagnosticResult(demo)
    setInfoMessage('Demo data loaded — explore all diagnostics panels.')
    openSection('diagnostics')
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

    const insights = diagnosticResult.frame_insights
    if (insights.length > 0) {
      // Map progress (0–100%) → closest frame insight by timestamp
      const maxTs = insights[insights.length - 1].timestamp_seconds
      const currentTs = (progress / 100) * maxTs
      const closest = insights.reduce((prev, curr) =>
        Math.abs(curr.timestamp_seconds - currentTs) < Math.abs(prev.timestamp_seconds - currentTs) ? curr : prev
      )
      setRegion(dominantRegionToKey(closest.dominant_region))
      setActivation(Math.max(0.18, Math.min(1, closest.attention_score / 100)))
      // Keep heatmap in sync with playback — update even while playing
      setActiveMarkerIndex(prev => prev !== closest.frame_index ? closest.frame_index : prev)
    } else {
      // Fallback: no frame data — use ordered region sweep
      const baseActivation = diagnosticResult.attention_score / 100
      const wave = Math.sin(progress / 10) * 0.08
      setActivation(Math.max(0.18, Math.min(1, baseActivation * 0.85 + wave)))
      const regionIndex = Math.min(orderedRegions.length - 1, Math.floor((progress / 100) * orderedRegions.length))
      setRegion(orderedRegions[regionIndex] ?? getPrimaryRegion(diagnosticResult.region_activations))
    }
  }

  const PanelIcon = sectionMeta.icon

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-black selection:bg-seedtag-coral/30">
      {/* Decorative brain */}
      {activeSection !== 'insights' && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.18]" style={{ pointerEvents: 'none' }}>
          <BrainViewer decorative activationLevel={0.25} />
        </div>
      )}

      <div className="ui-layer flex w-full h-full" style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
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
            <SidebarItem icon={Activity}    label="Diagnostics"     active={activeSection === 'diagnostics'} onClick={() => openSection('diagnostics')} />
            <SidebarItem icon={BarChart3}   label="Neural Insights" active={activeSection === 'insights'}   onClick={() => openSection('insights')} />
            <div data-tour="exec-sidebar">
              <SidebarItem icon={FileText}  label="Exec Summary"   active={activeSection === 'exec'}        onClick={() => openSection('exec')} />
            </div>
            <div data-tour="history-sidebar">
              <SidebarItem icon={Clock}     label="History"         active={activeSection === 'history'}    onClick={() => openSection('history')} />
            </div>
            <SidebarItem icon={TrendingUp}  label="Compare"         active={activeSection === 'lifecycle'}  onClick={() => openSection('lifecycle')} />
            <SidebarItem icon={Settings}    label="System Config"   active={activeSection === 'config'}     onClick={() => openSection('config')} />
          </nav>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={loadDemoData}
              data-tour="demo-btn"
              className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold text-gray-500 border border-dashed border-white/10 hover:border-seedtag-coral/40 hover:text-seedtag-coral transition-all"
            >
              <FlaskConical size={14} />
              Demo
            </button>
            <button
              type="button"
              onClick={() => setTourActive(true)}
              title="Start tour"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold text-gray-500 border border-dashed border-white/10 hover:border-seedtag-coral/40 hover:text-seedtag-coral transition-all"
            >
              <Compass size={14} />
              Tour
            </button>
          </div>

          <div className="mt-auto">
            <div data-tour="engine-status" className="glass-card p-5 bg-white/[0.03] border-white/10 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Engine Status</span>
                <div className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${diagnosticResult ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-gray-600'}`} />
                  <span className="text-[10px] font-bold text-gray-300">{diagnosticResult ? 'Ready' : 'Idle'}</span>
                </div>
              </div>

              {/* Attention Score — hero metric */}
              <div className="rounded-xl bg-white/5 px-4 py-4">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Attention Score</p>
                <div className="flex items-baseline gap-2 mb-3">
                  <p className="text-4xl font-bold text-white leading-none">
                    {diagnosticResult ? diagnosticResult.attention_score.toFixed(0) : '—'}
                  </p>
                  <span className="text-base text-gray-500">/ 100</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-seedtag-coral transition-all duration-700"
                    style={{ width: diagnosticResult ? `${Math.min(diagnosticResult.attention_score, 100)}%` : '0%' }}
                  />
                </div>
              </div>

              {/* Frames + Confidence */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 px-3 py-3 flex flex-col gap-1.5">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide">Frames</p>
                  <p className="text-xl font-bold text-white leading-none">{diagnosticResult?.frames_analyzed ?? '—'}</p>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-3 flex flex-col gap-1.5">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wide">Conf.</p>
                  <p className="text-xl font-bold text-white leading-none">
                    {diagnosticResult ? `${(diagnosticResult.prediction_confidence * 100).toFixed(0)}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Decision */}
              <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                diagnosticResult
                  ? diagnosticResult.final_decision.approved
                    ? 'bg-emerald-400/10 border border-emerald-400/20'
                    : 'bg-amber-400/10 border border-amber-400/20'
                  : 'bg-white/5 border border-white/10'
              }`}>
                <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">Decision</span>
                <span className={`text-sm font-bold ${
                  diagnosticResult
                    ? diagnosticResult.final_decision.approved ? 'text-emerald-400' : 'text-amber-400'
                    : 'text-gray-600'
                }`}>
                  {diagnosticResult ? (diagnosticResult.final_decision.approved ? 'Approved' : 'Revisions') : '—'}
                </span>
              </div>

              {/* Region */}
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest whitespace-nowrap">Region</span>
                <span className="text-[10px] font-bold text-seedtag-coral ml-3 text-right leading-tight">
                  {diagnosticResult ? getRegionLabel(getPrimaryRegion(diagnosticResult.region_activations)) : '—'}
                </span>
              </div>

              {/* Engine badge */}
              <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">Engine</span>
                <span className={`text-[10px] font-bold ${engineType === 'tribe' ? 'text-violet-400' : 'text-gray-300'}`}>
                  {engineType === 'tribe' ? 'TRIBE v2 (Meta)' : 'CLIP Heuristic'}
                </span>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                {diagnosticResult && (
                  <button type="button" onClick={resetSession}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-gray-300 transition-all hover:bg-white/10 hover:text-white">
                    + New Creative
                  </button>
                )}
                <button type="button" onClick={downloadUserGuide}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-gray-400 transition-all hover:bg-white/10 hover:text-white flex items-center justify-center gap-2">
                  <Download size={12} /> User Guide
                </button>
              </div>
            </div>
          </div>
        </motion.aside>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col p-4 relative">
          <header className="flex justify-between items-center mb-6 px-4">
            <div>
              <h2 className="text-3xl font-bold text-gradient">{sectionMeta.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 text-sm">{sectionMeta.eyebrow}:</span>
                <span className="text-white text-sm font-medium">{selectedFile?.name ?? 'Awaiting creative upload'}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">
                  {isAnalyzing ? 'Analyzing Creative' : isUploading ? 'Uploading Video' : diagnosticResult ? 'Diagnostic Complete' : uploadResult ? 'Upload Ready' : 'Inference Ready'}
                </span>
              </div>
              <button type="button" onClick={() => openSection('config')}
                className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:border-seedtag-coral/50 transition-colors"
                aria-label="Open system config" title="Open system config">
                <Settings size={18} className="text-gray-400" />
              </button>
            </div>
          </header>

          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-4 pb-6 pt-2 gap-3">

            {/* Neural Insights — BrainViewer fills center */}
            {activeSection === 'insights' && (
              <ErrorBoundary label="Neural Insights">
                <NeuralInsightsSection
                  diagnosticResult={diagnosticResult}
                  activation={activation}
                  region={region}
                  hoveredRegion={hoveredRegion}
                  showConclusion={showConclusion}
                  setShowConclusion={setShowConclusion}
                  setHoveredRegion={setHoveredRegion}
                />
              </ErrorBoundary>
            )}

            {/* URL screenshot result — shown after URL analysis completes */}
            {activeSection === 'diagnostics' && uploadMode === 'url' && diagnosticResult && screenshotUrl && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-[70%] mx-auto"
              >
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/60 relative">
                  <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshotUrl}
                      alt="URL preview screenshot"
                      className="w-full block"
                    />
                  </div>
                  <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-gray-400 truncate max-w-[70%]">{urlInput}</span>
                    <button
                      type="button"
                      onClick={resetSession}
                      className="text-[11px] font-bold text-gray-300 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-all"
                    >
                      + New Creative
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* URL Preview input — diagnostics only, no result loaded */}
            {activeSection === 'diagnostics' && !diagnosticResult && (
              <div className="w-[70%] mx-auto mb-1">
                {/* Mode toggle */}
                <div className="flex rounded-lg border border-white/10 overflow-hidden mb-3">
                  {(['file', 'url'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setUploadMode(mode)}
                      className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-widest transition-all ${
                        uploadMode === mode ? 'bg-seedtag-coral text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {mode === 'file' ? 'Upload File' : 'Preview URL'}
                    </button>
                  ))}
                </div>

                {/* URL input card */}
                {uploadMode === 'url' && (
                  <div className="rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl p-4 flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') analyzeFromUrl() }}
                      placeholder="https://preview.seedtag.com/..."
                      disabled={isAnalyzing}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-seedtag-coral/50 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={analyzeFromUrl}
                      disabled={isAnalyzing || !urlInput.trim()}
                      className="rounded-lg bg-seedtag-coral px-4 py-2 text-xs font-bold text-white transition-all hover:bg-seedtag-coral/80 disabled:opacity-40"
                    >
                      {isAnalyzing ? 'Analyzing…' : 'Analyze'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Video player + marker panel + chart + stat cards (diagnostics only) */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              data-tour="upload-area"
              className={`w-[70%] mx-auto rounded-2xl backdrop-blur-xl bg-black/60 ring-1 ring-white/[0.06] ${activeSection !== 'diagnostics' || uploadMode === 'url' ? 'hidden' : ''}`}
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

            {/* Marker info panel */}
            {activeSection === 'diagnostics' && diagnosticResult && frameMarkers.length > 0 && (() => {
              const m = activeMarkerIndex !== null
                ? frameMarkers.find((fm) => fm.frameIndex === activeMarkerIndex) ?? null
                : null
              const decision = m ? markerDecisions[m.frameIndex] : undefined
              const currentIdx = m ? frameMarkers.findIndex((fm) => fm.frameIndex === m.frameIndex) : -1
              return (
                <div className={`w-full rounded-xl border px-5 py-4 flex items-center gap-5 transition-colors duration-200 ${
                  m ? m.type === 'low-attention' ? 'border-red-400/50 bg-[#1a0505]' : 'border-amber-400/50 bg-[#1a1000]' : 'border-white/10 bg-[#0e0e0e]'
                }`}>
                  {m ? (
                    <>
                      <div className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-widest ${m.type === 'low-attention' ? 'bg-red-500/40 text-red-200' : 'bg-amber-400/40 text-amber-200'}`}>
                        {m.type === 'low-attention' ? 'Low Attention' : 'High Load'}
                      </div>
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
                          className={`flex h-8 w-8 items-center justify-center rounded border transition-all ${decision === 'ok' ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100' : 'border-white/10 bg-white/5 text-gray-400 hover:border-emerald-400/30 hover:text-emerald-300'}`}>
                          <Check size={15} />
                        </button>
                        <button type="button" onClick={() => setMarkerDecision(m.frameIndex, 'flagged')}
                          className={`flex h-8 w-8 items-center justify-center rounded border transition-all ${decision === 'flagged' ? 'border-red-400/40 bg-red-400/20 text-red-100' : 'border-white/10 bg-white/5 text-gray-400 hover:border-red-400/30 hover:text-red-300'}`}>
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

            {/* Attention Timeline Chart */}
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
                    info={diagnosticResult
                      ? `Threshold: ≥70 Strong · 40–69 Moderate · <40 Low\n\nYour score of ${diagnosticResult.attention_score.toFixed(1)}% is ${diagnosticResult.attention_score >= 70 ? 'above the approval threshold — the creative holds focus effectively.' : diagnosticResult.attention_score >= 40 ? 'in the moderate range — there is room to strengthen the focal hierarchy.' : 'below threshold — the creative may not hold attention long enough to encode the message.'}`
                      : RESULT_EXPLAINERS.attention}
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
                    info={diagnosticResult
                      ? `Threshold: ≥65% Strong · 40–64% Moderate · <40% Low\nSensory load ideal range: 18–52%\n\nEmotional resonance at ${(diagnosticResult.neural_resonance * 100).toFixed(0)}% with ${(diagnosticResult.sensory_load * 100).toFixed(1)}% sensory load. ${diagnosticResult.sensory_load > 0.52 ? 'Load is high — simplify dense moments so the offer is easy to absorb.' : diagnosticResult.sensory_load < 0.18 ? 'Load is low — add a stronger visual or product cue to prevent attention drift.' : 'Load is in the optimal range.'}`
                      : RESULT_EXPLAINERS.resonance}
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
                    info={diagnosticResult
                      ? `Eye-Catching: high motion/contrast — immediate visual impact.\nStorytelling: emotional + rich color — builds connection over time.\nClever Concept: idea-led — resonates through clarity and originality.\n\nDetected: ${diagnosticResult.final_decision.strategy_category}. ${diagnosticResult.final_decision.approved ? 'All QA gates passed — ready to traffic.' : 'One or more QA gates need attention before trafficking.'}`
                      : RESULT_EXPLAINERS.strategy}
                    badge={diagnosticResult ? {
                      text: diagnosticResult.final_decision.approved ? 'Approved' : 'Revision',
                      variant: diagnosticResult.final_decision.approved ? 'green' : 'amber',
                    } : undefined}
                  />
                </motion.div>
              </div>
            )}

            {/* Lifecycle section */}
            {activeSection === 'exec' && (
              <ExecSummarySection
                diagnosticResult={diagnosticResult}
                onExportPdf={exportReport}
              />
            )}

            {activeSection === 'lifecycle' && (
              <LifecycleSection
                abResultA={abResultA}
                abResultB={abResultB}
                historySummaries={historySummaries}
                isLoadingHistory={isLoadingHistory}
                abIdA={abIdA}
                abIdB={abIdB}
                abLoadingA={abLoadingA}
                abLoadingB={abLoadingB}
                setAbIdA={setAbIdA}
                setAbIdB={setAbIdB}
                setAbResultA={setAbResultA}
                setAbResultB={setAbResultB}
                loadAbResult={loadAbResult}
                diagnosticResult={diagnosticResult}
                histAvg={histAvg}
              />
            )}

            {/* History section */}
            {activeSection === 'history' && (
              <HistorySection
                historySummaries={historySummaries}
                isLoadingHistory={isLoadingHistory}
                historyEditMode={historyEditMode}
                selectedHistoryIds={selectedHistoryIds}
                isDeletingHistory={isDeletingHistory}
                setHistoryEditMode={setHistoryEditMode}
                setSelectedHistoryIds={setSelectedHistoryIds}
                toggleHistorySelection={toggleHistorySelection}
                exitHistoryEditMode={exitHistoryEditMode}
                deleteSelectedEntries={deleteSelectedEntries}
                backupSelectedEntries={backupSelectedEntries}
                loadHistoryEntry={loadHistoryEntry}
                openSection={openSection}
                historySearch={historySearch}
                setHistorySearch={setHistorySearch}
                historyFilter={historyFilter}
                setHistoryFilter={setHistoryFilter}
              />
            )}

            {/* Config section */}
            {activeSection === 'config' && (
              <ConfigSection
                analysisDepth={analysisDepth}
                frameRate={frameRate}
                isUploading={isUploading}
                isAnalyzing={isAnalyzing}
                setAnalysisProfile={setAnalysisProfile}
                resetSession={resetSession}
                engineType={engineType}
                setEngineType={setEngineType}
              />
            )}

            {errorMessage && (
              <div className="glass-card border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>
            )}
            {infoMessage && !errorMessage && (
              <div className="glass-card border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{infoMessage}</div>
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
                    <div className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${((diagnosticResult?.prediction_confidence ?? 0.924) * 100).toFixed(1)}%` }} />
                  </div>
                  <span className="text-xs font-bold">{((diagnosticResult?.prediction_confidence ?? 0.924) * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Stimuli Batch</span>
                <span className="text-xs font-medium text-white">
                  {diagnosticResult ? `${diagnosticResult.frames_analyzed} frames @ ${frameRate} fps` : getFrameBudgetLabel(analysisDepth, frameRate)}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={!diagnosticResult}
              onClick={exportReport}
              className="flex items-center gap-2 px-8 py-3 bg-seedtag-coral text-white rounded-xl font-bold shadow-lg shadow-seedtag-coral/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Export Report
            </button>
          </motion.footer>
        </section>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        <motion.aside
          data-tour="diagnostics-panel"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`w-[440px] glass-panel m-4 flex flex-col p-6 h-[calc(100vh-32px)] border-white/5 ${
            ['history', 'config', 'exec', 'lifecycle'].includes(activeSection) ? 'hidden' : ''
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

          <ErrorBoundary label="Diagnostics Panel">
          <DiagnosticsPanel
            activeSection={activeSection}
            diagnosticResult={diagnosticResult}
            uploadResult={uploadResult}
            activation={activation}
            region={region}
            voxelMode={voxelMode}
            reviewDecisions={reviewDecisions}
            reviewSummary={reviewSummary}
            automatedChecks={automatedChecks}
            hybridReviewItems={hybridReviewItems}
            frameMarkers={frameMarkers}
            activeMarkerIndex={activeMarkerIndex}
            markerDecisions={markerDecisions}
            gateExpanded={gateExpanded}
            regionMetrics={regionMetrics}
            isLoadingHistory={isLoadingHistory}
            historySummaries={historySummaries}
            lifecycleTab={lifecycleTab}
            histAvg={histAvg}
            abResultA={abResultA}
            abResultB={abResultB}
            abIdA={abIdA}
            abIdB={abIdB}
            setAbIdA={setAbIdA}
            setAbIdB={setAbIdB}
            setAbResultA={setAbResultA}
            setAbResultB={setAbResultB}
            abLoadingA={abLoadingA}
            abLoadingB={abLoadingB}
            analysisDepth={analysisDepth}
            frameRate={frameRate}
            isUploading={isUploading}
            isAnalyzing={isAnalyzing}
            setHybridDecision={setHybridDecision}
            setMarkerDecision={setMarkerDecision}
            navigateMarker={navigateMarker}
            setGateExpanded={setGateExpanded}
            setSelectedFrame={setSelectedFrame}
            loadHistoryEntry={loadHistoryEntry}
            loadAbResult={loadAbResult}
            setAnalysisProfile={setAnalysisProfile}
            resetSession={resetSession}
          />
          </ErrorBoundary>

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

      {/* ── Human Gate overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {gateExpanded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
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
                  <button type="button" onClick={() => setGateExpanded(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition-all hover:border-red-400/30 hover:text-red-300"
                    aria-label="Close review">
                    <X size={16} />
                  </button>
                </div>
                <div className="w-[90%] mx-auto">
                  <VideoCortex
                    onTimeUpdate={handleTimeUpdate}
                    videoUrl={previewUrl}
                    selectedFileName={selectedFile?.name ?? uploadResult?.filename ?? null}
                    requestId={uploadResult?.request_id ?? diagnosticResult?.request_id ?? null}
                    isUploading={false} isAnalyzing={false}
                    uploadProgress={uploadProgress} analysisProgress={analysisProgress}
                    onSelectFile={selectFile} onUpload={uploadVideo} onAnalyze={analyzeCreative}
                    canAnalyze={false} hideControls
                    markers={timelineMarkers} activeMarkerIndex={activeMarkerIndex}
                    onMarkerClick={handleMarkerClick} seekTarget={videoSeekTarget}
                    heatmap={heatmapEnabled ? activeHeatmap : null} heatmapType={activeHeatmapType}
                  />
                </div>
                <p className="text-[10px] text-gray-500 text-center">Click a marker on the timeline or use Prev / Next to navigate</p>
              </div>

              {/* Right: review panel */}
              <div className="w-[420px] shrink-0 flex flex-col gap-4 border-l border-white/10 p-6 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Frame Markers</span>
                  <span className="text-xs font-bold text-amber-300">{Object.keys(markerDecisions).length} / {frameMarkers.length} reviewed</span>
                </div>
                <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${frameMarkers.length ? (Object.keys(markerDecisions).length / frameMarkers.length) * 100 : 0}%` }} />
                </div>

                {activeMarkerIndex !== null && (() => {
                  const m = frameMarkers.find((fm) => fm.frameIndex === activeMarkerIndex)
                  if (!m) return null
                  const decision = markerDecisions[m.frameIndex]
                  const note = markerNotes[m.frameIndex] ?? ''
                  const currentIdx = frameMarkers.findIndex((fm) => fm.frameIndex === m.frameIndex)
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => navigateMarker('prev')} disabled={currentIdx <= 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition-all hover:bg-white/10 disabled:opacity-30">
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold text-white">{currentIdx + 1} of {frameMarkers.length}</span>
                        <button type="button" onClick={() => navigateMarker('next')} disabled={currentIdx >= frameMarkers.length - 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition-all hover:bg-white/10 disabled:opacity-30">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className={`rounded-lg border p-3 space-y-2 ${m.type === 'low-attention' ? 'border-red-400/25 bg-red-500/10' : 'border-amber-400/25 bg-amber-400/10'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold uppercase tracking-widest ${m.type === 'low-attention' ? 'text-red-300' : 'text-amber-300'}`}>
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
                      <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 space-y-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Heatmap overlay</p>
                          <button type="button" onClick={() => setHeatmapEnabled((v) => !v)}
                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-colors ${heatmapEnabled ? 'bg-seedtag-coral/20 text-seedtag-coral border border-seedtag-coral/30' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                            {heatmapEnabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        {[['bg-green-500', 'Verde', 'text-green-400', 'zona de foco activo (< 40%)'], ['bg-amber-400', 'Amarillo', 'text-amber-400', 'atención moderada (40–70%)'], ['bg-red-500', 'Rojo', 'text-red-400', 'alta carga cognitiva (> 70%)']].map(([bg, label, color, desc]) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${bg} shrink-0`} />
                            <span className="text-[10px] text-gray-300 leading-tight"><strong className={color}>{label}</strong> — {desc}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setMarkerDecision(m.frameIndex, 'ok')}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all ${decision === 'ok' ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-100' : 'border-white/10 bg-white/5 text-gray-300 hover:border-emerald-400/30 hover:text-emerald-200'}`}>
                          <Check size={14} /> OK
                        </button>
                        <button type="button" onClick={() => setMarkerDecision(m.frameIndex, 'flagged')}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all ${decision === 'flagged' ? 'border-red-400/40 bg-red-400/20 text-red-100' : 'border-white/10 bg-white/5 text-gray-300 hover:border-red-400/30 hover:text-red-200'}`}>
                          <X size={14} /> Flag
                        </button>
                      </div>
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
                    <button type="button" onClick={() => navigateMarker('next')}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-200 transition-all hover:bg-amber-400/20">
                      Start Review <ChevronRight size={13} />
                    </button>
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

      {/* ── Frame detail modal ────────────────────────────────────────────── */}
      {selectedFrame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={() => setSelectedFrame(null)}>
          <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[#0c0c0f] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Frame {selectedFrame.frame_index + 1}</p>
                <p className="text-xl font-bold text-white">{selectedFrame.timestamp_seconds.toFixed(2)}s</p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedFrame.dominant_region}</p>
              </div>
              <button type="button" onClick={() => setSelectedFrame(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {[
                { label: 'Attention Score', value: selectedFrame.attention_score, color: 'bg-seedtag-coral' },
                { label: 'Emotional Response', value: selectedFrame.emotional_response * 100, color: 'bg-purple-400' },
                { label: 'Sensory Load', value: selectedFrame.sensory_load * 100, color: 'bg-amber-400' },
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
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 mb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Cognitive Response</p>
              <p className="text-sm text-gray-200 leading-relaxed">{selectedFrame.cognitive_response}</p>
            </div>
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 mb-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-400/70 mb-1.5">Recommendation</p>
              <p className="text-sm text-amber-100/80 leading-relaxed">{selectedFrame.recommendation}</p>
            </div>
            {selectedFrame.attention_map && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Attention Heatmap</p>
                <div className="w-full rounded-lg overflow-hidden"
                  style={{ display: 'grid', gridTemplateRows: `repeat(${selectedFrame.attention_map.length}, 1fr)`, aspectRatio: '1' }}>
                  {selectedFrame.attention_map.map((row, r) => (
                    <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
                      {row.map((v, c) => (
                        <div key={c} style={{ background: v < 0.4 ? `rgba(34,197,94,${0.15 + v * 0.55})` : v < 0.7 ? `rgba(251,191,36,${0.15 + v * 0.55})` : `rgba(239,68,68,${0.15 + v * 0.55})` }} />
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
      {tourActive && <TourOverlay onClose={() => setTourActive(false)} />}
    </main>
  )
}
