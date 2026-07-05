'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Search } from 'lucide-react'

import { CLASSES, getClassMeta } from '@/lib/classes'
import { IS_DEMO, fetchHistory } from '@/lib/api'
import { demoHistory } from '@/lib/demo'
import type { HistoryResponse } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE = 15
const ALL = 'all'

export function HistoryTable() {
  const [classFilter, setClassFilter] = useState<string>(ALL)
  const [minConf, setMinConf] = useState('0')
  const [page, setPage] = useState(0)

  // 🛠️ 422 HATASI ÇÖZÜMÜ: Ekranda 40 yazıyorsa backend'e 0.40 gitmesi için 100'e bölüyoruz
  const params = {
    class_name: classFilter === ALL ? undefined : classFilter,
    min_confidence: minConf ? Number(minConf) / 100 : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }

  const { data } = useSWR<HistoryResponse>(
    ['history', params],
    async () => (IS_DEMO ? demoHistory(params) : fetchHistory(params)),
    { refreshInterval: 8000 },
  )

  const total = data?.total ?? 0
  const records = data?.records ?? []
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 📥 VERİ İNDİRME TETİKLEYİCİSİ
  const handleExport = (type: 'excel' | 'pdf') => {
    const classParam = classFilter === ALL ? '' : classFilter
    const confParam = minConf ? Number(minConf) / 100 : ''
    
    // Backend endpoint'ine o anki filtreleri query string olarak gönderiyoruz
    window.location.href = `http://localhost:8000/history/export/${type}?class_name=${classParam}&min_confidence=${confParam}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Search className="size-4 text-primary" />
          Geçmiş Kayıtlar (/history)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtreler ve Butonlar */}
        <div className="flex flex-wrap items-end gap-3 w-full">
          <div className="space-y-1">
            <Label className="text-xs">Sınıf</Label>
            <Select
              value={classFilter}
              onValueChange={(v) => {
                if (v) {
                  setClassFilter(v)
                  setPage(0)
                }
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tümü</SelectItem>
                {CLASSES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Min. güven (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={minConf}
              onChange={(e) => {
                setMinConf(e.target.value)
                setPage(0)
              }}
              className="w-28"
            />
          </div>

          {/*  DIŞA AKTAR BÖLÜMÜ */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-600/50 hover:bg-emerald-600/20 text-emerald-400 text-xs"
              onClick={() => handleExport('excel')}
            >
              Excel Aktar
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="border-rose-600/50 hover:bg-rose-600/20 text-rose-400 text-xs"
              onClick={() => handleExport('pdf')}
            >
              PDF Raporu
            </Button>
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            Toplam {total.toLocaleString('tr-TR')} Kayıt
          </div>
        </div>

        {/* Tablo */}
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Sınıf</TableHead>
                <TableHead>Etiket</TableHead>
                <TableHead>Güven</TableHead>
                <TableHead className="hidden md:table-cell">Kutu (x1,y1,x2,y2)</TableHead>
                <TableHead className="text-right">Zaman</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Kayıt bulunamadı
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => {
                  const meta = getClassMeta(r.class_name)
                  const IconComponent = meta.icon

                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center justify-center size-8 rounded bg-slate-800/50">
                          <IconComponent className="size-4" style={{ color: meta.color }} />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{meta.label}</TableCell>
                      <TableCell>
                        <Badge
                          style={{ backgroundColor: meta.color, color: '#04121d' }}
                        >
                          {(r.confidence * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                        {r.x1.toFixed(0)}, {r.y1.toFixed(0)}, {r.x2.toFixed(0)},{' '}
                        {r.y2.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString('tr-TR')}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Sayfalama */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Sayfa {page + 1} / {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Önceki
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}