'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Radio, Pause, Play, Download } from 'lucide-react'

import { IS_DEMO, videoStreamUrl } from '@/lib/api'
import { getClassMeta } from '@/lib/classes'
import type { FrameResult } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Props {
  frame: FrameResult | null
  connected: boolean
  alarmActive: boolean
  paused: boolean
  onTogglePause: () => void
}


function DemoCanvas({ frame }: { frame: FrameResult | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = (canvas.width = 960)
    const H = (canvas.height = 540)

    // Derin deniz gradyanı
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#12354d')
    grad.addColorStop(1, '#071522')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Hafif ışık huzmeleri
    ctx.globalAlpha = 0.06
    ctx.fillStyle = '#7fdfff'
    for (let i = 0; i < 5; i++) {
      const x = (i / 5) * W + 40
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + 120, 0)
      ctx.lineTo(x + 40, H)
      ctx.lineTo(x - 20, H)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Tespit kutuları
    if (frame) {
      for (const d of frame.detections) {
        const meta = getClassMeta(d.class_name)
        ctx.strokeStyle = getComputedColor(meta.color)
        ctx.lineWidth = 2
        const w = d.bbox.x2 - d.bbox.x1
        const h = d.bbox.y2 - d.bbox.y1
        ctx.strokeRect(d.bbox.x1, d.bbox.y1, w, h)
        const label = `${meta.label} ${(d.confidence * 100).toFixed(0)}%`
        ctx.font = '14px sans-serif'
        const tw = ctx.measureText(label).width
        ctx.fillStyle = getComputedColor(meta.color)
        ctx.fillRect(d.bbox.x1, d.bbox.y1 - 20, tw + 10, 20)
        ctx.fillStyle = '#04121d'
        ctx.fillText(label, d.bbox.x1 + 5, d.bbox.y1 - 6)
      }
    }
  }, [frame])

  return <canvas ref={canvasRef} className="h-full w-full object-cover" />
}

// CSS değişkenini gerçek renge çevir
function getComputedColor(cssVar: string): string {
  if (typeof window === 'undefined') return '#3fd0ff'
  const name = cssVar.replace('var(', '').replace(')', '').trim()
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return val || '#3fd0ff'
}

// Gerçek modda MJPEG akışının üzerine kutu çizen katman
function BoxOverlay({ frame }: { frame: FrameResult | null }) {
  if (!frame) return null
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      preserveAspectRatio="none"
    >
      {frame.detections.map((d, i) => {
        const meta = getClassMeta(d.class_name)
        return (
          <g key={i}>
            <rect
              x={d.bbox.x1}
              y={d.bbox.y1}
              width={d.bbox.x2 - d.bbox.x1}
              height={d.bbox.y2 - d.bbox.y1}
              fill="none"
              stroke={meta.color}
              strokeWidth={2}
            />
          </g>
        )
      })}
    </svg>
  )
}

export function LiveView({
  frame,
  connected,
  alarmActive,
  paused,
  onTogglePause,
}: Props) {
  const handleDownloadVideo = async () => {
    try {
      const response = await fetch('http://localhost:8000/download-video')
      if (!response.ok) throw new Error('Video indirilemedi')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `underwater-detection-${new Date().getTime()}.avi`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('İndir hatası:', error)
      alert('Video indirme başarısız oldu')
    }
  }

  const handlePauseToggle = async () => {
    const newPausedState = !paused
    onTogglePause()
    
    // Backend'e pause durumunu gönder
    try {
      await fetch(`http://localhost:8000/pause/${newPausedState}`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('Pause hatası:', error)
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Canlı Görüntü</h2>
          <Badge
            variant={connected ? 'default' : 'secondary'}
            className={connected ? 'bg-accent text-accent-foreground' : ''}
          >
            {connected ? 'Bağlı' : 'Bağlantı yok'}
          </Badge>
          {IS_DEMO && <Badge variant="secondary">Demo</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDownloadVideo} title="Video İndir">
            <Download className="size-4" /> İndir
          </Button>
          <Button size="sm" variant="secondary" onClick={handlePauseToggle}>
            {paused ? (
              <>
                <Play className="size-4" /> Devam
              </>
            ) : (
              <>
                <Pause className="size-4" /> Duraklat
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="relative aspect-video w-full bg-black">
        {IS_DEMO ? (
          <DemoCanvas frame={frame} />
        ) : (
          <>
            {/* MJPEG akışı: multipart/x-mixed-replace */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={videoStreamUrl() || '/placeholder.svg'}
              alt="Canlı sualtı video akışı"
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
            <BoxOverlay frame={frame} />
          </>
        )}

        {/* Alarm katmanı */}
        {alarmActive && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
            <div className="absolute inset-0 animate-pulse border-4 border-destructive" />
            <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-destructive-foreground shadow-lg">
              <AlertTriangle className="size-5" aria-hidden />
              <span className="text-sm font-semibold">
                UYARI: Hedef sınıf tespit edildi!
              </span>
            </div>
          </div>
        )}

        {/* Alt bilgi şeridi */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-4 py-2 text-xs text-white">
          <span>
            {frame
              ? `Kare #${frame.frame_id} • ${frame.detections.length} nesne`
              : 'Veri bekleniyor...'}
          </span>
          <span>
            {frame ? `${frame.inference_ms.toFixed(0)} ms çıkarım` : ''}
          </span>
        </div>
      </div>
    </Card>
  )
}
