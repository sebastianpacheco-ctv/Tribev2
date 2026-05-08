'use client'

export function DeltaBadge({
  current,
  avg,
  higherIsBetter = true,
}: {
  current: number
  avg: number
  higherIsBetter?: boolean
}) {
  const delta = current - avg
  const good = higherIsBetter ? delta >= 0 : delta <= 0
  if (Math.abs(delta) < 0.5) return <span className="text-[10px] text-gray-500">≈ avg</span>
  return (
    <span className={`text-[10px] font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)} {good ? '↑' : '↓'}
    </span>
  )
}
