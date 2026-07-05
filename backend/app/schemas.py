"""
Pydantic modelleri.
YOLO çıktılarının JSON olarak doğrulanmasını (validation) burada yapıyoruz.
Her tespit; sınıf, güven skoru ve sınırlayıcı kutu (bbox) içerir.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .config import CLASS_NAMES  # Burası dinamik olarak bizim 7 sınıfı çekecek


class BoundingBox(BaseModel):
    """Normalize edilmemiş piksel koordinatları (x1,y1) sol-üst, (x2,y2) sağ-alt."""

    x1: float = Field(..., ge=0, description="Sol üst X")
    y1: float = Field(..., ge=0, description="Sol üst Y")
    x2: float = Field(..., ge=0, description="Sağ alt X")
    y2: float = Field(..., ge=0, description="Sağ alt Y")

    @field_validator("x2")
    @classmethod
    def x2_gt_x1(cls, v, info):
        if "x1" in info.data and v < info.data["x1"]:
            raise ValueError("x2, x1'den küçük olamaz")
        return v

    @field_validator("y2")
    @classmethod
    def y2_gt_y1(cls, v, info):
        if "y1" in info.data and v < info.data["y1"]:
            raise ValueError("y2, y1'den küçük olamaz")
        return v


class Detection(BaseModel):
    """Doğrulanmış tek bir nesne tespiti."""

    class_id: int = Field(..., ge=0, description="Model sınıf indeksi")
    class_name: str = Field(..., description="Sınıf adı")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Güven skoru 0-1")
    bbox: BoundingBox

    @field_validator("class_name")
    @classmethod
    def class_name_valid(cls, v):
        # Eğer config.py'deki CLASS_NAMES güncellendiyse burası otomatik düzelir
        if v not in CLASS_NAMES:
            raise ValueError(f"Bilinmeyen sınıf: {v}. Geçerli sınıflar: {CLASS_NAMES}")
        return v


class FrameResult(BaseModel):
    """Tek bir karenin (frame) tam tespit sonucu."""

    frame_id: int
    timestamp: datetime
    width: int
    height: int
    inference_ms: float = Field(..., description="Çıkarım süresi (ms)")
    detections: List[Detection]


class HistoryRecord(BaseModel):
    """SQLite'tan dönen tek bir log kaydı."""

    id: int
    timestamp: datetime
    class_id: int
    class_name: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float


class HistoryResponse(BaseModel):
    """/history endpoint yanıtı."""

    total: int
    records: List[HistoryRecord]


class TimeSeriesPoint(BaseModel):
    """Zaman serisi grafiği için tek bir kova (bucket)."""

    bucket: str = Field(..., description="ISO zaman dilimi başlangıcı")
    counts: dict[str, int] = Field(..., description="Sınıf -> adet")
    confidence: dict[str, float] = Field(..., description="Sınıf -> ortalama güven skoru") 
    total: int

class TimeSeriesResponse(BaseModel):
    interval_seconds: int
    points: List[TimeSeriesPoint]


class StatsResponse(BaseModel):
    """Özet istatistikler."""

    total_detections: int
    per_class: dict[str, int]
    first_seen: Optional[datetime]
    last_seen: Optional[datetime]


class AlarmConfig(BaseModel):
    """Panelden gelen alarm ayarı."""

    enabled: bool
    class_name: str

    @field_validator("class_name")
    @classmethod
    def valid_class(cls, v):
        if v == "Human Diver":
            return "shark"
            
        if v not in CLASS_NAMES:
            raise ValueError(f"Bilinmeyen sınıf: {v}")
        return v