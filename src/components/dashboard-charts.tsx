'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

type UserAnalytics = {
  id: string
  name: string
  total: number
  pending: number
  overdue: number
  done: number
}

type StatusAnalytics = {
  name: string
  value: number
}

type Props = {
  userAnalytics: UserAnalytics[]
  statusAnalytics: StatusAnalytics[]
}

export default function DashboardCharts({
  userAnalytics,
  statusAnalytics,
}: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-semibold mb-4">Tarefas por usuário</h2>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={userAnalytics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-semibold mb-4">Distribuição por status</h2>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusAnalytics}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                label
              >
                {statusAnalytics.map((entry, index) => (
                  <Cell key={`cell-${index}`} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}