"""Clip data models - simplified for frontend-driven flow"""

from pydantic import BaseModel, Field
from typing import List
from datetime import datetime


class ClipSegment(BaseModel):
    """A segment within a clip - one camera view with start/end times"""
    camera_id: str = Field(..., description="Camera identifier: C1, C2, C3, or C4")
    start_s: float = Field(..., description="Start time in seconds", ge=0)
    end_s: float = Field(..., description="End time in seconds", gt=0)

    class Config:
        json_schema_extra = {
            "example": {
                "camera_id": "C1",
                "start_s": 10.5,
                "end_s": 15.2
            }
        }


class Clip(BaseModel):
    """Clip metadata"""
    clip_id: str
    segments: List[ClipSegment]
    output_path: str
    filesize_bytes: int
    duration_s: float
    created_at: datetime = Field(default_factory=datetime.now)


class ClipResponse(BaseModel):
    """Response after creating a clip"""
    clip_id: str
    duration_s: float
    filesize_bytes: int
    download_url: str
    processing_time_ms: float

    class Config:
        json_schema_extra = {
            "example": {
                "clip_id": "clip_abc123",
                "duration_s": 15.3,
                "filesize_bytes": 52428800,
                "download_url": "/api/clip/clip_abc123/download",
                "processing_time_ms": 1250
            }
        }
