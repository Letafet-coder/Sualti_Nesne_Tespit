"""
Video akış yöneticisi.
Arka planda bir iş parçacığı (thread) video kaynağından kare okur,
YOLO ile çıkarım yapar, kutuları çizer (MJPEG için), tespitleri
SQLite'a kaydeder ve son sonucu WebSocket abonelerine yayınlamak
üzere saklar. Alarm mantığı da burada değerlendirilir.
"""
from __future__ import annotations

import asyncio
import os
import threading
import time
from typing import Optional

import cv2
import numpy as np

from . import config, database
from .detector import Detector
from .schemas import AlarmConfig, FrameResult

# Sınıf başına BGR renkler (kutu çizimi için)
_COLORS = [
    (255, 191, 0),   # Fish - cyan
    (0, 128, 255),   # Human Diver - turuncu
    (0, 255, 128),   # Robot - yeşil
    (255, 0, 191),   # Stingray - mor-pembe
    (0, 215, 255),   # Turtle - sarı
    (60, 60, 220),   # Wrecks - kırmızı
]


class StreamManager:
    def __init__(self) -> None:
        self.detector: Optional[Detector] = None
        self.capture: Optional[cv2.VideoCapture] = None
        self.video_writer: Optional[cv2.VideoWriter] = None

        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._paused = False
        self._frame_id = 0

        self._lock = threading.Lock()
        self._latest_jpeg: Optional[bytes] = None
        self._latest_result: Optional[FrameResult] = None

        self.model_ready = False
        self.model_error: Optional[str] = None

        # Alarm ayarı
        self.alarm = AlarmConfig(
            enabled=config.ALARM_ENABLED_DEFAULT,
            class_name=config.ALARM_CLASS_DEFAULT,
        )
        self.alarm_active = False

    # --- Yaşam döngüsü ---
    def start(self) -> None:
        if self._running:
            return
        
        # Modeli yüklemeyi dene (Eğer detector zaten yüklüyse tekrar yükleme)
        if not self.detector:
            try:
                self.detector = Detector()
                self.model_ready = True
            except Exception as e:  # noqa: BLE001
                self.model_error = str(e)
                self.model_ready = False
                print(f"[MODEL] Yüklenemedi: {e}")

        # Dinamik Kaynak Kontrolü: 
        src = os.environ.get("VIDEO_SOURCE", config.video_source_resolved())
        
        # Sayısal bir string gelirse (örneğin webcam '0') bunu int tipine çeviriyoruz
        if isinstance(src, str) and src.isdigit():
            src = int(src)
        
        # Eğer kaynak var ise, açmayı dene
        if src is not None and src != "":
           
            if isinstance(src, int):
                print(f"[VIDEO] Windows DirectShow ile Webcam ({src}) aciliyor...")
                self.capture = cv2.VideoCapture(src, cv2.CAP_DSHOW)
            else:
                print(f"[VIDEO] Video dosyasi aciliyor: {src}")
                self.capture = cv2.VideoCapture(src)

            if not self.capture.isOpened():
                print(f"[VIDEO] Kaynak acilamadi: {src}")
                self.capture = None
            else:
                print(f"[VIDEO] Kaynak basariyla acildi: {src}")
                
                # VideoWriter'ı hazırla - işlenen videoyu kaydet
                frame_width = int(self.capture.get(cv2.CAP_PROP_FRAME_WIDTH))
                frame_height = int(self.capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = self.capture.get(cv2.CAP_PROP_FPS)
                if fps == 0:
                    fps = config.INFERENCE_FPS
                
                output_path = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "processed_video.avi"
                )
                
                fourcc = cv2.VideoWriter_fourcc(*'MJPG')
                self.video_writer = cv2.VideoWriter(
                    output_path, fourcc, fps, (frame_width, frame_height)
                )
                
                if not self.video_writer.isOpened():
                    print(f"[VIDEO] VideoWriter acilamadi. Codec sorunu olabilir.")
                    self.video_writer = None
                else:
                    print(f"[VIDEO] Cikti videosunun kaydedilmesi: {output_path}")
        else:
            print(f"[VIDEO] Kaynak tanimli degil. Panel'den video yuklemeyi bekleniyor.")

        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Kilitlenmeleri önlemek için bayrağı indirip nesneleri temiz bir şekilde serbest bırakır."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=1.0)
            self._thread = None
        
        with self._lock:
            if self.capture:
                self.capture.release()
                self.capture = None
            if self.video_writer:
                self.video_writer.release()
                self.video_writer = None
        print("[STREAM] Akis basariyla durduruldu.")

    # --- Dinamik Kaynak Değiştirme Metodu ---
    def change_source(self, new_src: str) -> None:
        """Dışarıdan video yüklendiğinde veya webcam seçildiğinde akışı kesip yeni videoyu güvenle başlatır."""
        print(f"[STREAM] Kaynak degistiriliyor: {new_src}")
        self.stop()
        time.sleep(0.3)
        self.start()

    # --- Ana döngü ---
    def _loop(self) -> None:
        interval = 1.0 / max(1, config.INFERENCE_FPS)
        while self._running:
            t0 = time.time()
            if not self.capture or not self.capture.isOpened():
                time.sleep(0.1)
                continue

            ok, frame = self.capture.read()
            if not ok:
                # Eğer kaynak bir dosya yolu ise (string) döngüye sok, eğer webcam (int) ise loop'u beklet
                src = os.environ.get("VIDEO_SOURCE", config.video_source_resolved())
                if isinstance(src, str) or not str(src).isdigit():
                    if self.capture:
                        self.capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    time.sleep(0.05)
                    continue
                else:
                    time.sleep(0.2)
                    continue

            self._frame_id += 1

            if self._paused:
                time.sleep(0.1)
                continue

            if self.model_ready and self.detector:
                result = self.detector.predict(frame, self._frame_id)
                self._annotate(frame, result)
                database.insert_detections(result.timestamp, result.detections)
                self._evaluate_alarm(result)
                with self._lock:
                    self._latest_result = result
            
            if self.video_writer and self.video_writer.isOpened():
                self.video_writer.write(frame)
            
            ok2, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok2:
                with self._lock:
                    self._latest_jpeg = buf.tobytes()

            elapsed = time.time() - t0
            if elapsed < interval:
                time.sleep(interval - elapsed)

    def _annotate(self, frame: np.ndarray, result: FrameResult) -> None:
        for d in result.detections:
            color = _COLORS[d.class_id % len(_COLORS)]
            x1, y1, x2, y2 = (
                int(d.bbox.x1),
                int(d.bbox.y1),
                int(d.bbox.x2),
                int(d.bbox.y2),
            )
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label = f"{d.class_name} {d.confidence:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
            cv2.putText(
                frame,
                label,
                (x1 + 2, y1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                1,
                cv2.LINE_AA
              )

    def _evaluate_alarm(self, result: FrameResult) -> None:
        if not self.alarm.enabled:
            self.alarm_active = False
            return
        self.alarm_active = any(
            d.class_name == self.alarm.class_name for d in result.detections
        )

    # --- Dışa açık erişimciler ---
    def get_jpeg(self) -> Optional[bytes]:
        with self._lock:
            return self._latest_jpeg

    def get_latest_result(self) -> Optional[FrameResult]:
        with self._lock:
            return self._latest_result

    def set_alarm(self, cfg: AlarmConfig) -> None:
        self.alarm = cfg

    def set_paused(self, paused: bool) -> None:
        self._paused = paused
        print(f"[STREAM] {'PAUSE' if paused else 'RESUME'}")

    def status(self) -> dict:
        current_src = os.environ.get("VIDEO_SOURCE", str(config.VIDEO_SOURCE))
        return {
            "running": self._running,
            "model_ready": self.model_ready,
            "model_error": self.model_error,
            "video_opened": bool(self.capture and self.capture.isOpened()),
            "video_source": current_src,
            "inference_fps": config.INFERENCE_FPS,
            "alarm": self.alarm.model_dump(),
            "alarm_active": self.alarm_active,
            "classes": config.CLASS_NAMES,
        }


stream_manager = StreamManager()