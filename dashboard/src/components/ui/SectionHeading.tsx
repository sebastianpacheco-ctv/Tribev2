'use client'

import { type ReactNode } from 'react'
import { InfoTip } from './InfoTip'

export function SectionHeading({
  title,
  info,
  badge,
}: {
  title: string
  info: string
  badge?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</h4>
        <InfoTip text={info} />
      </div>
      {badge}
    </div>
  )
}
