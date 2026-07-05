"""
Uygulama yapılandırması.
Tüm ayarlar ortam değişkenleri (.env) ile değiştirilebilir.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# --- Model ---
# Eğitilmiş YOLO ağırlık dosyasının yolu. 
MODEL_PATH: str = os.getenv("MODEL_PATH", "C:\\Users\\HP\\Desktop\\underwater-project\\backend\\models\\Hazir_Model.pt")

# Tespit güven eşiği (0-1 arası) Değiştirilebilir.
CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.35"))

# IOU (NMS) eşiği. Değiştirilebilir.
IOU_THRESHOLD: float = float(os.getenv("IOU_THRESHOLD", "0.45"))

# --- Sınıflar ---
# Modelin eğitildiği 7 sınıf. 
CLASS_NAMES: list[str] = [
    "fish",
    "jellyfish",
    "penguin",
    "puffin",
    "shark",
    "starfish",
    "stingray"
]

# --- Video kaynağı ---
# "0" -> USB webcam (varsayılan). Bir dosya yolu verilirse (ör. sample.mp4) o oynatılır.
VIDEO_SOURCE: str = os.getenv("VIDEO_SOURCE", "0")

# Çıkarım yapılacak kare hızı 
INFERENCE_FPS: int = int(os.getenv("INFERENCE_FPS", "10"))

# --- Veritabanı ---
DB_PATH: str = os.getenv("DB_PATH", "detections.db")

# --- Uyarı (alarm) ---
# Varsayılan olarak alarm kapalıdır; panelden açılabilir ve sınıf seçilebilir.
ALARM_ENABLED_DEFAULT: bool = os.getenv("ALARM_ENABLED", "false").lower() == "true"


ALARM_CLASS_DEFAULT: str = os.getenv("ALARM_CLASS", "shark")

# --- CORS ---
# Panel (frontend) origin'i. Geliştirmede tüm origin'lere izin verilir.
CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")


def video_source_resolved():
    """VIDEO_SOURCE '0' gibi sayısal ise int, değilse string (dosya yolu) döndürür."""
    if VIDEO_SOURCE.isdigit():
        return int(VIDEO_SOURCE)
    return VIDEO_SOURCE
