'use client'

import { useState, useRef, useEffect } from 'react'

interface FramePoint {
  frame_index: number
  timestamp_seconds: number
  attention_score: number
  sensory_load: number
  dominant_region: string
}

interface Marker {
  frameIndex: number
  timestampSeconds: number
  type: 'low-attention' | 'high-load'
}

interface AttentionChartProps {
  frames: FramePoint[]
  markers?: Marker[]
  activeMarkerIndex?: number | null
  onMarkerClick?: (frameIndex: number, timestampSeconds: number) => void
}

const H = 160
const PAD_L = 40
const PAD_R = 16
const PAD_T = 16
const PAD_B = 30
const CHART_H = H - PAD_T - PAD_B
const MIN_ZOOM = 1
const MAX_ZOOM = 8

export default function AttentionChart({
  frames,
  markers = [],
  activeMarkerIndex = null,
  onMarkerClick,
}: AttentionChartProps) {
  const [hoveredFrame, setHoveredFrame] = useState<FramePoint | null>(null)
  const [zoom, setZoom] = useState(1)
  const [containerWidth, setContainerWidth] = useState(800)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Track actual container width for pixel-perfect rendering (no aspect ratio distortion)
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Non-passive wheel listener — always preventDefault to stop scroll bubbling to parent.
  // Pan (horizontal) and zoom (vertical) are handled manually.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal scroll → pan the chart
        el.scrollLeft += e.deltaX
      } else {
        // Vertical scroll → zoom
        const factor = e.deltaY < 0 ? 1.25 : 0.8
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  if (frames.length < 2) return null
  const maxT = Math.max(...frames.map((f) => f.timestamp_seconds))
  if (maxT <= 0) return null

  // SVG pixel width = container × zoom (scroll appears when zoom > 1)
  const svgW = Math.round(containerWidth * zoom)
  const CHART_W = svgW - PAD_L - PAD_R
  const bottomY = PAD_T + CHART_H

  const toX = (t: number) => PAD_L + (t / maxT) * CHART_W
  const toY = (v: number) => PAD_T + CHART_H - (Math.max(0, Math.min(100, v)) / 100) * CHART_H

  const getLogicalX = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return e.clientX - rect.left  // direct pixel (SVG has no viewBox)
  }

  const findClosestFrame = (px: number) => {
    let closest = frames[0]
    let minDist = Infinity
    for (const f of frames) {
      const d = Math.abs(toX(f.timestamp_seconds) - px)
      if (d < minDist) { minDist = d; closest = f }
    }
    return closest
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const px = getLogicalX(e)
    if (px === null || px < PAD_L || px > svgW - PAD_R) { setHoveredFrame(null); return }
    setHoveredFrame(findClosestFrame(px))
  }

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const px = getLogicalX(e)
    if (px === null || px < PAD_L || px > svgW - PAD_R) return
    const f = findClosestFrame(px)
    onMarkerClick?.(f.frame_index, f.timestamp_seconds)
  }

  // Handled via non-passive DOM listener in useEffect above

  // Geometry
  const areaPoints = [
    `${toX(frames[0].timestamp_seconds)},${bottomY}`,
    ...frames.map((f) => `${toX(f.timestamp_seconds)},${toY(f.attention_score)}`),
    `${toX(frames[frames.length - 1].timestamp_seconds)},${bottomY}`,
  ].join(' ')

  const attentionLine = frames.map((f) => `${toX(f.timestamp_seconds)},${toY(f.attention_score)}`).join(' ')
  const loadLine = frames.map((f) => `${toX(f.timestamp_seconds)},${toY(f.sensory_load * 100)}`).join(' ')
  const refY = toY(75)

  const xStep = Math.max(1, Math.floor(frames.length / 10))
  const xLabels = frames.filter((_, i) => i % xStep === 0 || i === frames.length - 1)

  const hf = hoveredFrame

  return (
    <div className="w-full rounded-xl border border-white/10 bg-[#0e0e0e] px-3 pt-3 pb-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Attention Timeline
          </span>
          {zoom > 1 && (
            <button
              onClick={() => setZoom(1)}
              className="text-[9px] text-gray-500 hover:text-gray-300 border border-white/10 rounded px-1.5 py-0.5 transition-colors"
            >
              Reset zoom ({zoom.toFixed(1)}×)
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 text-[10px] text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-seedtag-coral/50" />
            Attention
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-amber-400/70" />
            Load
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-red-500/50" />
            Threshold
          </span>
        </div>
      </div>

      {/* Scroll wrapper — ref here for ResizeObserver */}
      <div
        ref={wrapperRef}
        className="overflow-x-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
      >
        <svg
          ref={svgRef}
          width={svgW}
          height={H}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredFrame(null)}
          onClick={handleClick}
          className="cursor-crosshair block"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="attentionGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E85D64" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#E85D64" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid */}
          {[0, 25, 50, 75, 100].map((v) => (
            <line key={v} x1={PAD_L} y1={toY(v)} x2={svgW - PAD_R} y2={toY(v)}
              stroke="white" strokeOpacity="0.06" strokeWidth="0.5" />
          ))}

          {/* Threshold at 75 */}
          <line x1={PAD_L} y1={refY} x2={svgW - PAD_R} y2={refY}
            stroke="#ef4444" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="5 4" />

          {/* Attention area */}
          <polygon points={areaPoints} fill="url(#attentionGrad)" />

          {/* Attention line */}
          <polyline points={attentionLine} fill="none" stroke="#E85D64" strokeWidth="2" strokeLinejoin="round" />

          {/* Sensory load line */}
          <polyline points={loadLine} fill="none" stroke="#f59e0b"
            strokeWidth="1.2" strokeOpacity="0.7" strokeLinejoin="round" strokeDasharray="4 3" />

          {/* Frame dots — clickable seek points */}
          {frames.map((f) => {
            const cx = toX(f.timestamp_seconds)
            const cy = toY(f.attention_score)
            const isHovered = hf?.frame_index === f.frame_index
            return (
              <circle key={f.frame_index} cx={cx} cy={cy}
                r={isHovered ? 5 : 3}
                fill={isHovered ? 'white' : '#E85D64'}
                fillOpacity={isHovered ? 0.95 : 0.55}
              />
            )
          })}

          {/* Hover vertical guide */}
          {hf && (
            <line x1={toX(hf.timestamp_seconds)} y1={PAD_T} x2={toX(hf.timestamp_seconds)} y2={bottomY}
              stroke="white" strokeOpacity="0.2" strokeWidth="1" />
          )}

          {/* Marker dots */}
          {markers.map((m) => {
            const frame = frames.find((f) => f.frame_index === m.frameIndex)
            const cx = toX(m.timestampSeconds)
            const cy = frame ? toY(frame.attention_score) : toY(50)
            const isActive = m.frameIndex === activeMarkerIndex
            const color = m.type === 'low-attention' ? '#ef4444' : '#f59e0b'
            return (
              <g key={m.frameIndex} onClick={(e) => { e.stopPropagation(); onMarkerClick?.(m.frameIndex, m.timestampSeconds) }} className="cursor-pointer">
                {isActive && <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity="0.25" />}
                <circle cx={cx} cy={cy} r={isActive ? 5 : 4}
                  fill={color} stroke="white" strokeWidth={isActive ? 1.5 : 1} strokeOpacity={isActive ? 1 : 0.85} />
              </g>
            )
          })}

          {/* Y labels */}
          {[0, 25, 50, 75, 100].map((v) => (
            <text key={v} x={PAD_L - 8} y={toY(v) + 4}
              textAnchor="end" fontSize="13" fill="rgba(255,255,255,0.7)" fontFamily="Instrument Sans, sans-serif">
              {v}
            </text>
          ))}

          {/* X labels */}
          {xLabels.map((f) => (
            <text key={f.frame_index} x={toX(f.timestamp_seconds)} y={H - 6}
              textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.7)" fontFamily="Instrument Sans, sans-serif">
              {f.timestamp_seconds.toFixed(0)}s
            </text>
          ))}
        </svg>
      </div>

      {/* Tooltip bar */}
      <div className="h-5 mt-1 flex items-center gap-3 text-[10px]">
        {hf ? (
          <>
            <span className="font-mono text-white">{hf.timestamp_seconds.toFixed(1)}s</span>
            <span className="text-gray-400">Attention: <strong className="text-seedtag-coral">{hf.attention_score.toFixed(0)}</strong></span>
            <span className="text-gray-400">Load: <strong className="text-amber-400">{(hf.sensory_load * 100).toFixed(0)}%</strong></span>
            <span className="text-gray-600">{hf.dominant_region}</span>
          </>
        ) : (
          <span className="text-gray-600">Hover to inspect · click to seek · scroll to zoom</span>
        )}
      </div>
    </div>
  )
}
