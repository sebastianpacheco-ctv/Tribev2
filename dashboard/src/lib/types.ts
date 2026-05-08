export type BrainRegionKey = 'frontal' | 'temporal' | 'visual' | 'emotional' | 'all'
export type DashboardSection = 'diagnostics' | 'insights' | 'config' | 'history' | 'lifecycle' | 'exec'
export type HybridReviewKey = 'brandVoice' | 'pacing' | 'transitions'
export type ReviewDecision = 'confirmed' | 'rejected'
export type AnalysisDepth = 'quick' | 'standard' | 'deep' | 'ultra'
export type MarkerDecision = 'ok' | 'flagged'

export interface UploadResponse {
  request_id: string
  filename: string
  status: string
  message: string
}

export interface DiagnosticResult {
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

export interface ActionableStep {
  priority: string
  title: string
  rationale: string
  frame_range: string
}

export interface FrameInsight {
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

export interface HistorySummary {
  request_id: string
  filename: string
  analyzed_at: string
  attention_score: number
  approved: boolean
  strategy_category: string
  frames_analyzed: number
}

export interface FrameMarker {
  frameIndex: number
  timestampSeconds: number
  type: 'low-attention' | 'high-load'
  attentionScore: number
  sensoryLoad: number
  recommendation: string
  cognitiveResponse: string
}

export interface AutomatedCheckItem {
  label: string
  passed: boolean | null
}

export interface HybridReviewItem {
  id: HybridReviewKey
  label: string
  value: string
  detail: string
  needsAttention: boolean
  icon: import('lucide-react').LucideIcon
}

export interface RegionRec {
  working: { label: string; reason: string }[]
  failing: { label: string; reason: string }[]
  action: { label: string; tip: string } | null
}
