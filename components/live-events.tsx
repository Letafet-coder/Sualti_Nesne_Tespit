'use client'

import { getClassMeta } from '@/lib/classes'
import type { LiveEvent } from '@/hooks/use-live-detections'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  events: LiveEvent[]
}

export function LiveEvents({ events }: Props) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-sm">Canlı Tespit Akışı</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[280px] px-4">
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Henüz tespit yok
            </p>
          ) : (
            <ul className="space-y-2 pb-4">
              {/* Düzenleme: map fonksiyonuna index parametresi eklendi */}
              {events.map((e, index) => {
                const meta = getClassMeta(e.class_name)
                const IconComponent = meta.icon 
                return (
                  <li
                    
                    key={`${e.id}-${index}`}
                    className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-2"
                  >
                    {/* Gri opak mini yuvarlak ikon alanı */}
                    <div className="flex items-center justify-center size-9 shrink-0 rounded bg-slate-800/50">
                      {/* Resim yerine canlanan SVG ikon basılıyor */}
                      <IconComponent className="size-5" style={{ color: meta.color }} />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.timestamp).toLocaleTimeString('tr-TR')}
                      </p>
                    </div>
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: meta.color, color: '#04121d' }}
                    >
                      {(e.confidence * 100).toFixed(0)}%
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}