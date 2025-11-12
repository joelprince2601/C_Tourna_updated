"""
Reel creation service - builds highlight reels from clips.
"""

import os
import uuid
import json
import time
from typing import List
from pathlib import Path
import logging

from models.reel import Reel
from services.ffmpeg_service import FFmpegService
from services.clip_service import ClipService

logger = logging.getLogger(__name__)


class ReelService:
    """Service for creating highlight reels from clips"""

    def __init__(self, output_dir: str, ffmpeg_service: FFmpegService, clip_service: ClipService):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ffmpeg = ffmpeg_service
        self.clip_service = clip_service
        self.reels_db = {}  # Simple in-memory storage: reel_id -> Reel

    def create_reel(self, clip_ids: List[str]) -> Reel:
        """
        Create a highlight reel from a list of clips.

        Args:
            clip_ids: List of clip IDs to include in the reel

        Returns:
            Reel object with metadata

        Raises:
            ValueError: If clip_ids are invalid
            RuntimeError: If FFmpeg operation fails
        """
        if not clip_ids:
            raise ValueError("No clips provided")

        # Validate all clips exist and are valid
        clip_paths = []
        total_duration = 0.0
        for i, clip_id in enumerate(clip_ids):
            try:
                clip = self.clip_service.get_clip(clip_id)
                
                # Validate clip file exists and is not empty
                if not os.path.exists(clip.output_path):
                    raise ValueError(f"Clip {clip_id} file not found: {clip.output_path}")
                
                clip_filesize = os.path.getsize(clip.output_path)
                if clip_filesize == 0:
                    raise ValueError(f"Clip {clip_id} file is empty: {clip.output_path}")
                
                if clip.duration_s <= 0:
                    raise ValueError(f"Clip {clip_id} has invalid duration: {clip.duration_s}s")
                
                clip_paths.append(clip.output_path)
                total_duration += clip.duration_s
                logger.info(f"  Validated clip {i+1}/{len(clip_ids)} ({clip_id}): "
                           f"{clip.duration_s:.2f}s, {clip_filesize:,} bytes")
            except KeyError:
                raise ValueError(f"Clip {clip_id} not found")

        # Generate reel ID and output path
        reel_id = f"reel_{uuid.uuid4().hex[:12]}"
        output_path = self.output_dir / f"{reel_id}.mp4"

        logger.info(f"Creating reel {reel_id} from {len(clip_ids)} clips, "
                   f"total duration={total_duration:.2f}s")

        # Concatenate clips using FFmpeg
        logger.info(f"Starting concatenation of {len(clip_paths)} clips...")
        start_time = time.time()
        result = self.ffmpeg.concat_segments(
            segment_paths=clip_paths,
            output_path=str(output_path)
        )

        if not result.success:
            raise RuntimeError(f"Failed to create reel: {result.stderr}")

        # Validate final output file
        if not os.path.exists(str(output_path)):
            raise RuntimeError(f"Reel file was not created: {output_path}")
        
        final_filesize = os.path.getsize(str(output_path))
        if final_filesize == 0:
            raise RuntimeError(f"Reel file was created but is empty: {output_path}")
        
        processing_time_ms = (time.time() - start_time) * 1000
        
        logger.info(f"Reel concatenation successful: {final_filesize:,} bytes")

        # Create reel object
        reel = Reel(
            reel_id=reel_id,
            clip_ids=clip_ids,
            output_path=str(output_path),
            filesize_bytes=result.filesize_bytes,
            duration_s=total_duration
        )

        # Store in memory
        self.reels_db[reel_id] = reel

        logger.info(f"Reel {reel_id} created successfully: "
                   f"clips={len(clip_ids)}, "
                   f"duration={total_duration:.2f}s, "
                   f"size={result.filesize_bytes:,} bytes, "
                   f"processing_time={processing_time_ms:.0f}ms")

        return reel

    def get_reel(self, reel_id: str) -> Reel:
        """Retrieve reel by ID"""
        if reel_id not in self.reels_db:
            raise KeyError(f"Reel {reel_id} not found")
        return self.reels_db[reel_id]

    def get_reel_path(self, reel_id: str) -> str:
        """Get file path for a reel"""
        reel = self.get_reel(reel_id)
        return reel.output_path

    def delete_reel(self, reel_id: str):
        """Delete a reel and its file"""
        reel = self.get_reel(reel_id)

        # Delete file
        if os.path.exists(reel.output_path):
            os.unlink(reel.output_path)
            logger.info(f"Deleted reel file: {reel.output_path}")

        # Remove from memory
        del self.reels_db[reel_id]
        logger.info(f"Deleted reel: {reel_id}")

    def list_reels(self) -> List[Reel]:
        """List all reels"""
        return list(self.reels_db.values())

    def save_metadata(self, metadata_path: str):
        """Save reel metadata to JSON file"""
        data = {
            reel_id: {
                "reel_id": reel.reel_id,
                "clip_ids": reel.clip_ids,
                "output_path": reel.output_path,
                "filesize_bytes": reel.filesize_bytes,
                "duration_s": reel.duration_s,
                "created_at": reel.created_at.isoformat()
            }
            for reel_id, reel in self.reels_db.items()
        }

        with open(metadata_path, 'w') as f:
            json.dump(data, f, indent=2)

        logger.info(f"Saved metadata for {len(data)} reels to {metadata_path}")

    def load_metadata(self, metadata_path: str):
        """Load reel metadata from JSON file"""
        if not os.path.exists(metadata_path):
            logger.warning(f"Metadata file not found: {metadata_path}")
            return

        with open(metadata_path, 'r') as f:
            data = json.load(f)

        for reel_id, reel_data in data.items():
            reel = Reel(**reel_data)
            self.reels_db[reel_id] = reel

        logger.info(f"Loaded metadata for {len(data)} reels from {metadata_path}")
