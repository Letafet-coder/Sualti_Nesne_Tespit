'use client'

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

import { CLASSES, getClassMeta } from '@/lib/classes'
import { useStats } from '@/hooks/use-analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ClassDistribution() {
  const { data } = useStats()

  const chartData = CLASSES.map((c) => ({
    name: c.name,
    label: c.label,
    value: data?.per_class[c.name] ?? 0,
    color: c.color,
  })).sort((a, b) => b.value - a.value)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Sınıf Dağılımı (Toplam)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 10, right: 30, top: 4, bottom: 4 }}
            >
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={90}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                stroke="var(--border)"
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {chartData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  style={{ fill: 'var(--foreground)', fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
