'use client'

export function AbMetricRow({
  label,
  valA,
  valB,
  higherIsBetter = true,
}: {
  label: string
  valA: number | null
  valB: number | null
  higherIsBetter?: boolean
}) {
  const winner =
    valA !== null && valB !== null
      ? higherIsBetter
        ? valA >= valB ? 'a' : 'b'
        : valA <= valB ? 'a' : 'b'
      : null
  return (
    <div className="grid grid-cols-3 gap-2 items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{label}</span>
      <div className={`text-center rounded-lg py-1 text-xs font-bold ${winner === 'a' ? 'bg-seedtag-coral/20 text-seedtag-coral' : 'text-gray-300'}`}>
        {valA !== null ? valA.toFixed(1) : '—'}
        {winner === 'a' && <span className="ml-1 text-[9px]">✓</span>}
      </div>
      <div className={`text-center rounded-lg py-1 text-xs font-bold ${winner === 'b' ? 'bg-seedtag-coral/20 text-seedtag-coral' : 'text-gray-300'}`}>
        {valB !== null ? valB.toFixed(1) : '—'}
        {winner === 'b' && <span className="ml-1 text-[9px]">✓</span>}
      </div>
    </div>
  )
}
