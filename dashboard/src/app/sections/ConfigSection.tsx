'use client'

import { Server } from 'lucide-react'
import { DIAGNOSTICS_API_BASE } from '@/lib/api'
import { getFrameBudgetLabel } from '@/lib/diagnostics'
import { SectionHeading } from '@/components/ui'
import type { AnalysisDepth } from '@/lib/types'

interface Props {
  analysisDepth: AnalysisDepth
  frameRate: number
  isUploading: boolean
  isAnalyzing: boolean
  setAnalysisProfile: (depth: AnalysisDepth, fps: number) => void
  resetSession: () => void
  engineType: 'clip' | 'tribe'
  setEngineType: (e: 'clip' | 'tribe') => void
}

export function ConfigSection({
  analysisDepth,
  frameRate,
  isUploading,
  isAnalyzing,
  setAnalysisProfile,
  resetSession,
  engineType,
  setEngineType,
}: Props) {
  return (
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

      {/* Inference Engine */}
      <section>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Inference Engine</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              id: 'clip' as const,
              label: 'CLIP Heuristic',
              badge: 'Default',
              detail: 'OpenCLIP zero-shot scoring. Fast, no GPU required.',
            },
            {
              id: 'tribe' as const,
              label: 'TRIBE v2',
              badge: 'Meta AI',
              detail: 'Real fMRI brain predictions via cortical vertex model. Video only.',
            },
          ].map((eng) => {
            const selected = engineType === eng.id
            return (
              <button
                key={eng.id}
                type="button"
                onClick={() => setEngineType(eng.id)}
                disabled={isUploading || isAnalyzing}
                className={`rounded-xl border p-4 text-left transition-all disabled:opacity-50 ${
                  selected
                    ? 'border-seedtag-coral/40 bg-seedtag-coral/15'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white">{eng.label}</span>
                  <span className={`text-[10px] font-bold ${selected ? 'text-seedtag-coral' : 'text-gray-500'}`}>{eng.badge}</span>
                </div>
                <p className="text-[10px] leading-relaxed text-gray-400">{eng.detail}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* Controls */}
      <section>
        <SectionHeading title="Controls" info="Open local API docs or clear the current upload and analysis state." />
        <div className="flex gap-3 mt-3">
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
  )
}
