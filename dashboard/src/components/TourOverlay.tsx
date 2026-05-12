'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface TourStep {
  id: string
  target: string | null   // CSS selector for data-tour attribute, null = center welcome
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to NeuralSeed',
    description: 'A quick walkthrough of the key features. Use the arrows to navigate or press Skip to close.',
    position: 'center',
  },
  {
    id: 'upload',
    target: '[data-tour="upload-area"]',
    title: 'Upload Your Creative',
    description: 'Drop a video or image here to start an analysis. You can also switch to "Preview URL" and paste a link from preview.seedtag.com — the engine screenshots it automatically.',
    position: 'bottom',
  },
  {
    id: 'demo',
    target: '[data-tour="demo-btn"]',
    title: 'Load Demo Data',
    description: 'No creative ready? Load a sample diagnostic result to explore all panels — brain viewer, scorecard, executive summary — without uploading anything.',
    position: 'right',
  },
  {
    id: 'diagnostics-panel',
    target: '[data-tour="diagnostics-panel"]',
    title: 'Diagnostics Scorecard',
    description: 'After analysis the right panel populates with the full QA scorecard: AI automated checks, hybrid review items, neural region signals, and the final approval gate.',
    position: 'left',
  },
  {
    id: 'exec-sidebar',
    target: '[data-tour="exec-sidebar"]',
    title: 'Executive Summary',
    description: 'One-page summary designed for clients and stakeholders — decision badge, attention score, top recommendation, and a direct PDF export button.',
    position: 'right',
  },
  {
    id: 'history-sidebar',
    target: '[data-tour="history-sidebar"]',
    title: 'Diagnostic History',
    description: 'Every analysis is saved automatically. Search by filename, filter by Approved/Revision, reload any past run, or export a ZIP backup.',
    position: 'right',
  },
  {
    id: 'engine-status',
    target: '[data-tour="engine-status"]',
    title: 'Engine Status Card',
    description: 'Live snapshot of the current diagnostic: attention score with progress bar, model confidence, decision verdict, and the dominant brain region.',
    position: 'top',
  },
]

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 10

interface Props {
  onClose: () => void
}

export default function TourOverlay({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)

  const current = STEPS[step]

  const measureTarget = useCallback(() => {
    if (!current.target) { setRect(null); return }
    const el = document.querySelector(current.target)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [current.target])

  useEffect(() => {
    measureTarget()
    window.addEventListener('resize', measureTarget)
    return () => window.removeEventListener('resize', measureTarget)
  }, [measureTarget])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && step < STEPS.length - 1) setStep(s => s + 1)
      if (e.key === 'ArrowLeft' && step > 0) setStep(s => s - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, onClose])

  // Tooltip positioning
  const tooltipStyle = (): React.CSSProperties => {
    if (!rect || current.position === 'center') {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10001 }
    }
    const base: React.CSSProperties = { position: 'fixed', zIndex: 10001 }
    const centerY = rect.top + rect.height / 2
    const centerX = rect.left + rect.width / 2
    const cardW = 340
    const cardH = 180 // approximate

    if (current.position === 'right') {
      return { ...base, left: rect.left + rect.width + 16, top: Math.max(16, centerY - cardH / 2) }
    }
    if (current.position === 'left') {
      return { ...base, left: rect.left - cardW - 16, top: Math.max(16, centerY - cardH / 2) }
    }
    if (current.position === 'bottom') {
      return { ...base, top: rect.top + rect.height + 16, left: Math.max(16, centerX - cardW / 2) }
    }
    // top
    return { ...base, top: rect.top - cardH - 16, left: Math.max(16, centerX - cardW / 2) }
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <>
      {/* Dark overlay — uses box-shadow to create spotlight cutout */}
      {rect ? (
        <div
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.82)',
            zIndex: 10000,
            pointerEvents: 'none',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
            border: '1.5px solid rgba(232,93,100,0.5)',
          }}
        />
      ) : (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, pointerEvents: 'none',
          }}
        />
      )}

      {/* Click-to-close backdrop (only outside the spotlight) */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 10000 }}
        onClick={onClose}
      />

      {/* Tooltip card */}
      <div
        style={{ ...tooltipStyle(), width: 340 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(16px)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#E85D64', marginBottom: 4 }}>
                Step {step + 1} of {STEPS.length}
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{current.title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Description */}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 16 }}>
            {current.description}
          </p>

          {/* Progress bar */}
          <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 14 }}>
            <div style={{ height: 2, background: '#E85D64', borderRadius: 2, width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Skip tour
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                disabled={step === 0}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: step === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                  color: step === 0 ? 'rgba(255,255,255,0.2)' : '#fff',
                  cursor: step === 0 ? 'default' : 'pointer',
                }}
              >
                <ChevronLeft size={16} />
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(s => s + 1)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 14px', height: 32, borderRadius: 8,
                    border: 'none', background: '#E85D64',
                    color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 14px', height: 32, borderRadius: 8,
                    border: 'none', background: '#E85D64',
                    color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
