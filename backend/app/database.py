"""
SQLite veritabanı katmanı.
Nesne tespiti logları burada saklanır ve /history, /stats, /timeseries için sorgulanır.
"""
from __future__ import annotations

import sqlite3
import threading
from datetime import datetime
from typing import Optional

from .config import DB_PATH
from .schemas import (
    Detection,
    HistoryRecord,
    StatsResponse,
    TimeSeriesPoint,
)

# SQLite, varsayılan olarak birden fazla thread'in aynı anda yazma işlemi yapmasına izin vermez.
# Veri bütünlüğünü korumak ve 'database is locked' hatalarını önlemek için tek bir yazıcı (thread) kilidi tanımlıyoruz.
_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Tablo ve indeksleri oluşturur."""
    with _lock, _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS detections (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   TEXT    NOT NULL,
                class_id    INTEGER NOT NULL,
                class_name  TEXT    NOT NULL,
                confidence  REAL    NOT NULL,
                x1          REAL    NOT NULL,
                y1          REAL    NOT NULL,
                x2          REAL    NOT NULL,
                y2          REAL    NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_timestamp ON detections(timestamp)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_class ON detections(class_name)"
        )
        conn.commit()


def insert_detections(timestamp: datetime, detections: list[Detection]) -> None:
    """Bir karedeki tüm tespitleri toplu olarak kaydeder."""
    if not detections:
        return
    # SQLite'ta tarihleri TEXT (ISO 8601 formatında) olarak saklıyoruz (örn: '2026-07-05T16:20:00')
    ts = timestamp.isoformat()
    rows = [
        (
            ts,
            d.class_id,
            d.class_name,
            d.confidence,
            d.bbox.x1,
            d.bbox.y1,
            d.bbox.x2,
            d.bbox.y2,
        )
        for d in detections
    ]
    with _lock, _connect() as conn:
        conn.executemany(
            """
            INSERT INTO detections
                (timestamp, class_id, class_name, confidence, x1, y1, x2, y2)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()


def query_history(
    class_name: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    min_confidence: Optional[float] = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[int, list[HistoryRecord]]:
    """Filtreli log sorgusu; toplam sayı ve kayıt listesini döndürür."""
    where = []
    params: list = []
    if class_name:
        where.append("class_name = ?")
        params.append(class_name)
    if start:
        where.append("timestamp >= ?")
        params.append(start)
    if end:
        where.append("timestamp <= ?")
        params.append(end)
    if min_confidence is not None:
        where.append("confidence >= ?")
        params.append(min_confidence)

    clause = f"WHERE {' AND '.join(where)}" if where else ""

    with _lock, _connect() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) AS c FROM detections {clause}", params
        ).fetchone()["c"]

        rows = conn.execute(
            f"""
            SELECT * FROM detections
            {clause}
            ORDER BY timestamp DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()

    records = [
        HistoryRecord(
            id=r["id"],
            timestamp=datetime.fromisoformat(r["timestamp"]),
            class_id=r["class_id"],
            class_name=r["class_name"],
            confidence=r["confidence"],
            x1=r["x1"],
            y1=r["y1"],
            x2=r["x2"],
            y2=r["y2"],
        )
        for r in rows
    ]
    return total, records


def query_stats() -> StatsResponse:
    """Özet istatistikleri döndürür."""
    with _lock, _connect() as conn:
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM detections"
        ).fetchone()["c"]

        per_class_rows = conn.execute(
            "SELECT class_name, COUNT(*) AS c FROM detections GROUP BY class_name"
        ).fetchall()

        bounds = conn.execute(
            "SELECT MIN(timestamp) AS first, MAX(timestamp) AS last FROM detections"
        ).fetchone()

    per_class = {r["class_name"]: r["c"] for r in per_class_rows}
    first = (
        datetime.fromisoformat(bounds["first"]) if bounds["first"] else None
    )
    last = datetime.fromisoformat(bounds["last"]) if bounds["last"] else None

    return StatsResponse(
        total_detections=total,
        per_class=per_class,
        first_seen=first,
        last_seen=last,
    )


def query_timeseries(
    interval_seconds: int = 60,
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> list[TimeSeriesPoint]:
    """
    Tespitleri zaman kovalarına (bucket) gruplandırıp sınıf bazında sayar
    ve ortalama güven skorlarını hesaplar.
    """
    where = []
    params: list = []
    if start:
        where.append("timestamp >= ?")
        params.append(start)
    if end:
        where.append("timestamp <= ?")
        params.append(end)
    clause = f"WHERE {' AND '.join(where)}" if where else ""

    # SQL Sorgusuna AVG(confidence) eklendi
    with _lock, _connect() as conn:
        rows = conn.execute(
            f"""
            SELECT
                CAST(strftime('%s', timestamp) AS INTEGER) / ? * ? AS bucket_epoch,
                class_name,
                COUNT(*) AS c,
                AVG(confidence) AS avg_conf
            FROM detections
            {clause}
            GROUP BY bucket_epoch, class_name
            ORDER BY bucket_epoch ASC
            """,
            [interval_seconds, interval_seconds, *params],
        ).fetchall()

    # bucket_epoch -> { "counts": {...}, "confidence": {...} }
    buckets: dict[int, dict[str, any]] = {}
    for r in rows:
        b = int(r["bucket_epoch"])
        buckets.setdefault(b, {"counts": {}, "confidence": {}})
        
        # Sayıları ve ortalama güven skorlarını yerleştiriyoruz
        buckets[b]["counts"][r["class_name"]] = r["c"]
        buckets[b]["confidence"][r["class_name"]] = round(r["avg_conf"], 4) 

    points: list[TimeSeriesPoint] = []
    for epoch in sorted(buckets.keys()):
        counts = buckets[epoch]["counts"]
        confidence = buckets[epoch]["confidence"]
        
        points.append(
            TimeSeriesPoint(
                bucket=datetime.fromtimestamp(epoch).isoformat(),
                counts=counts,
                confidence=confidence,  
                total=sum(counts.values()),
            )
        )
    return points
