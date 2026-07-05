
// Gerçek backend bağlanınca (NEXT_PUBLIC_BACKEND_URL) bu modül kullanılmaz.

import { CLASSES } from './classes'
import type {
  BackendStatus,
  Detection,
  FrameResult,
  HistoryRecord,
  StatsResponse,
  TimeSeriesPoint,
} from './types'

const W = 960
const H = 540

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function makeDetection(): Detection {
  const meta = CLASSES[Math.floor(Math.random() * CLASSES.length)]
  const w = rand(80, 220)
  const h = rand(70, 200)
  const x1 = rand(0, W - w)
  const y1 = rand(0, H - h)
  return {
    class_id: CLASSES.indexOf(meta),
    class_name: meta.name,
    confidence: rand(0.4, 0.98),
    bbox: { x1, y1, x2: x1 + w, y2: y1 + h },
  }
}

let frameId = 0

export function makeDemoFrame(alarmClass?: string): FrameResult {
  frameId += 1
  const count = Math.floor(rand(0, 4))
  const detections = Array.from({ length: count }, makeDetection)
  const alarm_active = alarmClass
    ? detections.some((d) => d.class_name === alarmClass)
    : false
  return {
    frame_id: frameId,
    timestamp: new Date().toISOString(),
    width: W,
    height: H,
    inference_ms: rand(12, 45),
    detections,
    alarm_active,
  }
}

// Son 2 saati kapsayan sahte geçmiş kayıtları
let cachedHistory: HistoryRecord[] | null = null

function buildHistory(): HistoryRecord[] {
  const now = Date.now()
  const records: HistoryRecord[] = []
  let id = 1
  // 2 saat, dakikada değişen yoğunlukta tespitler
  for (let minute = 120; minute >= 0; minute--) {
    const ts = now - minute * 60_000
    const density = 1 + Math.round(2 + 2 * Math.sin(minute / 12))
    for (let k = 0; k < density; k++) {
      const meta = CLASSES[Math.floor(Math.random() * CLASSES.length)]
      const w = rand(80, 220)
      const h = rand(70, 200)
      const x1 = rand(0, W - w)
      const y1 = rand(0, H - h)
      records.push({
        id: id++,
        timestamp: new Date(ts + rand(0, 59_000)).toISOString(),
        class_id: CLASSES.indexOf(meta),
        class_name: meta.name,
        confidence: rand(0.4, 0.98),
        x1,
        y1,
        x2: x1 + w,
        y2: y1 + h,
      })
    }
  }
  return records.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

export function getDemoHistory(): HistoryRecord[] {
  if (!cachedHistory) cachedHistory = buildHistory()
  return cachedHistory
}

export function demoHistory(params: {
  class_name?: string
  min_confidence?: number
  limit?: number
  offset?: number
}) {
  let recs = getDemoHistory()
  if (params.class_name)
    recs = recs.filter((r) => r.class_name === params.class_name)
  if (params.min_confidence != null)
    recs = recs.filter((r) => r.confidence >= params.min_confidence!)
  const total = recs.length
  const offset = params.offset ?? 0
  const limit = params.limit ?? 100
  return { total, records: recs.slice(offset, offset + limit) }
}

export function demoStats(): StatsResponse {
  const recs = getDemoHistory()
  const per_class: Record<string, number> = {}
  for (const r of recs) per_class[r.class_name] = (per_class[r.class_name] ?? 0) + 1
  const times = recs.map((r) => new Date(r.timestamp).getTime())
  return {
    total_detections: recs.length,
    per_class,
    first_seen: new Date(Math.min(...times)).toISOString(),
    last_seen: new Date(Math.max(...times)).toISOString(),
  }
}

export function demoTimeseries(intervalSeconds: number): TimeSeriesPoint[] {
  const recs = getDemoHistory()
  const buckets: Record<number, Record<string, number>> = {}
  for (const r of recs) {
    const epoch = Math.floor(new Date(r.timestamp).getTime() / 1000)
    const b = Math.floor(epoch / intervalSeconds) * intervalSeconds
    buckets[b] = buckets[b] ?? {}
    buckets[b][r.class_name] = (buckets[b][r.class_name] ?? 0) + 1
  }
  return Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map((epoch) => {
      const counts = buckets[epoch]
      return {
        bucket: new Date(epoch * 1000).toISOString(),
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      }
    })
}

export function demoStatus(alarm: {
  enabled: boolean
  class_name: string
}): BackendStatus {
  return {
    running: true,
    model_ready: false,
    model_error:
      'Demo modu etkin — gerçek model bağlı değil (NEXT_PUBLIC_BACKEND_URL ayarlanmadı).',
    video_opened: true,
    video_source: 'demo',
    inference_fps: 10,
    alarm,
    alarm_active: false,
    classes: CLASSES.map((c) => c.name),
  }
}
