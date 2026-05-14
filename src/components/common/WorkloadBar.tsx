interface Props {
  pct: number
  showLabel?: boolean
}

function getBarColor(pct: number) {
  if (pct > 100) return 'bg-red-500'
  if (pct >= 85) return 'bg-orange-400'
  if (pct >= 50) return 'bg-green-500'
  if (pct > 0) return 'bg-blue-400'
  return 'bg-gray-300'
}

export default function WorkloadBar({ pct, showLabel = false }: Props) {
  const displayPct = Math.min(pct, 120)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${getBarColor(pct)}`}
          style={{ width: `${Math.min(displayPct, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-semibold text-gray-700 w-14 text-right">{pct}%</span>
      )}
    </div>
  )
}
