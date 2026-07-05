// Backend Pydantic modelleriyle eşleşen TypeScript tipleri

export interface BoundingBox {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Detection {
  class_id: number
  class_name: string
  confidence: number
  bbox: BoundingBox
}

export interface FrameResult {
  frame_id: number
  timestamp: string
  width: number
  height: number
  inference_ms: number
  detections: Detection[]
  alarm_active?: boolean
}

export interface HistoryRecord {
  id: number
  timestamp: string
  class_id: number
  class_name: string
  confidence: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface HistoryResponse {
  total: number
  records: HistoryRecord[]
}

export interface TimeSeriesPoint {
  bucket: string
  counts: Record<string, number>
  total: number
}

export interface TimeSeriesResponse {
  interval_seconds: number
  points: TimeSeriesPoint[]
}

export interface StatsResponse {
  total_detections: number
  per_class: Record<string, number>
  first_seen: string | null
  last_seen: string | null
}

export interface AlarmConfig {
  enabled: boolean
  class_name: string
}

export interface BackendStatus {
  running: boolean
  model_ready: boolean
  model_error: string | null
  video_opened: boolean
  video_source: string
  inference_fps: number
  alarm: AlarmConfig
  alarm_active: boolean
  classes: string[]
}
