"""Reel (highlight compilation) data models"""

from pydantic import BaseModel, Field
from typing import List
from datetime import datetime


class ReelCreate(BaseModel):
    """Request to create a highlight reel from existing clips"""
    clip_ids: List[str] = Field(..., description="List of clip IDs to include in reel")

    class Config:
        json_schema_extra = {
            "example": {
                "clip_ids": ["clip_abc123", "clip_def456", "clip_ghi789"]
            }
        }


class Reel(BaseModel):
    """Reel metadata"""
    reel_id: str
    clip_ids: List[str]
    output_path: str
    filesize_bytes: int
    duration_s: float
    created_at: datetime = Field(default_factory=datetime.now)


class ReelResponse(BaseModel):
    """Response after creating a reel"""
    reel_id: str
    duration_s: float
    filesize_bytes: int
    num_clips: int
    download_url: str
    processing_time_ms: float

    class Config:
        json_schema_extra = {
            "example": {
                "reel_id": "reel_xyz789",
                "duration_s": 300.5,
                "filesize_bytes": 524288000,
                "num_clips": 10,
                "download_url": "/api/reel/reel_xyz789/download",
                "processing_time_ms": 8500
            }
        }
