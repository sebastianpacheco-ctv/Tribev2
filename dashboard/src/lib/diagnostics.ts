import { Activity, Layers, UserCheck } from 'lucide-react'
import type { RegionDetail } from '@/components/BrainViewer'
import type {
  AnalysisDepth,
  AutomatedCheckItem,
  BrainRegionKey,
  DiagnosticResult,
  HybridReviewItem,
  HybridReviewKey,
  RegionRec,
  ReviewDecision,
} from './types'

export const RESULT_EXPLAINERS = {
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

export const REGION_MEANINGS: Record<string, { driver: string; high: string; low: string }> = {
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

export const HYBRID_EXPLAINERS: Record<HybridReviewKey, string> = {
  brandVoice:
    'How well the visual tone and messaging match the brand identity. A low score may mean the creative doesn\'t "feel like" the brand even if it\'s technically correct. Review brand guidelines before approving.',
  pacing:
    'The editing rhythm and cut speed. For CTV (large screen, lean-back viewing), fast cuts can cause fatigue; slow cuts risk losing attention. Review flagged moments in the Human Gate before approving.',
  transitions:
    'Quality and coherence of scene transitions. Abrupt cuts or overused effects lower perceived production quality and can drag down the Resonance score. Flag rough edits for the editor.',
}

export const REGION_EXPLAINERS: Record<string, string> = {
  'Visual (V1)':
    'Predicted activation of the visual processing area. High activation means the frame has enough contrast, color and motion to strongly engage the viewer\'s vision system.',
  'Temporal (Audio)':
    'Predicted activation of the auditory-processing area. Even without analyzing audio directly, editing rhythm and motion cues stimulate this predicted zone.',
  'Frontal (Attention)':
    'Predicted activation of the executive-attention area. High activation means the creative demands active cognitive engagement — the viewer is not passively watching.',
}

export function formatRatio(value: number, precision = 1) {
  return `${(value * 100).toFixed(precision)}%`
}

export function dominantRegionToKey(dominant: string): BrainRegionKey {
  if (dominant.includes('Prefrontal')) return 'frontal'
  if (dominant.includes('Temporal') || dominant.includes('Auditory')) return 'temporal'
  if (dominant.includes('Visual')) return 'visual'
  if (dominant.includes('Amygdala') || dominant.includes('Emotional')) return 'emotional'
  return 'all'
}

export function getRegionLabel(regionKey: BrainRegionKey) {
  if (regionKey === 'frontal') return 'Prefrontal Attention'
  if (regionKey === 'temporal') return 'Temporal Audio'
  if (regionKey === 'visual') return 'Visual Cortex'
  return 'Whole Brain'
}

export function getPrimaryRegion(activations?: Record<string, number>): BrainRegionKey {
  if (!activations) return 'all'

  const ordered: Array<{ key: BrainRegionKey; value: number }> = [
    { key: 'frontal', value: activations['Prefrontal Cortex (Attention)'] ?? 0 },
    { key: 'temporal', value: activations['Auditory Cortex (Temporal)'] ?? 0 },
    { key: 'visual', value: activations['Visual Cortex (V1-V4)'] ?? 0 },
  ]

  return ordered.sort((left, right) => right.value - left.value)[0]?.key ?? 'all'
}

export function buildBrainConclusion(
  result: DiagnosticResult | null,
): { headline: string; body: string; action: string } | null {
  if (!result) return null

  const entries = Object.entries(result.region_activations).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null

  const [dominantKey, ] = entries[0]
  const weakEntries = entries.filter(([, v]) => v < 0.4)
  const approved = result.final_decision.approved

  const dominant = REGION_MEANINGS[dominantKey]
  if (!dominant) return null

  const headline = approved
    ? `Strong creative — leads with ${dominant.driver}`
    : `Needs work — ${dominant.driver} is the only clear strength`

  const avgActivation = entries.reduce((s, [, v]) => s + v, 0) / entries.length
  const body =
    avgActivation >= 0.6
      ? 'This creative fires across all cognitive channels — high attention, emotional resonance, and visual impact working together.'
      : avgActivation >= 0.4
        ? `The creative has a clear lead in ${dominant.driver}, but other regions are underutilized — the message lacks full-spectrum impact.`
        : 'Activation is low across most brain regions. The creative is not generating consistent cognitive engagement.'

  const worstKey = weakEntries[0]?.[0]
  const worst = worstKey ? REGION_MEANINGS[worstKey] : null
  const action = worst
    ? `Priority fix: ${worst.low}`
    : `Maintain current strength in ${dominant.driver} and test variations to further boost recall.`

  return { headline, body, action }
}

export function buildNeuralLog(result: DiagnosticResult | null): string[] {
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

  if (pacingWarning) lines[2] = `Pacing warning: ${pacingWarning}`
  if (transitionWarning) lines[3] = `Transition warning: ${transitionWarning}`

  return lines
}

export function buildRegionRecommendations(result: DiagnosticResult | null): RegionRec | null {
  if (!result) return null
  const ra = result.region_activations

  const regions = [
    {
      key: 'Prefrontal Cortex (Attention)',
      label: 'Prefrontal',
      workReason: 'Strong attention lock — message clarity is high.',
      failReason: 'Attention is weak — viewers may drift before the CTA.',
      fix: 'Add a clear focal point or product cue in the first 3 seconds.',
    },
    {
      key: 'Visual Cortex (V1-V4)',
      label: 'Visual',
      workReason: 'Visual impact is strong — composition and contrast are working.',
      failReason: 'Low visual salience — the frame lacks contrast or a clear subject.',
      fix: 'Improve contrast, use bolder colors, or simplify the composition.',
    },
    {
      key: 'Auditory Cortex (Temporal)',
      label: 'Temporal',
      workReason: 'Audio and language engagement is strong.',
      failReason: 'Audio/language signal is weak — voiceover or music isn\'t landing.',
      fix: 'Strengthen the voiceover, add music energy, or make on-screen text more prominent.',
    },
    {
      key: 'Amygdala (Emotional)',
      label: 'Emotional',
      workReason: 'Strong emotional resonance — content is memorable.',
      failReason: 'Emotional response is low — content feels cold or detached.',
      fix: 'Add a human moment, a relatable scene, or a stronger emotional payoff at the end.',
    },
  ]

  const working: RegionRec['working'] = []
  const failing: RegionRec['failing'] = []
  let weakest: (typeof regions)[0] | null = null
  let weakestVal = 1

  for (const r of regions) {
    const val = ra[r.key] ?? 0
    if (val >= 0.65) working.push({ label: r.label, reason: r.workReason })
    else if (val < 0.4) failing.push({ label: r.label, reason: r.failReason })
    if (val < weakestVal) {
      weakestVal = val
      weakest = r
    }
  }

  const action = weakest && weakestVal < 0.6 ? { label: weakest.label, tip: weakest.fix } : null

  return { working, failing, action }
}

export function getFrameBudgetLabel(depth: AnalysisDepth, frameRate: number) {
  if (depth === 'quick') return `${frameRate} fps quick pass`
  if (depth === 'deep') return `${frameRate} fps deep pass`
  if (depth === 'ultra') return `${frameRate} fps ultra-high pass`
  return `${frameRate} fps standard pass`
}

export function buildRegionDetails(result: DiagnosticResult | null): Record<string, RegionDetail> {
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

  const details: Record<string, RegionDetail> = {}

  for (const r of regionConfig) {
    const val = ra[r.key] ?? 0
    const isHigh = val >= 0.6

    const related = insights.filter((f) => f.dominant_region === r.key)
    let timeRef: string | undefined
    if (related.length > 0) {
      const strongest = related.reduce((a, b) => (a.attention_score > b.attention_score ? a : b))
      const weakest = related.reduce((a, b) => (a.attention_score < b.attention_score ? a : b))
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

export function buildAutomatedChecks(result: DiagnosticResult | null): AutomatedCheckItem[] {
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

export function getAutomatedCheckExplanation(label: string): string {
  const explanations: Record<string, string> = {
    'Spelling + Grammar':
      'Checks for spelling or grammar errors visible on screen. Text with mistakes damages brand credibility and can be rejected by CTV platforms.',
    'CTA Present':
      'Detects whether the ad includes a visible call to action ("Visit our site", "Call now", etc.). Without a clear CTA, viewers don\'t know what to do after watching.',
    'Logo Visible':
      'Verifies the brand logo is clearly visible at some point in the video. Essential for brand recall in CTV, where the logo must be legible on large screens.',
    'Safe Zones':
      'Checks that key elements (text, logo, CTA) are within the safe margins of the screen. On CTV, edges may be cropped depending on the TV model.',
    Resolution:
      'Confirms the video meets the minimum quality standard for CTV broadcast. Low-resolution videos may be rejected by ad platforms.',
    'QR Code':
      'If the ad includes a QR code, verifies it has enough contrast and clarity to be scanned from a distance with a mobile phone.',
  }

  return explanations[label] ?? RESULT_EXPLAINERS.automated
}

export function buildHybridReviewItems(result: DiagnosticResult | null): HybridReviewItem[] {
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

export function getReviewDecisionLabel(decision?: ReviewDecision): string {
  if (decision === 'confirmed') return 'Confirmed'
  if (decision === 'rejected') return 'Rejected'
  return 'Pending human review'
}
