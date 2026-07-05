"""
MAREN - Sualtı Nesne Tespiti API'si (FastAPI).
"""
from __future__ import annotations

import asyncio
import io
import json
import os
import shutil
from contextlib import asynccontextmanager
from typing import Optional

import pandas as pd
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fpdf import FPDF

from . import config, database
from .schemas import (
    AlarmConfig,
    HistoryResponse,
    StatsResponse,
    TimeSeriesResponse,
)
from .stream import stream_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    stream_manager.start()
    yield
    stream_manager.stop()


app = FastAPI(
    title="MAREN Sualtı Nesne Tespiti API",
    version="1.0.0",
    lifespan=lifespan,
)

# --- CORS AYARI GÜÇLENDİRİLDİ ---
# config.CORS_ORIGINS listesine ek olarak localhost:3000 tarayıcı izinlerine kesin olarak eklendi.
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if hasattr(config, "CORS_ORIGINS"):
    if isinstance(config.CORS_ORIGINS, list):
        allowed_origins.extend(config.CORS_ORIGINS)
    elif isinstance(config.CORS_ORIGINS, str):
        allowed_origins.append(config.CORS_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(set(allowed_origins)), # Tekrarlayan verileri temizle
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"], # Tarayıcının dosya adını okuyabilmesi için
)


@app.get("/")
async def root():
    return {"service": "MAREN", "status": "ok"}


@app.get("/status")
async def status():
    return stream_manager.status()


# --- Canlı video (MJPEG) ---
async def _mjpeg_generator():
    boundary = b"--frame"
    while True:
        jpeg = stream_manager.get_jpeg()
        if jpeg is not None:
            yield (
                boundary
                + b"\r\nContent-Type: image/jpeg\r\nContent-Length: "
                + str(len(jpeg)).encode()
                + b"\r\n\r\n"
                + jpeg
                + b"\r\n"
            )
        await asyncio.sleep(1.0 / max(1, config.INFERENCE_FPS))


@app.get("/video")
async def video():
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# --- Son kare (JSON) ---
@app.get("/latest")
async def latest():
    result = stream_manager.get_latest_result()
    if result is None:
        return {"detections": [], "message": "Henüz tespit yok"}
    return json.loads(result.model_dump_json())


# --- WebSocket canlı akış ---
@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    last_frame_id = -1
    try:
        while True:
            result = stream_manager.get_latest_result()
            if result is not None and result.frame_id != last_frame_id:
                last_frame_id = result.frame_id
                payload = json.loads(result.model_dump_json())
                payload["alarm_active"] = stream_manager.alarm_active
                await websocket.send_json(payload)
            await asyncio.sleep(1.0 / max(1, config.INFERENCE_FPS))
    except WebSocketDisconnect:
        return
    except Exception:
        return


# --- Geçmiş (history) ---
@app.get("/history", response_model=HistoryResponse)
async def history(
    class_name: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None, ge=0, le=1),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    total, records = database.query_history(
        class_name=class_name,
        start=start,
        end=end,
        min_confidence=min_confidence,
        limit=limit,
        offset=offset,
    )
    return HistoryResponse(total=total, records=records)


# --- EXCEL AKTAR ---
@app.get("/history/export/excel")
async def history_export_excel(
    class_name: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None, ge=0, le=1),
):
    _, records = database.query_history(
        class_name=class_name, start=start, end=end, min_confidence=min_confidence, limit=50000, offset=0
    )

    data = [{
        "ID": r.id,
        "Zaman": r.timestamp.strftime('%Y-%m-%d %H:%M:%S') if hasattr(r.timestamp, 'strftime') else str(r.timestamp),
        "Sınıf Adı": r.class_name,
        "Güven Skoru (%)": round(r.confidence * 100, 2),
        "Koordinatlar (x1,y1,x2,y2)": f"{int(r.x1)}, {int(r.y1)}, {int(r.x2)}, {int(r.y2)}"
    } for r in records]

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="Tespit Verileri")
    output.seek(0)

    return StreamingResponse(
        output,
        headers={"Content-Disposition": "attachment; filename=maren_tespit_gecmisi.xlsx"},
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# --- WINDOWS UYUMLU PDF AKTAR ---
@app.get("/history/export/pdf")
async def history_export_pdf(
    class_name: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None, ge=0, le=1),
):
    _, records = database.query_history(
        class_name=class_name, start=start, end=end, min_confidence=min_confidence, limit=1000, offset=0
    )

    pdf = FPDF()
    pdf.add_page()
    
    # Başlık Alanı
    pdf.set_fill_color(11, 26, 36)
    pdf.rect(0, 0, 210, 40, "F")
    pdf.set_text_color(0, 180, 216)
    pdf.set_font("Arial", "B", 18)
    pdf.text(12, 25, "MAREN Sualti Nesne Tespiti Gecmis Raporu")
    
    # Tablo Başlıkları
    pdf.set_y(50)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Arial", "B", 10)
    
    pdf.cell(50, 8, "Zaman", border=1, align="L")
    pdf.cell(40, 8, "Sinif Adi", border=1, align="L")
    pdf.cell(30, 8, "Guven Skoru", border=1, align="C")
    pdf.cell(60, 8, "Kutu Koordinatlari", border=1, align="L")
    pdf.ln()

    # Tablo Satırları
    pdf.set_font("Arial", "", 9)
    for r in records:
        ts = r.timestamp.strftime('%Y-%m-%d %H:%M:%S') if hasattr(r.timestamp, 'strftime') else str(r.timestamp)
        conf_str = f"%{int(r.confidence * 100)}"
        bbox_str = f"{int(r.x1)}, {int(r.y1)}, {int(r.x2)}, {int(r.y2)}"
        
        pdf.cell(50, 7, ts, border=1)
        pdf.cell(40, 7, str(r.class_name), border=1)
        pdf.cell(30, 7, conf_str, border=1, align="C")
        pdf.cell(60, 7, bbox_str, border=1)
        pdf.ln()

    pdf_output = io.BytesIO()
    pdf_output.write(pdf.output())
    pdf_output.seek(0)

    return StreamingResponse(
        pdf_output,
        headers={"Content-Disposition": "attachment; filename=maren_raporu.pdf"},
        media_type="application/pdf"
    )


# --- İstatistikler ---
@app.get("/stats", response_model=StatsResponse)
async def stats():
    return database.query_stats()


# --- Zaman serisi ---
@app.get("/timeseries", response_model=TimeSeriesResponse)
async def timeseries(
    interval_seconds: int = Query(60, ge=1, le=3600),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
):
    points = database.query_timeseries(
        interval_seconds=interval_seconds, start=start, end=end
    )
    return TimeSeriesResponse(interval_seconds=interval_seconds, points=points)


# --- Alarm ayarı ---
@app.post("/alarm")
async def set_alarm(cfg: AlarmConfig):
    stream_manager.set_alarm(cfg)
    return {"ok": True, "alarm": cfg.model_dump()}


# --- Pause/Resume ---
@app.post("/pause/{paused}")
async def set_pause(paused: bool):
    stream_manager.set_paused(paused)
    return {"ok": True, "paused": paused}


@app.post("/set-video-source/{source_type}")
async def set_video_source(source_type: str):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    video_path = os.path.join(base_dir, "uploaded_video.mp4")
    
    if source_type == "webcam":
        os.environ["VIDEO_SOURCE"] = "0"
        config.VIDEO_SOURCE = "0"
    elif source_type == "video":
        if not os.path.exists(video_path):
            return {"ok": False, "error": "Henüz yüklenmiş bir video dosyası bulunamadı."}
        os.environ["VIDEO_SOURCE"] = video_path
        config.VIDEO_SOURCE = video_path
    else:
        return {"ok": False, "error": "Geçersiz kaynak tipi."}
        
    stream_manager.stop()
    await asyncio.sleep(0.5)
    stream_manager.start()
    
    return {"ok": True, "source": config.VIDEO_SOURCE}


# --- Dinamik Video Yükleme Alanı ---
@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    video_path = os.path.join(base_dir, "uploaded_video.mp4")
    processed_path = os.path.join(base_dir, "processed_video.avi")
    
    if os.path.exists(processed_path):
        try:
            os.remove(processed_path)
            print(f"[UPLOAD] Eski processed_video.avi silindi")
        except Exception as e:
            print(f"[UPLOAD] Silme hatası: {e}")
    
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    os.environ["VIDEO_SOURCE"] = video_path
    
    stream_manager.stop()
    await asyncio.sleep(0.5)
    stream_manager.start()
        
    return {"ok": True, "filename": file.filename, "saved_path": video_path}


# --- HTTP HATA YÖNETİMİ EKLENMİŞ VİDEO İNDİRME ENDPOINT'İ ---
@app.get("/download-video")
async def download_video():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    video_path = os.path.join(base_dir, "processed_video.avi")
    
    # Dosya yoksa tarayıcının patlamaması için kontrollü HTTP 404 fırlatıyoruz
    if not os.path.exists(video_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Islenen video dosyasi henuz olusturulmamis"
        )
    
    return FileResponse(
        path=video_path,
        filename="processed_video.avi",
        media_type="video/x-msvideo"
    )