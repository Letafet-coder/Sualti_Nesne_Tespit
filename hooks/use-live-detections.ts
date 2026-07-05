'use client'

import { useEffect, useRef, useState } from 'react'

import { IS_DEMO, wsUrl } from '@/lib/api'
import { makeDemoFrame } from '@/lib/demo'
import type { FrameResult } from '@/lib/types'

export interface LiveEvent {
  id: string
  timestamp: string
  class_name: string
  confidence: number
}

interface Options {
  alarmEnabled: boolean
  alarmClass: string
  paused: boolean
}

/**
 * Canlı tespit akışını yönetir.
 * - Gerçek modda WebSocket (/ws) dinler.
 * - Demo modda düzenli aralıkla sahte kareler üretir.
 */
export function useLiveDetections({ alarmEnabled, alarmClass, paused }: Options) {
  const [frame, setFrame] = useState<FrameResult | null>(null)
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [alarmActive, setAlarmActive] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // Gelen kareyi işleyip olay listesini güncelleyen yardımcı
  function handleFrame(f: FrameResult) {
    setFrame(f)
    const active = alarmEnabled
      ? f.detections.some((d) => d.class_name === alarmClass)
      : false
    setAlarmActive(active)
    if (f.detections.length) {
      const newEvents: LiveEvent[] = f.detections.map((d, i) => ({
        id: `${f.frame_id}-${i}`,
        timestamp: f.timestamp,
        class_name: d.class_name,
        confidence: d.confidence,
      }))
      setEvents((prev) => [...newEvents, ...prev].slice(0, 40))
    }
  }

  useEffect(() => {
    if (paused) return

    if (IS_DEMO) {
      const interval = setInterval(() => {
        handleFrame(makeDemoFrame(alarmEnabled ? alarmClass : undefined))
      }, 1200)
      setConnected(true)
      return () => clearInterval(interval)
    }

    // Gerçek backend: WebSocket
    const ws = new WebSocket(wsUrl())
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)
    ws.onmessage = (ev) => {
      try {
        const f = JSON.parse(ev.data) as FrameResult
        handleFrame(f)
      } catch {
        // yok say
      }
    }
    return () => ws.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, alarmEnabled, alarmClass])

  return { frame, events, connected, alarmActive }
}
