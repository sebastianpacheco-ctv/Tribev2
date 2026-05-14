'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, Upload, Loader2, Maximize, Volume2, VolumeX } from 'lucide-react'
import { motion } from 'framer-motion'

export interface TimelineMarker {
  frameIndex: number
  timestampSeconds: number
  type: 'low-attention' | 'high-load'
}

interface VideoCortexProps {
  onTimeUpdate?: (progress: number) => void;
  videoUrl?: string | null;
  selectedFileName?: string | null;
  requestId?: string | null;
  isUploading?: boolean;
  isAnalyzing?: boolean;
  uploadProgress?: number;
  analysisProgress?: number;
  onSelectFile: (file: File) => void;
  onUpload: () => void;
  onAnalyze: () => void;
  canAnalyze: boolean;
  hideControls?: boolean;
  isDone?: boolean;
  onReset?: () => void;
  analysisDepth?: 'quick' | 'standard' | 'deep' | 'ultra';
  onDepthChange?: (depth: 'quick' | 'standard' | 'deep' | 'ultra') => void;
  formatType?: 'bespoke' | 'frame' | 'standard_video';
  onFormatChange?: (format: 'bespoke' | 'frame' | 'standard_video') => void;
  markers?: TimelineMarker[];
  activeMarkerIndex?: number | null;
  onMarkerClick?: (frameIndex: number, timestampSeconds: number) => void;
  seekTarget?: number | null;
  heatmap?: number[][] | null;
  heatmapType?: 'low-attention' | 'high-load' | null;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00'
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

function ProgressMeter({
  label,
  value,
  active,
}: {
  label: string
  value: number
  active: boolean
}) {
  const boundedValue = Math.max(0, Math.min(100, Math.round(value)))
  const isComplete = boundedValue >= 100

  return (
    <div className="rounded-lg border border-white/10 bg-black/35 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="truncate text-[10px] font-bold uppercase tracking-widest text-gray-300">
          {label}
        </span>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest ${
          active ? 'text-seedtag-coral' : isComplete ? 'text-emerald-300' : 'text-gray-400'
        }`}>
          {isComplete ? 'Done' : `${boundedValue}%`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete ? 'bg-emerald-400' : 'bg-seedtag-coral'
          }`}
          style={{ width: `${boundedValue}%` }}
        />
      </div>
    </div>
  )
}

export default function VideoCortex({
  onTimeUpdate,
  videoUrl,
  selectedFileName,
  requestId,
  isUploading = false,
  isAnalyzing = false,
  uploadProgress = 0,
  analysisProgress = 0,
  onSelectFile,
  onUpload,
  onAnalyze,
  canAnalyze,
  hideControls = false,
  isDone = false,
  onReset,
  analysisDepth = 'standard',
  onDepthChange,
  formatType = 'bespoke',
  onFormatChange,
  markers = [],
  activeMarkerIndex = null,
  onMarkerClick,
  seekTarget = null,
  heatmap = null,
  heatmapType = null,
}: VideoCortexProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.72)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!heatmap || heatmap.length === 0) return

    const rows = heatmap.length
    const cols = heatmap[0]?.length ?? 0
    if (!rows || !cols) return

    const cellW = canvas.width / cols
    const cellH = canvas.height / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = heatmap[r][c]
        if (v < 0.1) continue
        const alpha = Math.min(heatmapOpacity, v * heatmapOpacity)
        let color: string
        if (v < 0.4)       color = `rgba(34, 197, 94, ${alpha})`   // green  — safe zone
        else if (v < 0.7)  color = `rgba(251, 191, 36, ${alpha})`  // amber  — caution
        else               color = `rgba(239, 68, 68, ${alpha})`   // red    — problem zone
        ctx.fillStyle = color
        ctx.fillRect(Math.round(c * cellW), Math.round(r * cellH), Math.ceil(cellW), Math.ceil(cellH))
      }
    }
  }, [heatmap, heatmapType, heatmapOpacity])

  useEffect(() => {
    drawHeatmap()
  }, [drawHeatmap])
  const showUploadProgress = Boolean(selectedFileName && (isUploading || uploadProgress > 0))
  const showAnalysisProgress = Boolean(isAnalyzing || analysisProgress > 0)

  useEffect(() => {
    setIsPlaying(false)
    setProgress(0)
    setDuration(0)

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [videoUrl])

  // Seek video when a marker is activated externally — preserve play state
  useEffect(() => {
    if (seekTarget === null || seekTarget === undefined || !videoRef.current || !duration) return
    const wasPlaying = !videoRef.current.paused
    videoRef.current.currentTime = Math.max(0, Math.min(seekTarget, duration))
    const nextProgress = duration > 0 ? (videoRef.current.currentTime / duration) * 100 : 0
    setProgress(nextProgress)
    onTimeUpdate?.(nextProgress)
    // Resume if it was already playing
    if (wasPlaying) videoRef.current.play().catch(() => {})
  }, [seekTarget, duration, onTimeUpdate])

  const togglePlay = async () => {
    if (!videoRef.current || !videoUrl) {
      return
    }

    if (videoRef.current.paused) {
      await videoRef.current.play()
      setIsPlaying(true)
      return
    }

    videoRef.current.pause()
    setIsPlaying(false)
  }

  const handleLoadedMetadata = () => {
    const nextDuration = videoRef.current?.duration ?? 0
    setDuration(nextDuration)
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) {
      return
    }

    const nextDuration = videoRef.current.duration || 0
    const nextProgress = nextDuration > 0
      ? (videoRef.current.currentTime / nextDuration) * 100
      : 0

    setProgress(nextProgress)
    onTimeUpdate?.(nextProgress)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    onSelectFile(file)
  }

  const toggleMute = () => {
    if (!videoRef.current) {
      setIsMuted((current) => !current)
      return
    }

    const nextMuted = !videoRef.current.muted
    videoRef.current.muted = nextMuted
    setIsMuted(nextMuted)
  }

  const enterFullscreen = async () => {
    await containerRef.current?.requestFullscreen?.()
  }

  const seekVideo = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const nextProgress = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    videoRef.current.currentTime = nextProgress * duration
    setProgress(nextProgress * 100)
    onTimeUpdate?.(nextProgress * 100)
  }

  return (
    <div ref={containerRef} className="glass-card overflow-hidden group relative aspect-video w-full border-white/5 bg-black">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black overflow-hidden">
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              muted={isMuted}
              autoPlay={false}
              className="h-full w-full object-cover"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              preload="metadata"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full pointer-events-none"
              style={{
                mixBlendMode: 'screen',
                opacity: heatmap ? 1 : 0,
                transition: 'opacity 0.4s',
                filter: 'blur(22px) saturate(1.4)',
              }}
            />
          </>
        ) : (
          <motion.div
            className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
          >
            <motion.div
              aria-hidden="true"
              animate={{
                scale: [1, 1.04, 1],
                opacity: [0.32, 0.55, 0.32],
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(232,93,100,0.45),_transparent_45%),linear-gradient(135deg,_#111_0%,_#050505_100%)]"
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="z-10 flex items-center gap-3 rounded-full bg-seedtag-coral px-6 py-3 text-sm font-bold text-white shadow-2xl shadow-seedtag-coral/40"
            >
              <Upload size={18} />
              Select Creative
            </button>
          </motion.div>
        )}

        {/* Click overlay — play when paused, pause when playing */}
        {videoUrl && (
          <div
            className="absolute inset-0 z-[5] cursor-pointer"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          />
        )}

        {!isPlaying && videoUrl && (
          <motion.button
            whileHover={{ scale: 1.08 }}
            onClick={togglePlay}
            className="absolute z-10 flex h-16 w-16 items-center justify-center rounded-full bg-seedtag-coral text-white shadow-2xl shadow-seedtag-coral/40"
            style={{ pointerEvents: 'none' }}
          >
            <Play size={28} fill="currentColor" />
          </motion.button>
        )}

        <div className="absolute left-4 top-4 z-10 rounded border border-white/10 bg-black/40 px-3 py-1 backdrop-blur-md">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white">
            Target Stimulus: {selectedFileName ?? 'Awaiting Upload'}
          </span>
        </div>

        {/* Active marker badge */}
        {activeMarkerIndex !== null && (() => {
          const m = markers.find((mk) => mk.frameIndex === activeMarkerIndex)
          if (!m) return null
          return (
            <div className={`absolute left-4 top-12 z-10 flex items-center gap-2 rounded border px-3 py-1 backdrop-blur-md ${
              m.type === 'low-attention'
                ? 'border-red-400/30 bg-red-500/20'
                : 'border-amber-400/30 bg-amber-500/20'
            }`}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                m.type === 'low-attention' ? 'bg-red-400' : 'bg-amber-400'
              }`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                m.type === 'low-attention' ? 'text-red-200' : 'text-amber-200'
              }`}>
                {m.type === 'low-attention' ? 'Low Attention' : 'High Load'}
              </span>
              <span className="text-[10px] text-white/50">@ {m.timestampSeconds}s</span>
            </div>
          )
        })()}

        {requestId && (
          <div className="absolute right-4 top-4 z-10 rounded border border-white/10 bg-black/40 px-3 py-1 backdrop-blur-md">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">
              Request ID: {requestId.slice(0, 8)}
            </span>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 translate-y-2 bg-gradient-to-t from-black/85 to-transparent p-4 opacity-100 transition-all duration-300 group-hover:translate-y-0">
          <div className="space-y-3">

          {/* Timeline bar with markers */}
          <div className="relative">
            <div
              className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/20"
              onClick={seekVideo}
              role="slider"
              aria-label="Video progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div
                className="absolute h-full bg-seedtag-coral rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />

              {/* Marker dots */}
              {duration > 0 && markers.map((marker) => {
                const positionPct = Math.max(0, Math.min(100, (marker.timestampSeconds / duration) * 100))
                const isActive = marker.frameIndex === activeMarkerIndex
                return (
                  <button
                    key={marker.frameIndex}
                    type="button"
                    aria-label={`Review marker at ${marker.timestampSeconds}s`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (videoRef.current) {
                        videoRef.current.pause()
                        setIsPlaying(false)
                      }
                      onMarkerClick?.(marker.frameIndex, marker.timestampSeconds)
                    }}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 transition-transform hover:scale-150"
                    style={{ left: `${positionPct}%` }}
                  >
                    <span
                      className={`block rounded-full border-2 transition-all ${
                        isActive
                          ? 'h-4 w-4 shadow-lg'
                          : 'h-2.5 w-2.5'
                      } ${
                        marker.type === 'low-attention'
                          ? isActive
                            ? 'border-red-300 bg-red-500 shadow-red-500/60'
                            : 'border-red-400/60 bg-red-500/80'
                          : isActive
                            ? 'border-amber-300 bg-amber-500 shadow-amber-500/60'
                            : 'border-amber-400/60 bg-amber-500/80'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="hover:text-seedtag-coral transition-colors disabled:opacity-40"
                disabled={!videoUrl}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <span className="text-xs font-mono ml-2">
                {formatTime(((progress / 100) * duration) || 0)} / {formatTime(duration)}
              </span>
              {markers.length > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
                  {markers.length} marker{markers.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {heatmap && (
                <div className="flex items-center gap-2" title="Heatmap intensity">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">HM</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={heatmapOpacity}
                    onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                    className="w-16 h-1 accent-seedtag-coral cursor-pointer"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={toggleMute}
                className="transition-colors hover:text-seedtag-coral"
                aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                title={isMuted ? 'Unmute video' : 'Mute video'}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button
                type="button"
                onClick={enterFullscreen}
                className="transition-colors hover:text-seedtag-coral"
                aria-label="Enter fullscreen"
                title="Enter fullscreen"
              >
                <Maximize size={18} />
              </button>
            </div>
          </div>

          {(showUploadProgress || showAnalysisProgress) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {showUploadProgress && (
                <ProgressMeter
                  label="Video upload"
                  value={uploadProgress}
                  active={isUploading}
                />
              )}
              {showAnalysisProgress && (
                <ProgressMeter
                  label="Creative analysis"
                  value={analysisProgress}
                  active={isAnalyzing}
                />
              )}
            </div>
          )}

          {!hideControls && selectedFileName && (
            <div className="flex items-center gap-3 flex-wrap">
              {!isUploading && !isAnalyzing && !isDone && onFormatChange && (
                <div className="flex rounded-lg border border-white/10 overflow-hidden">
                  {([
                    { key: 'bespoke', label: 'Bespoke' },
                    { key: 'frame', label: 'Frame' },
                    { key: 'standard_video', label: 'Standard' },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onFormatChange(key)}
                      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                        formatType === key
                          ? 'bg-white/20 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {!isUploading && !isAnalyzing && !isDone && onDepthChange && (
                <div className="flex rounded-lg border border-white/10 overflow-hidden">
                  {(['quick', 'standard', 'deep', 'ultra'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onDepthChange(d)}
                      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                        analysisDepth === d
                          ? 'bg-seedtag-coral text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {(isUploading || isAnalyzing) ? (
                <button
                  disabled
                  className="flex items-center gap-2 rounded-lg bg-seedtag-coral/60 px-5 py-2 text-xs font-bold text-white cursor-not-allowed"
                >
                  <Loader2 size={14} className="animate-spin" />
                  {isUploading ? 'Uploading...' : 'Analyzing...'}
                </button>
              ) : isDone ? (
                <button
                  onClick={onReset}
                  className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-2 text-xs font-bold text-white transition-all hover:bg-white/15"
                >
                  New Creative
                </button>
              ) : (
                <button
                  onClick={onAnalyze}
                  disabled={!canAnalyze}
                  className="flex items-center gap-2 rounded-lg bg-seedtag-coral px-5 py-2 text-xs font-bold text-white shadow-lg shadow-seedtag-coral/20 transition-all hover:bg-seedtag-coral/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play size={14} fill="currentColor" />
                  Run Diagnostic
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
