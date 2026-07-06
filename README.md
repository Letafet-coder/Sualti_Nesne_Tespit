# MAREN — Sualtı Nesne Tespiti Paneli

YOLOv8 tabanlı sualtı nesne tespiti için uçtan uca sistem. **Python FastAPI backend**
(model çıkarımı + JSON doğrulama + SQLite kayıt) ve **React / Next.js panel**
(canlı izleme, sınıf görselleri, zaman serisi grafikleri, geçmiş sorgulama, alarm) içerir.

## Desteklenen sınıflar (7)

| Model adı        | Panel etiketi   |
| ---------------- | --------------- |
| `fish`           | Balık           |
| `jellyfish`      | Denizanası      |
| `penguin`        | Penguen         |
| `puffin`         | puffin          |
| `shark`          | Köpekbalığı     |
| `starfish`       | Deniz yıldızı   |
| `stingray`       | Vatoz           |

> Not: Backend, sınıf adlarını modelin `model.names` alanından okur. Yukarıdaki
> Türkçe etiketler yalnızca panelde gösterim içindir (`lib/classes.ts`).

---

## Veri Setleri ve Model Eğitimi
Proje geliştirme ve optimizasyon sürecinde 2 farklı model eğitilmiş ve performansları test edilmiştir:

Hazır Model ve Genel Sualtı Veri Seti: Projede kullanılan hazır model, Kaggle üzerinde yer alan YOLOv8 Underwater Object Detection Dataset taban alınarak hazırlanmış ve ayrıca Collection of Underwater Object Detection Dataset açık kaynak veri setiyle desteklenerek eğitilmiştir.

Özel (Custom) Veri Seti: İkinci model ise projeye özgü etiketlerle tamamen tarafımca hazırlanan, düzenlenen ve optimize edilen Roboflow - Underwater Labels (usebo) veri seti ile eğitilmiştir.

Esnek Model Yönetimi: Sistem varsayılan olarak models/Hazir_Model.pt ağırlık dosyasını kullanır. Ancak altyapı tamamen dinamik tasarlanmıştır; kendi eğittiğiniz herhangi bir YOLO modelini ilgili dizine bırakıp .env dosyasındaki MODEL_PATH değişkenini ayarlayarak sistemi yeni modelinizle doğrudan çalıştırabilirsiniz.
---

## Test Edilebilirlik
Sistemin kararlılığını, veri bütünlüğünü ve gerçek zamanlı çalışma performansını doğrulamak amacıyla iki ana katmanda da kapsamlı testler gerçekleştirilmiştir:

Backend Testi: FastAPI uç noktalarının doğruluğu, Pydantic şema validasyonları, SQLite veritabanı kayıt süreçleri ve WebSocket akış kararlılığı test edilmiştir.

Frontend (Panel) Testi: Bileşenlerin render süreçleri, canlı veri akışındaki gecikmeler, grafiklerin dinamik güncellenmesi ve demo/real-time mod geçiş senaryoları başarıyla test edilerek doğrulanmıştır.

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

* Python 3.10 veya üstü (Backend için) [cite: 7]
* Node.js 18 veya üstü (Panel için) [cite: 8]
- Eğittiğiniz YOLO ağırlık dosyası: `backend/models/Hazir_Model.pt`

### Kurulum
```cmd
cd backend
:: Sanal ortamı oluşturun
python -m venv venv

:: Komut İstemi (CMD) kullanıyorsanız aktive edin:
venv\Scripts\activate

:: PowerShell kullanıyorsanız aktive edin:
.\venv\Scripts\Activate.ps1


Bağımlılıkları Kurun
pip install -r requirements.txt

.env dosyasını kontrol edin
dir .env
            
### Backend'i Çalıştırma

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Şu satırları görmelisiniz:
INFO:  Uvicorn running on http://127.0.0.1:8000
INFO:  Application startup complete.
Doğrulamak için tarayıcıdan şu adresi açın:
http://localhost:8000/status
```

### Ortam değişkenleri (`.env`)

| Değişken          | Varsayılan               | Açıklama                                              |
| ----------------- | ------------------------ | ----------------------------------------------------  |
| `MODEL_PATH`      | `models/Hazir_Model.pt`  | YOLO ağırlık dosyasının yolu                          |
| `VIDEO_SOURCE`    | `0`                      | `0` = USB webcam, ya da `sample.mp4` gibi dosya yolu  |
| `CONF_THRESHOLD`  | `0.35`                   | Minimum güven eşiği                                   |
| `DB_PATH`         | `detections.db`          | SQLite veritabanı dosyası                             |
| `TARGET_FPS`      | `10`                     | Çıkarım kare hızı                                     |
| `CORS_ORIGINS`    | `http://localhost:3000`  | Panelin adresi                                        |

Video kaynağı olarak hem **USB webcam** (`VIDEO_SOURCE=0`) hem de **lokal .mp4**
(`VIDEO_SOURCE=sample.mp4`) desteklenir; `.mp4` dosyası bittiğinde başa sarılır.

### API uç noktaları

| Metot + yol            | Açıklama                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `GET /status`          | Model/video durumu, alarm ayarı, sınıf listesi              |
| `GET /video`           | MJPEG canlı görüntü akışı                                   |
| `WS  /ws`              | Her kare için doğrulanmış JSON tespit sonucu (canlı akış)   |
| `GET /history`         | Kayıtlı tespitler (filtre + sayfalama)                      |
| `GET /stats`           | Toplam + sınıf bazlı özet                                   |
| `GET /timeseries`      | Zaman serisi                                                |
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
echo NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 > .env.local
```

`NEXT_PUBLIC_BACKEND_URL` tanımlıysa panel WebSocket (`/ws`), MJPEG (`/video`) ve
REST uç noktalarını gerçek backend'den kullanır. Tanımlı değilse demo verisi üretir
(önizlemede grafikler ve tespitler yine de görünür).

### Panel çalıştırma

```bash
npm install -g pnpm
pnpm install
pnpm approve-builds
pnpm dev
# http://localhost:3000
```

---

## Docker ile Çalıştırma (Hızlı Kurulum)
Projeyi yerel bilgisayarınızda herhangi bir Python veya Node.js bağımlılığı kurmakla uğraşmadan, izole bir konteyner mimarisinde tek bir komutla ayağa kaldırabilirsiniz.

Kök dizinde yer alan Docker yapılandırması sayesinde hem backend hem de frontend servislerini derleyip çalıştırmak için şu komutu vermeniz yeterlidir:

```bash
docker-compose up --build
```

## Uçtan uca çalıştırma sırası

1. `backend/models/Hazir_Model.pt` dosyasını yerleştir.
2. Backend'i başlat: `uvicorn app.main:app --port 8000`
3. `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000` ayarla.
4. Paneli başlat: `pnpm dev` → `http://localhost:3000`
