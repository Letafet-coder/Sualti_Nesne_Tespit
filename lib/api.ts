// Backend API istemcisi.
// NEXT_PUBLIC_BACKEND_URL tanımlıysa gerçek FastAPI backend'e bağlanır,
// tanımlı değilse demo modu kullanılır (preview için).

import type {
  AlarmConfig,
  BackendStatus,
  HistoryResponse,
  StatsResponse,
  TimeSeriesResponse,
} from './types'

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? ''

export const IS_DEMO = BACKEND_URL === ''

export function videoStreamUrl(): string {
  return IS_DEMO ? '' : `${BACKEND_URL}/video`
}

export function wsUrl(): string {
  if (IS_DEMO) return ''
  return `${BACKEND_URL.replace(/^http/, 'ws')}/ws`
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`)
  if (!res.ok) throw new Error(`İstek başarısız: ${res.status}`)
  return res.json()
}

export async function fetchStatus(): Promise<BackendStatus> {
  return get<BackendStatus>('/status')
}

export async function fetchHistory(params: {
  class_name?: string
  min_confidence?: number
  start?: string
  end?: string
  limit?: number
  offset?: number
}): Promise<HistoryResponse> {
  const q = new URLSearchParams()
  if (params.class_name) q.set('class_name', params.class_name)
  if (params.min_confidence != null)
    q.set('min_confidence', String(params.min_confidence))
  if (params.start) q.set('start', params.start)
  if (params.end) q.set('end', params.end)
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.offset != null) q.set('offset', String(params.offset))
  return get<HistoryResponse>(`/history?${q.toString()}`)
}

export async function fetchStats(): Promise<StatsResponse> {
  return get<StatsResponse>('/stats')
}

export async function fetchTimeseries(
  intervalSeconds: number,
): Promise<TimeSeriesResponse> {
  return get<TimeSeriesResponse>(`/timeseries?interval_seconds=${intervalSeconds}`)
}

export async function updateAlarm(cfg: AlarmConfig): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/alarm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  })
  if (!res.ok) throw new Error('Alarm ayarı güncellenemedi')
}
