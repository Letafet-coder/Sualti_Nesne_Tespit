'use client'

import { Activity, Fish, Clock, Layers } from 'lucide-react'

import { CLASSES } from '@/lib/classes'
import { useStats } from '@/hooks/use-analytics'
import { Card, CardContent } from '@/components/ui/card'

export function StatsCards() {
  const { data } = useStats()

  const total = data?.total_detections ?? 0
  const perClass = data?.per_class ?? {}
  const distinctClasses = Object.keys(perClass).filter((k) => perClass[k] > 0).length
  const topClass =
    Object.entries(perClass).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'
  const topLabel = CLASSES.find((c) => c.name === topClass)?.label ?? '-'
  const lastSeen = data?.last_seen
    ? new Date(data.last_seen).toLocaleTimeString('tr-TR')
    : '-'

  const items = [
    {
      icon: Activity,
      label: 'Toplam Tespit',
      value: total.toLocaleString('tr-TR'),
    },
    { icon: Layers, label: 'Aktif Sınıf', value: `${distinctClasses} / 7` },
    { icon: Fish, label: 'En Sık Sınıf', value: topLabel },
    { icon: Clock, label: 'Son Tespit', value: lastSeen },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <it.icon className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{it.label}</p>
              <p className="truncate text-lg font-semibold">{it.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
