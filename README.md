# MAREN — Sualtı Nesne Tespiti Paneli

YOLOv8 tabanlı sualtı nesne tespiti için uçtan uca sistem. **Python FastAPI backend**
(model çıkarımı + JSON doğrulama + SQLite kayıt) ve **React / Next.js panel**
(canlı izleme, sınıf görselleri, zaman serisi grafikleri, geçmiş sorgulama, alarm) içerir.

## Desteklenen sınıflar (6)

| Model adı        | Panel etiketi   |
| ---------------- | --------------- |
| `fish`           | Balık           |
| `jellyfish`      | Denizanası      |
| `penguin`        | Penguen         |
| `puffin`         | Vatoz           |
| `shark`          | Köpekbalığı     |
| `starfish`       | Deniz yıldızı   |
| `stingray`       | Vatoz           |

> Not: Backend, sınıf adlarını modelin `model.names` alanından okur. Yukarıdaki
> Türkçe etiketler yalnızca panelde gösterim içindir (`lib/classes.ts`).

---

## Mimari

```
Kamera / .mp4  ──▶  YOLOv8 (Ultralytics)  ──▶  Pydantic doğrulama
                                                     │
                        ┌────────────────────────────┼───────────────┐
                        ▼                             ▼               ▼
                   SQLite (kayıt)              WebSocket (/ws)   MJPEG (/video)
                        │                             │               │
                        ▼                             ▼               ▼
                   /history, /stats,        Canlı tespit akışı   Canlı görüntü
                   /timeseries  ───────────────▶  React Panel
```

---

## 1) Backend (FastAPI + YOLOv8)

### Gereksinimler

- Python 3.10+
- Eğittiğiniz YOLO ağırlık dosyası: `backend/models/Hazir_Model.pt`

### Kurulum

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             


### Çalıştırma

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Ortam değişkenleri (`.env`)

| Değişken          | Varsayılan               | Açıklama                                             |
| ----------------- | ------------------------ | ---------------------------------------------------- |
| `MODEL_PATH`      | `models/Hazie_Model.pt`  | YOLO ağırlık dosyasının yolu                          |
| `VIDEO_SOURCE`    | `0`                      | `0` = USB webcam, ya da `sample.mp4` gibi dosya yolu |
| `CONF_THRESHOLD`  | `0.35`                   | Minimum güven eşiği                                   |
| `DB_PATH`         | `detections.db`          | SQLite veritabanı dosyası                             |
| `TARGET_FPS`      | `10`                     | Çıkarım kare hızı                                     |
| `CORS_ORIGINS`    | `http://localhost:3000`  | Panelin adresi (virgülle çoklu)                       |

Video kaynağı olarak hem **USB webcam** (`VIDEO_SOURCE=0`) hem de **lokal .mp4**
(`VIDEO_SOURCE=sample.mp4`) desteklenir; `.mp4` dosyası bittiğinde başa sarılır.

### API uç noktaları

| Metot + yol            | Açıklama                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `GET /status`          | Model/video durumu, alarm ayarı, sınıf listesi              |
| `GET /video`           | MJPEG canlı görüntü akışı (kutular çizili)                  |
| `WS  /ws`              | Her kare için doğrulanmış JSON tespit sonucu (canlı akış)   |
| `GET /history`         | Kayıtlı tespitler (filtre + sayfalama)                      |
| `GET /stats`           | Toplam + sınıf bazlı özet                                    |
| `GET /timeseries`      | Zaman serisi (kova bazlı sayımlar)                          |
| `POST /alarm`          | Alarm ayarını güncelle (`{ enabled, class_name }`)          |

#### `/history` sorgu parametreleri

```
GET /history?class_name=Human%20Diver&min_confidence=0.6&start=2025-01-01T00:00:00&limit=50&offset=0
```

- `class_name` — sınıfa göre filtre
- `min_confidence` — minimum güven (0–1)
- `start`, `end` — ISO 8601 zaman aralığı
- `limit`, `offset` — sayfalama

### JSON doğrulama (Pydantic)

YOLO çıktısı `app/schemas.py` içindeki Pydantic modelleriyle doğrulanır ve
şu şekilde standartlaştırılır:

```json
{
  "frame_id": 128,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "width": 1280,
  "height": 720,
  "inference_ms": 18.4,
  "detections": [
    {
      "class_id": 1,
      "class_name": "Shark",
      "confidence": 0.92,
      "bbox": { "x1": 641, "y1": 85, "x2": 732, "y2": 274 }
    }
  ],
  "alarm_active": true
}
```

Her tespit ayrıca SQLite `detections` tablosuna kaydedilir ve `/history` ile sorgulanır.

---

## 2) Panel (React / Next.js)

Panel bu deponun kök dizinindedir ve şu özellikleri sunar:

- **Canlı İzleme:** MJPEG görüntü + kutu bindirmesi, alarm katmanı, duraklat/devam.
- **Tespit Edilen Sınıflar:** 7 sınıfın görsel kartı; sınıf tespit edilince kartı
  vurgulanır ve güven skoru gösterilir (istenen "görsel çıksın" özelliği).
- **Canlı Tespit Akışı:** Görsel + etiket + güven ile son tespitler.
- **Uyarı (Alarm):** Varsayılan **kapalı**; panelden açılır, hedef sınıf seçilir,
  sesli uyarı (WebAudio bip) eklenir. Ayar `POST /alarm` ile backend'e bildirilir.
- **Analiz & Grafikler:** Özet kartları, sınıf bazlı **zaman serisi** grafiği ve
  toplam sınıf dağılımı.
- **Geçmiş Kayıtlar:** `/history` uç noktası; sınıf ve güven filtreleri + sayfalama.

### Backend'e bağlama

Panel varsayılan olarak **demo modunda** çalışır.
Gerçek backend'e bağlamak için ortam değişkenini ayarlayın:

```bash
# .env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

`NEXT_PUBLIC_BACKEND_URL` tanımlıysa panel WebSocket (`/ws`), MJPEG (`/video`) ve
REST uç noktalarını gerçek backend'den kullanır. Tanımlı değilse demo verisi üretir
(önizlemede grafikler ve tespitler yine de görünür).

### Panel çalıştırma

```bash
pnpm install
pnpm dev
# http://localhost:3000
```

---

## Uçtan uca çalıştırma sırası

1. `backend/models/Hazir_Model.pt` dosyasını yerleştir.
2. Backend'i başlat: `uvicorn app.main:app --port 8000`
3. `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000` ayarla.
4. Paneli başlat: `pnpm dev` → `http://localhost:3000`
