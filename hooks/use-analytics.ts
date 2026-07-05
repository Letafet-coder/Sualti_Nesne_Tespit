'use client'

import useSWR from 'swr'

import { IS_DEMO, fetchStats, fetchTimeseries } from '@/lib/api'
import { demoStats, demoTimeseries } from '@/lib/demo'
import type { StatsResponse, TimeSeriesResponse } from '@/lib/types'

// İstatistikleri getirir (demo veya gerçek). Canlı his için periyodik yeniler.
export function useStats() {
  return useSWR<StatsResponse>(
    'stats',
    async () => (IS_DEMO ? demoStats() : fetchStats()),
    { refreshInterval: 5000 },
  )
}

// Zaman serisi verisini getirir.
export function useTimeseries(intervalSeconds: number) {
  return useSWR<TimeSeriesResponse>(
    ['timeseries', intervalSeconds],
    async () =>
      IS_DEMO
        ? {
            interval_seconds: intervalSeconds,
            points: demoTimeseries(intervalSeconds),
          }
        : fetchTimeseries(intervalSeconds),
    { refreshInterval: 5000 },
  )
}
