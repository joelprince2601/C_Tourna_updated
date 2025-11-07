"""Simple session for tracking uploaded videos - minimal model"""

from pydantic import BaseModel
from typing import Dict


class CameraFiles(BaseModel):
    """Map camera IDs to temp file paths after upload"""
    C1: str
    C2: str
    C3: str
    C4: str
