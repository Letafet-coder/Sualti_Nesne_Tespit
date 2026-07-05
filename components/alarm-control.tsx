'use client'

import { useEffect, useRef } from 'react'
import { Bell, BellOff, Volume2 } from 'lucide-react'

import { CLASSES } from '@/lib/classes'
import { IS_DEMO, updateAlarm } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  enabled: boolean
  className: string
  alarmActive: boolean
  soundOn: boolean
  onEnabledChange: (v: boolean) => void
  onClassChange: (v: string) => void
  onSoundChange: (v: boolean) => void
}

// Basit WebAudio bip sesi (dosya gerektirmez)
function useBeep(active: boolean, soundOn: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active || !soundOn) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    const beep = () => {
      try {
        if (!ctxRef.current) {
          ctxRef.current = new (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext)()
        }
        const ctx = ctxRef.current
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.25)
      } catch {
        // yok say
      }
    }
    beep()
    timerRef.current = setInterval(beep, 900)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [active, soundOn])
}

export function AlarmControl({
  enabled,
  className,
  alarmActive,
  soundOn,
  onEnabledChange,
  onClassChange,
  onSoundChange,
}: Props) {
  useBeep(alarmActive, soundOn)

  // Ayar değişince gerçek backend'e bildir
  useEffect(() => {
    if (IS_DEMO) return
    updateAlarm({ enabled, class_name: className }).catch(() => {})
  }, [enabled, className])

  return (
    <Card className={alarmActive ? 'border-destructive' : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {enabled ? (
            <Bell className="size-4 text-primary" />
          ) : (
            <BellOff className="size-4 text-muted-foreground" />
          )}
          Uyarı (Alarm)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="alarm-enabled">Alarm etkin</Label>
          <Switch
            id="alarm-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        <div className="space-y-2">
          <Label>Hedef sınıf</Label>
          <Select value={className} onValueChange={(value) => value && onClassChange(value)} disabled={!enabled}>
            <SelectTrigger>
              <SelectValue placeholder={CLASSES.find(c => c.name === className)?.label || "Sınıf seçin..."} />
            </SelectTrigger>
            <SelectContent>
              {CLASSES.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="alarm-sound" className="flex items-center gap-2">
            <Volume2 className="size-4" /> Sesli uyarı
          </Label>
          <Switch
            id="alarm-sound"
            checked={soundOn}
            onCheckedChange={onSoundChange}
            disabled={!enabled}
          />
        </div>

        {alarmActive && (
          <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm font-medium text-destructive">
            Hedef sınıf şu anda görüntüde!
          </p>
        )}
      </CardContent>
    </Card>
  )
}
