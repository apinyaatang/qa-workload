import type { AdhocRisk } from '../../types'

const config: Record<AdhocRisk, { bg: string; text: string; dot: string }> = {
  'High Adhoc':   { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  'Medium Adhoc': { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  'Low Adhoc':    { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
}

export default function AdhocRiskBadge({ risk }: { risk: AdhocRisk }) {
  const c = config[risk]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${c.bg} ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {risk}
    </span>
  )
}
