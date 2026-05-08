'use client'

import { type ReactNode, useState } from 'react'

export function FlipCard({
  front,
  back,
  className = '',
}: {
  front: ReactNode
  back: ReactNode
  className?: string
}) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className={className} style={{ perspective: '800px' }}>
      <div
        style={{
          display: 'grid',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.42s cubic-bezier(0.4,0,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front */}
        <div style={{ gridArea: '1/1', backfaceVisibility: 'hidden', position: 'relative' }}>
          {front}
          <button
            type="button"
            onClick={() => setFlipped(true)}
            title="What is this?"
            className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[11px] font-bold leading-none text-gray-400 transition-all hover:border-seedtag-coral/60 hover:text-seedtag-coral"
          >
            +
          </button>
        </div>
        {/* Back */}
        <div
          style={{
            gridArea: '1/1',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'relative',
          }}
        >
          {back}
          <button
            type="button"
            onClick={() => setFlipped(false)}
            title="Back"
            className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/40 text-[13px] leading-none text-gray-400 transition-all hover:text-white"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
