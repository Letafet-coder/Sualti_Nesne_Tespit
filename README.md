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

* **Backend Testi:** FastAPI uç noktalarının doğruluğu, Pydantic şema validasyonları, SQLite veritabanı kayıt süreçleri ve WebSocket akış kararlılığı test edilmiştir.

* **Frontend (Panel) Testi:** Bileşenlerin render süreçleri, canlı veri akışındaki gecikmeler, grafiklerin dinamik güncellenmesi ve demo/real-time mod geçiş senaryoları başarıyla test edilerek doğrulanmıştır.

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

:: Bağımlılıkları Kurun
pip install -r requirements.txt
> Not: Bu komut ultralytics üzerinden PyTorch'u (CPU sürümü, ~1–2 GB) da indirir. İlk kurulum uzun sürer; bağlantı kesilirse aynı komutu > tekrar çalıştırın, kaldığı yerden devam eder.

:: .env dosyasını kontrol edin
dir .env
            
### Backend'i Çalıştırma

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

:: Şu satırları görmelisiniz:
INFO:  Uvicorn running on http://127.0.0.1:8000
INFO:  Application startup complete.

:: Doğrulamak için tarayıcıdan şu adresi açın:
http://localhost:8000/status

> Not:Başlangıçta görüntü akmaması normaldir — VIDEO_SOURCE boş bırakılmıştır; sistem paneli açıp video yükleyene kadar bekler. Ayrıca  > ilk açılışta çıkan Ultralytics settings.json satırı hata değil, ayar dosyasının ilk kez oluşturulmasıdır.

:: Bu terminali açık bırakın — backend çalışmaya devam etmeli.

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

> **Not:** Bu bölümü yeni bir terminalde yapın. Backend terminaline dokunmayın, çalışmaya devam etsin.
> 
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


### Adım 2.1 — Node.js kurulu mu kontrol edin

Panel için Node.js gerekir; `npm` ve `pnpm` ikisi de Node.js ile birlikte gelir. Önce kurulu olup olmadığını kontrol edin:

```bash
node -v
npm -v
```

İkisi de bir sürüm numarası döndürüyorsa (örn. `v24.x.x` ve `11.x.x`) Node.js zaten kuruludur — doğrudan **Adım 2.2**'ye geçin.

Eğer `'node' is not recognized` veya `'npm' is not recognized` hatası alıyorsanız, Node.js kurulu değildir — aşağıdaki **Adım 2.1a**'yı uygulayın.

### Adım 2.1a — Node.js kurulumu (yalnızca kurulu değilse)

- [nodejs.org/en/download](https://nodejs.org/en/download) adresine gidin.
- LTS sürümünü seçin (güncel LTS: Node.js 24.x "Krypton"). *Current* değil, **LTS** olanı indirin.
- Windows için `.msi` (64-bit) yükleyiciyi indirip çalıştırın.
- Kurulum sihirbazında **"Add to PATH"** seçeneğinin işaretli olduğundan emin olun (varsayılan işaretlidir).
- **"Automatically install the necessary tools... (Chocolatey)"** seçeneğini işaretlemeyin.
- Kurulum bitince açık olan tüm terminalleri kapatın ve yeni bir terminal açın (PATH'in güncellenmesi için şart).

Yeni terminalde kurulumu doğrulayın:

```bash
node -v
npm -v
```

İkisi de sürüm numarası döndürüyorsa Node.js hazırdır; 
**Adım 2.2** ile devam edin.

> **Not:** Node.js modern npm ile birlikte `corepack` de getirir; istenirse `pnpm` onunla da etkinleştirilebilir. Ancak en basit yol
 **Adım 2.4**'teki `npm install -g pnpm` komutudur.

### Adım 2.2 — Proje kök dizinine gidin

```bash
cd C:\Users\HP\Desktop\underwater-project
```

(Backend değil, **kök dizin** — panel burada.)

### Adım 2.3 — Paneli backend'e bağlayın

Panel varsayılan olarak **demo modunda** çalışır (sahte veriyle, backend'e bağlanmadan).

Gerçek backend'e bağlamak için kök dizinde `.env.local` dosyası oluşturun:

```bash
echo NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 > .env.local
```

`NEXT_PUBLIC_BACKEND_URL` tanımlıysa panel WebSocket (`/ws`), MJPEG (`/video`) ve REST uç
noktalarını gerçek backend'den kullanır. Tanımlı değilse demo verisi üretir (önizlemede
grafikler ve tespitler yine de görünür).

### Adım 2.4 — pnpm kurun ve bağımlılıkları yükleyin

```bash
npm install -g pnpm
pnpm install
```

`pnpm` yerine `npm install` de kullanabilirsiniz; ancak depoda `pnpm-lock.yaml` olduğu için
`pnpm` daha temiz kurar.

### Adım 2.5 — Build script onayı (pnpm hatası için)

Yeni pnpm sürümü `sharp` ve `msw` paketlerinin build scriptlerini otomatik çalıştırmaz ve
`ERR_PNPM_IGNORED_BUILDS` hatası verebilir. Çözüm:

```bash
pnpm approve-builds
```

Açılan listede `space` ile `sharp` ve `msw`'yi seçin (veya `a` ile hepsini), `Enter` ile onaylayın.

Alternatif — kontrolü baypas edip doğrudan başlatmak isterseniz:

```bash
pnpm exec next dev
```

### Adım 2.6 — Paneli başlatın

```bash
pnpm dev
```

Terminalde `Local: http://localhost:3000` satırını görünce tarayıcıdan bu adresi açın.

---



## 3 ) Kullanım

- Backend `http://localhost:8000`, panel `http://localhost:3000` adresinde çalışır.
- Panelden bir `.mp4` video yükleyin (veya webcam'e geçin). O an backend terminalinde `[VIDEO]` satırları akmaya başlar.
- Panelde canlı görüntü, kutu bindirmeleri, tespit edilen sınıf kartları, zaman serisi grafikleri ve geçmiş kayıtlar görünür.
- Model 7 sınıf tanır: `fish`, `jellyfish`, `penguin`, `puffin`, `shark`, `starfish`, `stingray`.

> **Not:** Excel dışa aktarma özelliğini (`/history/export/excel`) kullanacaksanız, backend venv'inde ayrıca `pip install openpyxl` çalıştırın; bu paket `requirements.txt`'te eksiktir ama sadece o özellik için gereklidir.

---

## Hızlı Komut Özeti

**Terminal 1 — Backend**

```bash
cd ...\underwater-project\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Panel**

```bash
cd ...\underwater-project
echo NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 > .env.local
npm install -g pnpm
pnpm install
pnpm approve-builds
pnpm dev
```

---

## Docker ile Çalıştırma (Hızlı Kurulum)

Projeyi yerel bilgisayarınızda herhangi bir Python veya Node.js bağımlılığı kurmakla
uğraşmadan, izole bir konteyner mimarisinde tek bir komutla ayağa kaldırabilirsiniz.

Kök dizinde yer alan Docker yapılandırması sayesinde hem backend hem de frontend
servislerini derleyip çalıştırmak için şu komutu vermeniz yeterlidir:

```bash
docker-compose up --build
```

---

## Uçtan Uca Çalıştırma Sırası

1. `backend/models/Hazir_Model.pt` dosyasını yerleştirin.
2. Backend'i başlatın: `uvicorn app.main:app --port 8000`
3. `.env.local` içinde `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000` ayarlayın.

4. Paneli başlatın: `pnpm dev` → `http://localhost:3000`

