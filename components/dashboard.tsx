'use client'

import { useState } from 'react'

import { CLASSES } from '@/lib/classes'
import { useLiveDetections } from '@/hooks/use-live-detections'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PanelHeader } from '@/components/panel-header'
import { LiveView } from '@/components/live-view'
import { DetectedClasses } from '@/components/detected-classes'
import { LiveEvents } from '@/components/live-events'
import { AlarmControl } from '@/components/alarm-control'
import { StatsCards } from '@/components/stats-cards'
import { TimeseriesChart } from '@/components/timeseries-chart'
import { ClassDistribution } from '@/components/class-distribution'
import { HistoryTable } from '@/components/history-table'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

// Bildirim tipi için basit bir arayüz
interface ToastState {
  visible: boolean
  message: string
  type: 'success' | 'error' | 'info'
}

export function Dashboard() {
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [alarmClass, setAlarmClass] = useState(CLASSES[1].name)
  const [soundOn, setSoundOn] = useState(true)
  const [paused, setPaused] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sourceType, setSourceType] = useState<'webcam' | 'video'>('webcam')

  // Kendi özel bildirim state'imiz
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
  })

  // Bildirimi tetikleyen ve 4 saniye sonra otomatik kapatan fonksiyon
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ visible: true, message, type })
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }))
    }, 4000)
  }

  const { frame, events, connected, alarmActive } = useLiveDetections({
    alarmEnabled,
    alarmClass,
    paused,
  })

  // GİRDİ KAYNAĞINI DEĞİŞTİREN FONKSiyon
  const handleSourceChange = async (type: 'webcam' | 'video') => {
    try {
      const response = await fetch(`http://localhost:8000/set-video-source/${type}`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!data.ok) {
        showToast(data.error || 'Kaynak değiştirilemedi.', 'error')
        if (type === 'video') setSourceType('webcam')
      } else {
        setSourceType(type)
        showToast(
          type === 'webcam' ? ' Bilgisayar kamerası (Webcam) aktif edildi!' : ' Yüklenen video analizi başlatıldı!',
          type === 'webcam' ? 'success' : 'info'
        )
      }
    } catch (error) {
      console.error('Kaynak değiştirme hatası:', error)
      showToast('Backend bağlantı hatası! Kaynak değiştirilemedi.', 'error')
    }
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const response = await fetch('http://localhost:8000/upload-video', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        setSourceType('video')
        showToast('Video başarıyla yüklendi! Yeni analiz başlatılıyor.', 'success')
      } else {
        showToast('Video yükleme sırasında bir hata oluştu.', 'error')
      }
    } catch (error) {
      console.error('Yükleme hatası:', error)
      showToast("Backend bağlantı hatası! Lütfen backend'in çalıştığından emin olun.", 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-background relative">
      
      {/* 2. DAHA BELİRGİN VE CANLI TAILWIND TOAST KUTUSU */}
      {toast.visible && (
        <div 
          className={`fixed bottom-6 right-6 z-[100] max-w-sm w-full p-4 rounded-xl shadow-2xl border-l-4 flex items-center justify-between gap-4 transition-all duration-300 transform scale-100 animate-in slide-in-from-bottom-5 text-sm font-semibold text-white bg-slate-900 border-y-slate-800 border-r-slate-800
            ${toast.type === 'success' ? 'border-l-emerald-500' : ''}
            ${toast.type === 'error' ? 'border-l-rose-500' : ''}
            ${toast.type === 'info' ? 'border-l-sky-500' : ''}
          `}
        >
          <div className="flex items-center gap-2">
            <span>
              {toast.type === 'success' && '✅'}
              {toast.type === 'error' && '❌'}
              {toast.type === 'info' && 'ℹ️'}
            </span>
            <span>{toast.message}</span>
          </div>
          <button 
            onClick={() => setToast((prev) => ({ ...prev, visible: false }))}
            className="text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-2 py-1 rounded-md border border-slate-700 transition-colors shrink-0"
          >
            Kapat
          </button>
        </div>
      )}

      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">
        <PanelHeader alarmEnabled={alarmEnabled} alarmClass={alarmClass} />

        <Tabs defaultValue="live" className="mt-6 w-full">
          <TabsList className="mb-6 px-1.5 py-5 bg-muted/50 border border-border/60">
            <TabsTrigger value="live" className="px-4 py-1.5">Canlı İzleme</TabsTrigger>
            <TabsTrigger value="analytics" className="px-4 py-1.5">Analiz &amp; Grafikler</TabsTrigger>
            <TabsTrigger value="history" className="px-4 py-1.5">Geçmiş Kayıtlar</TabsTrigger>
          </TabsList>

          {/* CANLI İZLEME */}
          <TabsContent value="live" className="mt-0">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2 flex flex-col gap-4">
                
                {/* 📁 AKIŞ VE ANALİZ YÖNETİM ALANI */}
                <div className="p-5 bg-card border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex flex-col gap-1 max-w-xl">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                       Akış ve Analiz Yönetimi
                    </label>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      Lütfen analiz edilecek video kaynağını belirleyin ya da yerel cihazınızdan bir .mp4 dosyası yükleyin.
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    {/* KAYNAK SEÇİM KUTUSU */}
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-1 px-2.5 h-9">
                      <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Kaynak:</Label>
                      <Select
                        value={sourceType}
                        onValueChange={(v) => handleSourceChange(v as 'webcam' | 'video')}
                      >
                        <SelectTrigger className="w-36 h-7 text-xs bg-background border-border shadow-sm focus:ring-0">
                          <SelectValue placeholder="Kaynak Türü" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="webcam">📹 Webcam</SelectItem>
                          <SelectItem value="video">🎞️ Yüklenen Video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* DİNAMİK DOSYA YÜKLEME ALANI */}
                    {sourceType === 'video' && (
                      <div className="flex items-center gap-2 animate-in fade-in duration-200">
                        <input
                          type="file"
                          accept="video/mp4"
                          onChange={handleVideoUpload}
                          disabled={uploading}
                          className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-medium file:bg-background file:text-foreground hover:file:bg-muted disabled:opacity-50 cursor-pointer"
                        />
                        {uploading && (
                          <span className="text-xs text-amber-500 animate-pulse font-medium">
                            İşleniyor...
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* CANLI VİDEO EKRANI */}
                <LiveView
                  frame={frame}
                  connected={connected}
                  alarmActive={alarmActive}
                  paused={paused}
                  onTogglePause={() => setPaused((p) => !p)}
                />
              </div>
              
              <div className="flex flex-col gap-6">
                <AlarmControl
                  enabled={alarmEnabled}
                  className={alarmClass}
                  alarmActive={alarmActive}
                  soundOn={soundOn}
                  onEnabledChange={setAlarmEnabled}
                  onClassChange={setAlarmClass}
                  onSoundChange={setSoundOn}
                />
                <LiveEvents events={events} />
              </div>
            </div>

            <div className="mt-6">
              <DetectedClasses frame={frame} />
            </div>
          </TabsContent>

          {/* ANALİZ & GRAFİKLER */}
          <TabsContent value="analytics" className="mt-0">
            <div className="flex flex-col gap-6">
              <StatsCards />
              <TimeseriesChart />
              <ClassDistribution />
            </div>
          </TabsContent>

          {/* GEÇMİŞ KAYITLAR */}
          <TabsContent value="history" className="mt-0">
            <HistoryTable />
          </TabsContent>
        </Tabs>

        <footer className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          Sualtı Nesne Tespiti Paneli 
        </footer>
      </div>
    </div>
  )
}