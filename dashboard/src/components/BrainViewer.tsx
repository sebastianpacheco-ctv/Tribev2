'use client'

import { Component, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

type BrainRegionId = 'frontal' | 'visual' | 'temporal' | 'emotional'

export interface RegionDetail {
  why: string
  fix: string
  timeRef?: string  // e.g. "peaks at 12s, drops at 34s"
}

interface BrainProps {
  activationLevel?: number
  activeRegion?: BrainRegionId | 'all'
  regionActivations?: Record<string, number>
  approved?: boolean | null
  highlightRegion?: BrainRegionId | 'all'
  decorative?: boolean
  onRegionHover?: (id: BrainRegionId | null) => void
  regionDetails?: Record<string, RegionDetail>
}

interface RegionMeta {
  key: string
  id: 'frontal' | 'visual' | 'temporal' | 'emotional'
  label: string
  shortLabel: string
  color: string
  hsl: [number, number, number]
  description: string
  px: number
  py: number
}

const REGIONS: RegionMeta[] = [
  {
    key: 'Prefrontal Cortex (Attention)',
    id: 'frontal',
    label: 'Prefrontal Cortex',
    shortLabel: 'Prefrontal',
    color: '#E85D64',
    hsl: [0.98, 0.85, 0.55],
    description: 'Controls focused attention and working memory. High activation signals strong creative engagement and message clarity.',
    px: 50, py: 9,
  },
  {
    key: 'Visual Cortex (V1-V4)',
    id: 'visual',
    label: 'Visual Cortex',
    shortLabel: 'Visual',
    color: '#3B82F6',
    hsl: [0.6, 0.9, 0.6],
    description: 'Processes visual stimuli. High activation indicates strong visual impact, contrast, and compositional clarity.',
    px: 50, py: 88,
  },
  {
    key: 'Auditory Cortex (Temporal)',
    id: 'temporal',
    label: 'Temporal Lobe',
    shortLabel: 'Temporal',
    color: '#F59E0B',
    hsl: [0.12, 0.9, 0.55],
    description: 'Handles audio and language comprehension. Activated by voiceover, music, and on-screen text.',
    px: 16, py: 50,
  },
  {
    key: 'Amygdala (Emotional)',
    id: 'emotional',
    label: 'Amygdala',
    shortLabel: 'Emotional',
    color: '#8B5CF6',
    hsl: [0.75, 0.8, 0.6],
    description: 'Drives emotional response and memory encoding. High activation means emotionally resonant, memorable content.',
    px: 84, py: 50,
  },
]

// Exported so page.tsx can use the same colors in charts
export { REGIONS }
export type { RegionMeta }

function getRegionIndexForPoint(nx: number, ny: number): number {
  // Zones match badge positions in the viewport:
  // Prefrontal badge: top center (py=9)   → top particles
  // Visual badge:     bottom center (py=88)→ bottom particles
  // Temporal badge:   left side (px=16)   → left hemisphere
  // Emotional badge:  right side (px=84)  → right hemisphere
  if (ny > 0.28)             return 0  // top cap    → Prefrontal
  if (ny < -0.28)            return 1  // bottom cap → Visual
  if (nx < 0)                return 2  // left half  → Temporal
  return 3                             // right half → Emotional
}

// Simplex-like noise using sin/cos harmonics
function brainNoise(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 3.1 + y * 1.7) * 0.4 +
    Math.sin(y * 4.3 + z * 2.1) * 0.3 +
    Math.sin(z * 2.7 + x * 3.9) * 0.3
  )
}

class BrainErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

function hasWebGLSupport() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
  } catch { return false }
}

function BrainFallback() {
  return (
    <div id="brain-canvas-container" className="overflow-hidden bg-[#050505]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(232,93,100,0.15),transparent_60%)]" />
      <div className="absolute left-1/2 top-1/2 h-[55vmin] w-[65vmin] -translate-x-1/2 -translate-y-1/2 rounded-[50%_45%_50%_45%] border border-seedtag-coral/20 bg-seedtag-coral/5" />
    </div>
  )
}

function BrainPointCloud({ activationLevel = 0.5, activeRegion = 'all', regionActivations, approved, highlightRegion, decorative = false }: BrainProps) {
  // Map highlight key to REGIONS index for fast lookup
  const highlightIdx = highlightRegion === 'frontal'   ? 0
                     : highlightRegion === 'visual'    ? 1
                     : highlightRegion === 'temporal'  ? 2
                     : highlightRegion === 'emotional' ? 3
                     : -1

  const pointsRef = useRef<THREE.Points>(null!)
  const count = 10000

  // ── STABLE geometry — only recomputed once ──────────────────────────
  // Stores positions + per-point region index + deterministic jitter
  const [positions, regionIdxBuf, jitterBuf, sxBuf, syBuf] = useMemo(() => {
    const pos  = new Float32Array(count * 3)
    const rIdx = new Uint8Array(count)
    const jit  = new Float32Array(count)   // deterministic hue jitter
    const sxB  = new Float32Array(count)   // original sphere x (for activeRegion filter)
    const syB  = new Float32Array(count)

    const W = 3.0, H = 2.2, D = 3.8

    for (let i = 0; i < count; i++) {
      const phi   = Math.acos(1 - (2 * (i + 0.5)) / count)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i

      const sx = Math.sin(phi) * Math.cos(theta)
      const sy = Math.sin(phi) * Math.sin(theta)
      const sz = Math.cos(phi)

      let x = W * sx, y = H * sy, z = D * sz

      // 1. Medial longitudinal fissure
      y -= Math.max(0, sy) * Math.exp(-sx * sx * 12) * 0.7
      // 2. Flatten base
      if (sy < -0.5) y += 0.3
      // 3. Gyri wrinkles
      const g = brainNoise(sx * 5.5, sy * 5.5, sz * 5.5) * 0.22
      x += g * sx; y += g * sy * 0.7; z += g * sz
      // 4. Frontal bulge
      if (sx > 0.2) { const b = (sx - 0.2) * 0.4; x += b * 0.5; y += b * 0.2 }
      // 5. Occipital bump
      if (sx < -0.3 && Math.abs(sy) < 0.5) x -= 0.25
      // 6. Temporal bulge
      if (Math.abs(sy) > 0.2 && Math.abs(sz) > 0.4 && sx < 0.1) {
        const tb = (Math.abs(sy) - 0.2) * 0.3
        y += sy > 0 ? -tb : tb; z += sz > 0 ? tb * 0.5 : -tb * 0.5
      }
      // Deterministic scatter (no Math.random — stable across re-renders)
      const seed  = Math.sin(i * 127.1 + 311.7) * 43758.5453
      const seed2 = Math.sin(i * 269.5 + 183.3) * 43758.5453
      const seed3 = Math.sin(i * 419.2 + 93.1)  * 43758.5453
      const sc = 0.10
      x += (seed  - Math.floor(seed)  - 0.5) * sc
      y += (seed2 - Math.floor(seed2) - 0.5) * sc * 0.7
      z += (seed3 - Math.floor(seed3) - 0.5) * sc

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
      rIdx[i] = getRegionIndexForPoint(sx, sy)
      jit[i]  = (seed - Math.floor(seed) - 0.5) * 0.06  // [-0.03, 0.03]
      sxB[i]  = sx
      syB[i]  = sy
    }
    return [pos, rIdx, jit, sxB, syB]
  }, [count])

  // ── REACTIVE colors — recompute on highlight/activation change ───────
  const colors = useMemo(() => {
    const cols = new Float32Array(count * 3)
    const color = new THREE.Color()


    for (let i = 0; i < count; i++) {
      const rIdx  = regionIdxBuf[i]
      const sx = sxBuf[i], sy = syBuf[i]

      if (regionActivations) {
        if (highlightIdx >= 0) {
          if (rIdx === highlightIdx) {
            // Highlighted zone: vivid region color — high saturation, mid lightness for additive blend
            const [h] = REGIONS[highlightIdx].hsl
            color.setHSL(h + jitterBuf[i] * 0.012, 1.0, 0.38 + jitterBuf[i] * 0.05)
          } else {
            // Non-highlighted: virtually invisible
            color.setHSL(0, 0, 0.015)
          }
        } else {
          // No hover: perfectly uniform dim white — no zone variation
          color.setHSL(0, 0, 0.28 + jitterBuf[i] * 0.03)
        }
      } else {
        let intensity = 0.08
        if (
          activeRegion === 'all' ||
          (activeRegion === 'frontal'   && sy > 0.28) ||
          (activeRegion === 'visual'    && sy < -0.28) ||
          (activeRegion === 'temporal'  && sx < 0 && Math.abs(sy) <= 0.28) ||
          (activeRegion === 'emotional' && sx >= 0 && Math.abs(sy) <= 0.28)
        ) {
          intensity = activationLevel * 0.7 + 0.15
        }
        if (decorative) {
          // Cool blue/indigo/teal palette — visually distinct from the coral main brain
          const hue = 0.60 + (jitterBuf[i] ?? 0) * 0.12  // blue → indigo range
          color.setHSL(hue, 0.45 + intensity * 0.3, 0.05 + intensity * 0.32)
        } else if (intensity > 0.5) {
          color.setHSL(0.98, 0.8, 0.35 + intensity * 0.3)
        } else {
          color.setHSL(0.62, 0.3, 0.08 + intensity * 0.25)
        }
      }

      cols[i * 3] = color.r; cols[i * 3 + 1] = color.g; cols[i * 3 + 2] = color.b
    }
    return cols
  }, [count, regionIdxBuf, jitterBuf, sxBuf, syBuf, activationLevel, activeRegion, regionActivations, highlightIdx, approved, decorative])

  useFrame((state) => {
    if (decorative) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.018
    }
  })

  return (
    <Points ref={pointsRef} positions={positions} colors={colors} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        vertexColors
        size={0.045}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.9}
      />
    </Points>
  )
}

function RegionBadge({ region, activation, onHover, detail }: { region: RegionMeta; activation: number; onHover?: (id: BrainRegionId | null) => void; detail?: RegionDetail }) {
  const [hovered, setHovered] = useState(false)
  const [open, setOpen] = useState(false)
  const pct = (activation * 100).toFixed(0)
  const tooltipAbove = region.py > 40

  return (
    <div
      style={{
        position: 'absolute',
        left: `${region.px}%`,
        top: `${region.py}%`,
        transform: `translate(-50%, -50%) scale(${hovered ? 1.1 : 1})`,
        zIndex: 20,
        transition: 'transform 0.2s ease',
      }}
      onMouseEnter={() => { setHovered(true); onHover?.(region.id) }}
      onMouseLeave={() => { setHovered(false); onHover?.(null) }}
    >
      {/* Glow halo on hover only */}
      {hovered && (
        <div style={{
          position: 'absolute',
          inset: -16,
          borderRadius: 20,
          background: `radial-gradient(circle, ${region.color}50 0%, transparent 70%)`,
          filter: 'blur(12px)',
          pointerEvents: 'none',
        }} />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(5,5,5,0.82)',
          backdropFilter: 'blur(14px)',
          border: `1.5px solid ${region.color}${hovered ? 'cc' : '55'}`,
          borderRadius: 11,
          padding: '8px 14px',
          cursor: 'default',
          boxShadow: hovered
            ? `0 0 24px ${region.color}60, 0 0 8px ${region.color}30`
            : `0 2px 8px rgba(0,0,0,0.5)`,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            width: 11, height: 11,
            borderRadius: '50%',
            background: region.color,
            opacity: 0.5 + activation * 0.5,
            boxShadow: `0 0 ${hovered ? 14 : 7}px ${region.color}`,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 18, fontWeight: 800, color: region.color, fontFamily: 'inherit', letterSpacing: '-0.01em' }}>
          {pct}%
        </span>
        <span style={{ fontSize: 15, color: hovered ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)', fontFamily: 'inherit', fontWeight: 500, transition: 'color 0.2s' }}>
          {region.shortLabel}
        </span>
        {detail && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
            style={{
              marginLeft: 2,
              width: 18, height: 18,
              borderRadius: '50%',
              border: `1px solid ${region.color}80`,
              background: open ? `${region.color}30` : 'rgba(255,255,255,0.06)',
              color: region.color,
              fontSize: 13,
              fontWeight: 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.15s',
              lineHeight: 1,
            }}
          >+</button>
        )}
      </div>

      {/* Hover tooltip — anatomy description */}
      {hovered && !open && (
        <div
          style={{
            position: 'absolute',
            [tooltipAbove ? 'bottom' : 'top']: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(5,5,5,0.94)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${region.color}35`,
            borderRadius: 12,
            padding: '12px 14px',
            width: 220,
            pointerEvents: 'none',
            boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${region.color}20`,
            zIndex: 40,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 700, color: region.color, marginBottom: 6, fontFamily: 'inherit' }}>
            {region.label}
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, fontFamily: 'inherit' }}>
            {region.description}
          </p>
          <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: region.color, width: `${activation * 100}%`, transition: 'width 0.4s' }} />
          </div>
          <p style={{ marginTop: 5, fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'inherit' }}>
            {activation >= 0.7 ? 'High activation' : activation >= 0.4 ? 'Moderate activation' : 'Low activation'}
          </p>
        </div>
      )}

      {/* Click popover — specific recommendation */}
      {open && detail && (
        <div
          style={{
            position: 'absolute',
            [tooltipAbove ? 'bottom' : 'top']: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(8,8,8,0.96)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${region.color}50`,
            borderRadius: 14,
            padding: '14px 16px',
            width: 260,
            zIndex: 40,
            boxShadow: `0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px ${region.color}25`,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: region.color, fontFamily: 'inherit' }}>{region.label}</p>
            <button onClick={() => setOpen(false)} style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontFamily: 'inherit' }}>Why</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, fontFamily: 'inherit' }}>{detail.why}</p>
          </div>
          {detail.timeRef && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontFamily: 'inherit' }}>Key moments</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, fontFamily: 'inherit' }}>{detail.timeRef}</p>
            </div>
          )}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: region.color, marginBottom: 4, fontFamily: 'inherit', opacity: 0.8 }}>What to fix</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, fontFamily: 'inherit' }}>{detail.fix}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BrainViewer({ activationLevel, activeRegion, regionActivations, approved, highlightRegion, decorative = false, onRegionHover, regionDetails }: BrainProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [webglAvailable, setWebglAvailable] = useState(false)

  useEffect(() => {
    setWebglAvailable(hasWebGLSupport())
    setIsMounted(true)
  }, [])

  if (!isMounted || !webglAvailable) return <BrainFallback />

  return (
    <BrainErrorBoundary fallback={<BrainFallback />}>
      <div id="brain-canvas-container" style={{ position: 'relative' }}>
        <Canvas
          camera={{ position: [0, 1.5, 9], fov: decorative ? 32 : 42 }}
          style={decorative ? { pointerEvents: 'none', touchAction: 'none' } : undefined}
          onCreated={decorative ? ({ gl }) => {
            gl.domElement.style.pointerEvents = 'none'
            gl.domElement.style.touchAction = 'none'
          } : undefined}
        >
          <color attach="background" args={['#050505']} />
          <ambientLight intensity={0.15} />
          <pointLight position={[8, 6, 8]} intensity={1.2} color="#E85D64" />
          <pointLight position={[-8, -4, -6]} intensity={0.4} color="#3B82F6" />

          <BrainPointCloud
            activationLevel={activationLevel}
            activeRegion={activeRegion}
            regionActivations={decorative ? undefined : regionActivations}
            approved={decorative ? null : approved}
            highlightRegion={decorative ? undefined : highlightRegion}
            decorative={decorative}
          />

          {!decorative && <Stars radius={120} depth={60} count={2000} factor={3} saturation={0} fade speed={0.3} />}
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={decorative ? 0.1 : 0.35} enableRotate={!decorative} />
        </Canvas>

        {!decorative && regionActivations && REGIONS.map((region) => (
          <RegionBadge
            key={region.key}
            region={region}
            activation={regionActivations[region.key] ?? 0}
            onHover={onRegionHover}
            detail={regionDetails?.[region.id]}
          />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }`}</style>
      </div>
    </BrainErrorBoundary>
  )
}
