'use client'

import { CLASSES } from '@/lib/classes'
import type { FrameResult } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  frame: FrameResult | null
}

/**
 * 7 sınıfın görsel kartları. Bir sınıf o an tespit edildiğinde
 * kartı vurgulanır ve en yüksek güven skoru gösterilir.
 */
export function DetectedClasses({ frame }: Props) {
  const active = new Map<string, number>()
  if (frame) {
    for (const d of frame.detections) {
      active.set(d.class_name, Math.max(active.get(d.class_name) ?? 0, d.confidence))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tespit Edilen Sınıflar</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CLASSES.map((c) => {
          const isActive = active.has(c.name)
          const conf = active.get(c.name)
          
          // Lucide İkon Bileşenini JSX içinde kullanmak için baş harfini büyük yapıyoruz
          const IconComponent = c.icon

          return (
            <div
              key={c.name}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-all',
                isActive
                  ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)]'
                  : 'border-border bg-muted/30 opacity-60',
              )}
            >
              {/* İkonun İçinde Durduğu Kutu */}
              <div
                className="relative flex items-center justify-center size-16 rounded-md bg-slate-800/40"
                style={{ outline: isActive ? `2px solid ${c.color}` : 'none' }}
              >
                {/* ARTIK NEXTJS IMAGE YOK! Doğrudan SVG İkon basıyoruz */}
                {/* SVG tabanlı olduğu için hem LCP hatası vermez hem de anında yüklenir */}
                <IconComponent 
                  className="w-8 h-8 transition-transform duration-300" 
                  style={{ color: c.color }} 
                />
              </div>

              <span className="text-center text-xs font-medium">{c.label}</span>
              
              {isActive && conf != null && (
                <Badge
                  className="absolute -right-1 -top-1 text-[10px]"
                  style={{ backgroundColor: c.color, color: '#04121d' }}
                >
                  {(conf * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}