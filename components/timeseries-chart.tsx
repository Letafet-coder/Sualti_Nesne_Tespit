'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CLASSES, getClassMeta } from '@/lib/classes'
import { useTimeseries } from '@/hooks/use-analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const INTERVALS = [
  { value: '30', label: '30 sn' },
  { value: '60', label: '1 dk' },
  { value: '300', label: '5 dk' },
]

export function TimeseriesChart() {
  const [interval, setInterval] = useState('60')
  const { data } = useTimeseries(Number(interval))

  const chartData = useMemo(() => {
    if (!data) return []
    return data.points.map((p) => {
      const row: Record<string, number | string> = {
        time: new Date(p.bucket).toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
      for (const c of CLASSES) row[c.name] = p.counts[c.name] ?? 0
      return row
    })
  }, [data])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">
          Zaman Serisi — Sınıf Bazlı Tespit Sayısı
        </CardTitle>
        <Select value={interval} onValueChange={(v) => v && setInterval(v)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVALS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                {CLASSES.map((c, idx) => (
                  <linearGradient
                    key={c.name}
                    id={`grad-${idx}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={c.color} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={c.color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                stroke="var(--border)"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                stroke="var(--border)"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--popover-foreground)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--foreground)' }}
                formatter={(value, name) => [
                  value,
                  getClassMeta(String(name)).label,
                ]}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
                    {getClassMeta(String(value)).label}
                  </span>
                )}
              />
              {CLASSES.map((c, idx) => (
                <Area
                  key={c.name}
                  type="monotone"
                  dataKey={c.name}
                  stackId="1"
                  stroke={c.color}
                  fill={`url(#grad-${idx})`}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}