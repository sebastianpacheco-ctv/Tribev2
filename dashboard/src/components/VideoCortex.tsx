'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, SkipForward, SkipBack, Maximize, Volume2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface VideoCortexProps {
  onTimeUpdate?: (progress: number) => void;
}

export default function VideoCortex({ onTimeUpdate }: VideoCortexProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setProgress(prev => {
          const next = prev + 0.5
          if (next >= 100) {
            setIsPlaying(false)
            return 100
          }
          if (onTimeUpdate) onTimeUpdate(next)
          return next
        })
      }, 100)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isPlaying, onTimeUpdate])

  const togglePlay = () => setIsPlaying(!isPlaying)

  return (
    <div className="glass-card overflow-hidden group relative aspect-video w-full max-w-2xl border-white/5 bg-black">
      {/* Mock Video Content */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black overflow-hidden">
         <motion.div 
           animate={{ 
             scale: isPlaying ? [1, 1.05, 1] : 1,
             opacity: isPlaying ? [0.3, 0.5, 0.3] : 0.2
           }}
           transition={{ duration: 2, repeat: Infinity }}
           className="w-full h-full bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center"
         />
         {!isPlaying && (
           <motion.button 
             whileHover={{ scale: 1.1 }}
             onClick={togglePlay}
             className="z-10 w-16 h-16 rounded-full bg-seedtag-coral flex items-center justify-center text-white shadow-2xl shadow-seedtag-coral/40"
           >
             <Play size={28} fill="currentColor" />
           </motion.button>
         )}
         
         <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-black/40 backdrop-blur-md rounded border border-white/10">
            <span className="text-[10px] font-bold text-white tracking-widest uppercase">Target Stimulus: Nissan_Qashqai_CTV.mp4</span>
         </div>
      </div>

      {/* Controls Overlay */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="h-1 w-full bg-white/20 rounded-full cursor-pointer relative">
            <div 
              className="absolute h-full bg-seedtag-coral rounded-full transition-all duration-100" 
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <button onClick={togglePlay} className="hover:text-seedtag-coral transition-colors">
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <SkipBack size={18} className="opacity-50" />
              <SkipForward size={18} className="opacity-50" />
              <span className="text-xs font-mono ml-2">
                00:{Math.floor(progress/10).toString().padStart(2, '0')} / 00:10
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <Volume2 size={18} />
              <Maximize size={18} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
