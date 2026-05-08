'use client'

import { Activity } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FlipCard } from './FlipCard'

const badgeStyles: Record<string, string> = {
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  red: 'border-red-400/30 bg-red-400/10 text-red-300',
  blue: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  gray: 'border-white/10 bg-white/5 text-gray-400',
}

export function StatCard({
  title,
  value,
  unit,
  trend,
  icon: Icon,
  info,
  badge,
}: {
  title: string
  value: string
  unit: string
  trend?: string
  icon?: LucideIcon
  info: string
  badge?: { text: string; variant: 'green' | 'amber' | 'red' | 'blue' | 'gray' }
}) {
  return (
    <FlipCard
      front={
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            {Icon && <Icon size={40} className="text-seedtag-coral" />}
          </div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm text-gray-400">{title}</p>
            {badge && (
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeStyles[badge.variant]}`}>
                {badge.text}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold">{value}</h3>
            <span className="text-gray-500 text-sm font-medium">{unit}</span>
          </div>
          {trend && (
            <p className="text-xs mt-2 text-seedtag-coral font-medium flex items-center gap-1">
              <Activity size={12} /> {trend}
            </p>
          )}
        </div>
      }
      back={
        <div className="glass-card p-5 flex flex-col justify-center min-h-full">
          <p className="mb-2 pr-6 text-[10px] font-bold uppercase tracking-widest text-gray-500">{title}</p>
          <p className="text-xs leading-relaxed text-gray-200">{info}</p>
        </div>
      }
    />
  )
}
