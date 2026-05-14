import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  Cell,
} from 'recharts'
import type { EmployeeWorkload } from '../../types'

interface Props {
  data: EmployeeWorkload[]
}

function getBarColor(pct: number) {
  if (pct > 100) return '#ef4444'
  if (pct >= 85) return '#f97316'
  if (pct >= 50) return '#22c55e'
  if (pct > 0) return '#3b82f6'
  return '#9ca3af'
}

export default function WorkloadChart({ data }: Props) {
  const chartData = data.map(w => ({
    name: w.employee.firstName,
    fullName: `${w.employee.firstName} ${w.employee.lastName}`,
    planned: w.plannedHours,
    adhoc: w.adhocHours,
    workloadPct: w.workloadPct,
    capacity: w.capacityHours,
  }))

  return (
    <div className="space-y-6">
      {/* Workload % Bar */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-3">Workload % ต่อคน</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={[0, 130]} unit="%" />
            <Tooltip
              formatter={(v) => [`${v}%`, 'Workload']}
              labelFormatter={(l) => {
                const d = chartData.find(c => c.name === l)
                return d?.fullName ?? l
              }}
            />
            <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '100%', fill: '#ef4444', fontSize: 11 }} />
            <ReferenceLine y={85} stroke="#f97316" strokeDasharray="4 4" label={{ value: '85%', fill: '#f97316', fontSize: 11 }} />
            <Bar dataKey="workloadPct" name="Workload %" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={getBarColor(entry.workloadPct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Planned vs Adhoc Hours */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-3">Planned vs Adhoc Hours</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="h" />
            <Tooltip formatter={(v, n) => [`${v}h`, n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="planned" name="Planned" fill="#6366f1" radius={[2, 2, 0, 0]} stackId="a" />
            <Bar dataKey="adhoc" name="Adhoc" fill="#f97316" radius={[2, 2, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
