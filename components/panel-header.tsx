'use client'

import { Waves, Cpu, Server, TriangleAlert } from 'lucide-react'
import useSWR from 'swr'

import { IS_DEMO, fetchStatus } from '@/lib/api'
import { demoStatus } from '@/lib/demo'
import type { BackendStatus } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

interface Props {
  alarmEnabled: boolean
  alarmClass: string
}

export function PanelHeader({ alarmEnabled, alarmClass }: Props) {
  const { data } = useSWR<BackendStatus>(
    'status',
    async () =>
      IS_DEMO
        ? demoStatus({ enabled: alarmEnabled, class_name: alarmClass })
        : fetchStatus(),
    { refreshInterval: 5000 },
  )

  const modelReady = data?.model_ready ?? false

  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Waves className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-balance">
             Sualtı Nesne Tespiti
          </h1>
          <p className="text-sm text-muted-foreground">
            Canlı İzleme Paneli
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1.5"
          title={data?.model_error ?? undefined}
        >
          <Cpu className="size-3.5" />
          {modelReady ? 'Model hazır' : 'Model bağlı değil'}
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <Server className="size-3.5" />
          {IS_DEMO ? 'Demo modu' : 'Backend bağlı'}
        </Badge>
        {!modelReady && (
          <Badge variant="secondary" className="gap-1.5">
            <TriangleAlert className="size-3.5" />
            Sonuçlar simülasyon
          </Badge>
        )}
      </div>
    </header>
  )
}
