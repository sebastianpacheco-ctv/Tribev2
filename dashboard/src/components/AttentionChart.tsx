'use client'

import { useState, useRef } from 'react'

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

const W = 600
const H = 100
const PAD_L = 28
const PAD_R = 8
const PAD_T = 8
const PAD_B = 20
const CHART_W = W - PAD_L - PAD_R
const CHART_H = H - PAD_T - PAD_B

export default function AttentionChart({
  frames,
  markers = [],
  activeMarkerIndex = null,
  onMarkerClick,
}: AttentionChartProps) {
  const [hoveredFrame, setHoveredFrame] = useState<FramePoint | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (frames.length < 2) return null

  const maxT = Math.max(...frames.map((f) => f.timestamp_seconds))
  if (maxT <= 0) return null

  const toX = (t: number) => PAD_L + (t / maxT) * CHART_W
  const toY = (v: number) => PAD_T + CHART_H - (Math.max(0, Math.min(100, v)) / 100) * CHART_H
  const bottomY = PAD_T + CHART_H

  const areaPoints = [
    `${toX(frames[0].timestamp_seconds)},${bottomY}`,
    ...frames.map((f) => `${toX(f.timestamp_seconds)},${toY(f.attention_score)}`),
    `${toX(frames[frames.length - 1].timestamp_seconds)},${bottomY}`,
  ].join(' ')

  const attentionLine = frames
    .map((f) => `${toX(f.timestamp_seconds)},${toY(f.attention_score)}`)
    .join(' ')

  const loadLine = frames
    .map((f) => `${toX(f.timestamp_seconds)},${toY(f.sensory_load * 100)}`)
    .join(' ')

  const refY = toY(75)

  const step = Math.max(1, Math.floor(frames.length / 6))
  const xLabels = frames.filter((_, i) => i % step === 0 || i === frames.length - 1)

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * W
    if (mouseX < PAD_L || mouseX > W - PAD_R) {
      setHoveredFrame(null)
      return
    }
    let closest = frames[0]
    let minDist = Infinity
    for (const f of frames) {
      const d = Math.abs(toX(f.timestamp_seconds) - mouseX)
      if (d < minDist) { minDist = d; closest = f }
    }
    setHoveredFrame(closest)
  }

  const hf = hoveredFrame

  return (
    <div className="w-full rounded-xl border border-white/10 bg-[#0e0e0e] px-3 pt-3 pb-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Attention Timeline
        </span>
        <div className="flex items-center gap-3 text-[9px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-seedtag-coral/50" />
            Attention
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 border-t border-dashed border-amber-400/70" />
            Load
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 border-t border-dashed border-red-500/40" />
            Threshold
          </span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        style={{ height: 80 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredFrame(null)}
      >
        <defs>
          <linearGradient id="attentionGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E85D64" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E85D64" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        {/* Subtle grid */}
        {[25, 50, 75].map((v) => (
          <line
            key={v}
            x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)}
            stroke="white" strokeOpacity="0.05" strokeWidth="0.5"
          />
        ))}

        {/* Threshold line at 75 */}
        <line
          x1={PAD_L} y1={refY} x2={W - PAD_R} y2={refY}
          stroke="#ef4444" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="4 3"
        />

        {/* Attention area fill */}
        <polygon points={areaPoints} fill="url(#attentionGrad)" />

        {/* Attention line */}
        <polyline
          points={attentionLine}
          fill="none" stroke="#E85D64" strokeWidth="1.5" strokeLinejoin="round"
        />

        {/* Sensory load line */}
        <polyline
          points={loadLine}
          fill="none" stroke="#f59e0b"
          strokeWidth="1" strokeOpacity="0.65" strokeLinejoin="round" strokeDasharray="3 2"
        />

        {/* Hovered vertical guide */}
        {hf && (
          <line
            x1={toX(hf.timestamp_seconds)} y1={PAD_T}
            x2={toX(hf.timestamp_seconds)} y2={bottomY}
            stroke="white" strokeOpacity="0.18" strokeWidth="0.8"
          />
        )}

        {/* Marker dots */}
        {markers.map((m) => {
          const frame = frames.find((f) => f.frame_index === m.frameIndex)
          const cx = toX(m.timestampSeconds)
          const cy = frame ? toY(frame.attention_score) : toY(50)
          const isActive = m.frameIndex === activeMarkerIndex
          const color = m.type === 'low-attention' ? '#ef4444' : '#f59e0b'
          return (
            <g
              key={m.frameIndex}
              onClick={() => onMarkerClick?.(m.frameIndex, m.timestampSeconds)}
              className="cursor-pointer"
            >
              {isActive && (
                <circle cx={cx} cy={cy} r={7} fill={color} fillOpacity="0.22" />
              )}
              <circle
                cx={cx} cy={cy}
                r={isActive ? 3.5 : 2.5}
                fill={color}
                stroke="white"
                strokeWidth={isActive ? 1.2 : 0.6}
                strokeOpacity={isActive ? 1 : 0.6}
              />
            </g>
          )
        })}

        {/* Hovered frame dot */}
        {hf && (
          <circle
            cx={toX(hf.timestamp_seconds)} cy={toY(hf.attention_score)}
            r={3} fill="white" fillOpacity="0.9" pointerEvents="none"
          />
        )}

        {/* Y axis labels */}
        {[0, 50, 100].map((v) => (
          <text
            key={v}
            x={PAD_L - 4} y={toY(v) + 3}
            textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.22)"
          >
            {v}
          </text>
        ))}

        {/* X axis labels */}
        {xLabels.map((f) => (
          <text
            key={f.frame_index}
            x={toX(f.timestamp_seconds)} y={H - 3}
            textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.22)"
          >
            {f.timestamp_seconds.toFixed(0)}s
          </text>
        ))}
      </svg>

      {/* Tooltip bar */}
      <div className="h-5 flex items-center gap-3 text-[10px]">
        {hf ? (
          <>
            <span className="font-mono text-white">{hf.timestamp_seconds.toFixed(1)}s</span>
            <span className="text-gray-400">
              Attention: <strong className="text-seedtag-coral">{hf.attention_score.toFixed(0)}</strong>
            </span>
            <span className="text-gray-400">
              Load: <strong className="text-amber-400">{(hf.sensory_load * 100).toFixed(0)}%</strong>
            </span>
            <span className="text-gray-600">{hf.dominant_region}</span>
          </>
        ) : (
          <span className="text-gray-600">Hover to inspect · click a marker dot to seek</span>
        )}
      </div>
    </div>
  )
}
