'use client'

import { Info } from 'lucide-react'

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex" title={text}>
      <Info size={13} className="cursor-help text-gray-500 transition-colors group-hover/tip:text-seedtag-coral" />
      <span className="pointer-events-none absolute right-0 top-5 z-50 w-64 rounded-lg border border-white/10 bg-[#111] p-3 text-[11px] font-medium leading-relaxed text-gray-200 opacity-0 shadow-2xl shadow-black/40 transition-opacity group-hover/tip:opacity-100">
        {text}
      </span>
    </span>
  )
}
