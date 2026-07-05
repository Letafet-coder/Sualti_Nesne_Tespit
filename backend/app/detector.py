"""
YOLOv8 (Ultralytics) çıkarım sarmalayıcısı.
Modeli yükler, bir kare üzerinde tespit yapar ve sonuçları
Pydantic ile DOĞRULANMIŞ Detection nesnelerine dönüştürür.
"""
from __future__ import annotations

import os
import time
from datetime import datetime

import numpy as np

from . import config
from .schemas import BoundingBox, Detection, FrameResult


class Detector:
    def __init__(self) -> None:
        self.model = None
        # Başlangıçta config içindeki büyük harfli güvenli listeyi atıyoruz
        self.class_names = config.CLASS_NAMES
        self._load()

    def _load(self) -> None:
        """YOLO modelini yükler. Ultralytics kurulu değilse anlaşılır hata verir."""
        if not os.path.exists(config.MODEL_PATH):
            raise FileNotFoundError(
                f"Model dosyası bulunamadı: {config.MODEL_PATH}\n"
                f"Eğittiğiniz best.pt dosyasını buraya koyun veya MODEL_PATH "
                f"ortam değişkenini ayarlayın."
            )
        try:
            from ultralytics import YOLO  # gecikmeli import
        except ImportError as e:
            raise ImportError(
                "ultralytics kurulu değil. 'pip install -r requirements.txt' çalıştırın."
            ) from e

        self.model = YOLO(config.MODEL_PATH)
        
        # NOT: Modelin kendi içindeki küçük harfli (.names) sözlüğüyle config.CLASS_NAMES 
        # listesini ezmiyoruz. Böylece Pydantic büyük harf doğrulaması korunuyor.

    def predict(self, frame: np.ndarray, frame_id: int = 0) -> FrameResult:
        """Tek bir kare (BGR numpy dizisi) üzerinde tespit yapar."""
        h, w = frame.shape[:2]
        t0 = time.perf_counter()

        results = self.model.predict(
            source=frame,
            conf=config.CONFIDENCE_THRESHOLD,
            iou=config.IOU_THRESHOLD,
            verbose=False,
        )
        inference_ms = (time.perf_counter() - t0) * 1000.0

        detections: list[Detection] = []
        # results tek elemanlı liste döner (tek görüntü)
        for res in results:
            boxes = getattr(res, "boxes", None)
            if boxes is None:
                continue
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()
                
                
                # Modelin indeksine karşılık doğrudan config.py'deki büyük harfli ismi alıyoruz
                if 0 <= cls_id < len(config.CLASS_NAMES):
                    cls_name = config.CLASS_NAMES[cls_id]
                else:
                    # Eğer beklenmeyen bir indeks gelirse pydantic'in patlamaması için 
                    # modelin döndüğü ham ismin baş harflerini büyütüp atıyoruz.
                    names = getattr(self.model, "names", {})
                    raw_name = names.get(cls_id, str(cls_id))
                    cls_name = raw_name.strip().title()

                # Pydantic doğrulaması: geçersiz kutu/sınıf otomatik reddedilir
                try:
                    det = Detection(
                        class_id=cls_id,
                        class_name=cls_name, 
                        confidence=conf,
                        bbox=BoundingBox(
                            x1=xyxy[0], y1=xyxy[1], x2=xyxy[2], y2=xyxy[3]
                        ),
                    )
                    detections.append(det)
                except Exception as e:  
                    # Doğrulamayı geçemeyen tespit atlanır (loglanabilir)
                    print(f"[DOĞRULAMA] Tespit reddedildi: {e}")

        return FrameResult(
            frame_id=frame_id,
            timestamp=datetime.now(),
            width=w,
            height=h,
            inference_ms=round(inference_ms, 2),
            detections=detections,
        )