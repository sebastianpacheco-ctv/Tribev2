import type { DiagnosticResult, FrameMarker, HybridReviewKey, MarkerDecision, ReviewDecision } from './types'
import { buildHybridReviewItems, formatRatio } from './diagnostics'

async function loadPdfAssets(doc: import('jspdf').jsPDF): Promise<string | null> {
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

export async function downloadUserGuide() {
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

  // Page 1 — Main Metrics
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

  // Page 2 — QA + Human Review
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

  // Page 3 — Neural Signals + Markers
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

export async function captureCreativeDataUrl(
  previewUrl: string | null,
  isStaticImage: boolean,
  filename?: string,
): Promise<{ dataUrl: string; ar: number; filename: string } | null> {
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

export async function createDiagnosticPdf(
  result: DiagnosticResult,
  reviewDecisions: Partial<Record<HybridReviewKey, ReviewDecision>>,
  frameMarkers: FrameMarker[],
  markerDecisions: Record<number, MarkerDecision>,
  markerNotes: Record<number, string>,
  creative: { dataUrl: string; ar: number; filename: string } | null,
) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const iconDataUrl = await loadPdfAssets(doc)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const pageBottom = pageHeight - 12

  const ink: [number, number, number]    = [26, 26, 26]
  const gray: [number, number, number]   = [107, 114, 128]
  const border: [number, number, number] = [229, 229, 229]
  const coral: [number, number, number]  = [232, 93, 100]
  const track: [number, number, number]  = [245, 197, 199]
  const bgPage: [number, number, number] = [248, 248, 248]
  const green: [number, number, number]  = [22, 163, 74]
  const red: [number, number, number]    = [220, 38, 38]
  const amber: [number, number, number]  = [217, 119, 6]

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

  // PAGE 1 — Overview
  addHeader('Creative Diagnostics Report')

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

  const cw = (pageWidth - margin * 2 - 12) / 4
  const metricCards = [
    { label: 'Attention',    value: `${result.attention_score.toFixed(0)}%`,          norm: result.attention_score / 100 },
    { label: 'Resonance',    value: result.neural_resonance.toFixed(2),               norm: result.neural_resonance },
    { label: 'Confidence',   value: formatRatio(result.prediction_confidence),        norm: result.prediction_confidence },
    { label: 'Sensory Load', value: `${(result.sensory_load * 100).toFixed(0)}%`,     norm: result.sensory_load },
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

  addSectionLabel('Automated QA', 134)
  const qaItems: [string, boolean | null][] = [
    ['Spelling + Grammar', result.ai_automated.spelling_grammar_passed],
    ['CTA Present',        result.ai_automated.cta_present],
    ['Logo Visible',       result.ai_automated.logo_visible],
    ['Safe Zones',         result.ai_automated.safe_zones_passed],
    ['Resolution',         result.ai_automated.resolution_passed],
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

  // PAGE 2 — Creative Preview
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

  // PAGE 3 — Human Review + Action Plan
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

  // PAGE 4 — Frame Table
  doc.addPage()
  addHeader('Frame-Level Predicted Response')
  addSectionLabel('Frame Diagnostics', 26)
  cursorY = 33

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
    const regionShort = frame.dominant_region
      .replace(' Cortex (Attention)', '')
      .replace(' (V1-V4)', '')
      .replace(' (Temporal)', '')
      .replace(' (Emotional)', '')
    doc.text(doc.splitTextToSize(regionShort, 42)[0], margin + 42, cursorY + 6)
    doc.text(doc.splitTextToSize(frame.cognitive_response, 82)[0], margin + 88, cursorY + 6)
    cursorY += rowH
  })

  // PAGE 5 — Frame Markers
  if (frameMarkers.length > 0) {
    doc.addPage()
    addHeader('Human Gate — Frame Review')
    const reviewedCount = Object.keys(markerDecisions).length
    doc.setFont('InstrumentSans', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...gray)
    doc.text(
      `${reviewedCount} of ${frameMarkers.length} reviewed  ·  ${frameMarkers.filter((m) => m.type === 'low-attention').length} low-attention  ·  ${frameMarkers.filter((m) => m.type === 'high-load').length} high-load`,
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

      doc.setFont('InstrumentSans', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...ink)
      doc.text(`${m.timestampSeconds.toFixed(1)}s`, margin + 5, cursorY + 8)

      const badgeW = m.type === 'low-attention' ? 24 : 19
      doc.setFillColor(...typeC)
      doc.roundedRect(margin + 22, cursorY + 3, badgeW, 6, 1, 1, 'F')
      doc.setFont('InstrumentSans', 'bold')
      doc.setFontSize(5.5)
      doc.setTextColor(255, 255, 255)
      doc.text(m.type === 'low-attention' ? 'Low Attn' : 'Hi Load', margin + 23, cursorY + 7.5)

      doc.setFont('InstrumentSans', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...decisionC)
      doc.text(decisionLabel, pageWidth - margin - 5, cursorY + 8, { align: 'right' })

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
