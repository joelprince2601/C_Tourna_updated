"""
Clip creation service - builds clips from camera segments.
"""

import os
import uuid
import json
import time
from typing import List, Dict, Optional
from pathlib import Path
import logging

from models.clip import ClipSegment, Clip
from services.ffmpeg_service import FFmpegService, FFmpegResult

logger = logging.getLogger(__name__)


class ClipService:
    """Service for creating video clips from camera segments"""

    def __init__(self, output_dir: str, ffmpeg_service: FFmpegService):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ffmpeg = ffmpeg_service
        self.clips_db = {}  # Simple in-memory storage: clip_id -> Clip

    def create_clip(
        self,
        segments: List[ClipSegment],
        camera_files: Dict[str, str],  # {camera_id: file_path}
        scoreboard: Optional[Dict] = None  # {teamAName, teamBName, scoreA, scoreB}
    ) -> Clip:
        """
        Create a clip from a list of camera segments.

        Args:
            segments: List of segments (camera_id, start_s, end_s)
            camera_files: Mapping of camera IDs to their file paths

        Returns:
            Clip object with metadata

        Raises:
            ValueError: If segments are invalid
            RuntimeError: If FFmpeg operation fails
        """
        if not segments:
            raise ValueError("No segments provided")

        # Validate all camera IDs exist in camera_files
        for seg in segments:
            if seg.camera_id not in camera_files:
                raise ValueError(f"Camera {seg.camera_id} not found in provided files")
            if seg.end_s <= seg.start_s:
                raise ValueError(f"Invalid segment: end_s ({seg.end_s}) must be > start_s ({seg.start_s})")

        # Generate clip ID and output path
        clip_id = f"clip_{uuid.uuid4().hex[:12]}"
        output_path = self.output_dir / f"{clip_id}.mp4"

        logger.info(f"Creating clip {clip_id} with {len(segments)} segments")

        # Convert segments to FFmpeg format
        ffmpeg_segments = []
        total_duration = 0.0
        for seg in segments:
            camera_path = camera_files[seg.camera_id]
            ffmpeg_segments.append({
                "path": camera_path,
                "start_s": seg.start_s,
                "end_s": seg.end_s
            })
            total_duration += (seg.end_s - seg.start_s)
            logger.info(f"  Segment: {seg.camera_id} {seg.start_s:.2f}s-{seg.end_s:.2f}s ({seg.end_s-seg.start_s:.2f}s)")

        # Build the clip using FFmpeg
        start_time = time.time()
        
        # First, extract and concat segments
        temp_output = self.output_dir / f"temp_{clip_id}.mp4"
        result = self.ffmpeg.extract_and_concat(
            segments=ffmpeg_segments,
            output_path=str(temp_output)
        )

        if not result.success:
            raise RuntimeError(f"Failed to create clip: {result.stderr}")
        
        # If scoreboard is provided, add overlay with score update at goal time
        if scoreboard:
            # Get score before and after this clip
            score_before = scoreboard.get('scoreBefore', {})
            score_after = scoreboard.get('scoreAfter', scoreboard)
            
            # Get goal time (when score updates) - use provided goalTime or default to midpoint
            goal_time = scoreboard.get('goalTime', total_duration / 2.0)
            # Ensure goal_time is within clip bounds
            goal_time = max(0.0, min(total_duration, goal_time))
            
            # Get team names and scores
            team_a_name_before = score_before.get('teamAName', 'Team A') if score_before else scoreboard.get('teamAName', 'Team A')
            team_b_name_before = score_before.get('teamBName', 'Team B') if score_before else scoreboard.get('teamBName', 'Team B')
            score_a_before = score_before.get('scoreA', 0) if score_before else scoreboard.get('scoreA', 0)
            score_b_before = score_before.get('scoreB', 0) if score_before else scoreboard.get('scoreB', 0)
            
            team_a_name_after = score_after.get('teamAName', 'Team A')
            team_b_name_after = score_after.get('teamBName', 'Team B')
            score_a_after = score_after.get('scoreA', 0)
            score_b_after = score_after.get('scoreB', 0)
            
            # Escape text helper
            def escape_text(t):
                return t.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("[", "\\[").replace("]", "\\]")
            
            # Compact scoreboard in top-left corner with improved typography
            filter_parts = []
            pos = "x=15:y=15"
            
            # First part (0 to goal_time) - Score before
            text_before = f"{team_a_name_before} {score_a_before} - {score_b_before} {team_b_name_before}"
            text_before_escaped = escape_text(text_before)
            
            # Compact overlay with bold, aesthetic font styling
            # Using valid FFmpeg drawtext parameters only
            filter_parts.append(
                f"drawtext=text='{text_before_escaped}':"
                f"fontsize=36:"
                f"fontcolor=white:"
                f"box=1:boxcolor=black@0.75:boxborderw=8:"
                f"borderw=4:bordercolor=black@0.95:"
                f"{pos}:enable='lte(t,{goal_time})'"
            )
            
            # Second part (goal_time to end) - Score after
            text_after = f"{team_a_name_after} {score_a_after} - {score_b_after} {team_b_name_after}"
            text_after_escaped = escape_text(text_after)
            
            filter_parts.append(
                f"drawtext=text='{text_after_escaped}':"
                f"fontsize=36:"
                f"fontcolor=white:"
                f"box=1:boxcolor=black@0.75:boxborderw=8:"
                f"borderw=4:bordercolor=black@0.95:"
                f"{pos}:enable='gte(t,{goal_time})'"
            )
            
            filter_complex = ",".join(filter_parts)
            
            cmd = [
                self.ffmpeg.ffmpeg_bin,
                "-i", str(temp_output),
                "-vf", filter_complex,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "copy",
                "-y",
                str(output_path)
            ]
            
            import subprocess
            
            start_overlay_time = time.time()
            result_overlay = subprocess.run(cmd, capture_output=True, text=True)
            overlay_duration_ms = (time.time() - start_overlay_time) * 1000
            
            success = result_overlay.returncode == 0
            filesize = 0
            throughput = 0.0
            if success and os.path.exists(output_path):
                filesize = os.path.getsize(output_path)
                if overlay_duration_ms > 0:
                    throughput = (filesize * 8 / 1_000_000) / (overlay_duration_ms / 1000)
            
            overlay_result = FFmpegResult(
                success=success,
                output_path=str(output_path) if success else None,
                duration_ms=overlay_duration_ms,
                command=" ".join(cmd),
                exit_code=result_overlay.returncode,
                stderr=result_overlay.stderr,
                filesize_bytes=filesize,
                throughput_mbps=throughput
            )
            
            # Cleanup temp file
            if os.path.exists(temp_output):
                try:
                    os.unlink(temp_output)
                except:
                    pass
            
            if not overlay_result.success:
                raise RuntimeError(f"Failed to add scoreboard overlay: {overlay_result.stderr}")
            
            # Update result with overlay file size
            result = overlay_result
        else:
            # No overlay, just move temp file to final output
            if os.path.exists(temp_output):
                import shutil
                shutil.move(str(temp_output), str(output_path))

        processing_time_ms = (time.time() - start_time) * 1000

        # Create clip object
        clip = Clip(
            clip_id=clip_id,
            segments=segments,
            output_path=str(output_path),
            filesize_bytes=result.filesize_bytes,
            duration_s=total_duration
        )

        # Store in memory
        self.clips_db[clip_id] = clip

        logger.info(f"Clip {clip_id} created successfully: "
                   f"duration={total_duration:.2f}s, "
                   f"size={result.filesize_bytes:,} bytes, "
                   f"processing_time={processing_time_ms:.0f}ms")

        return clip

    def get_clip(self, clip_id: str) -> Clip:
        """Retrieve clip by ID"""
        if clip_id not in self.clips_db:
            raise KeyError(f"Clip {clip_id} not found")
        return self.clips_db[clip_id]

    def get_clip_path(self, clip_id: str) -> str:
        """Get file path for a clip"""
        clip = self.get_clip(clip_id)
        return clip.output_path

    def delete_clip(self, clip_id: str):
        """Delete a clip and its file"""
        clip = self.get_clip(clip_id)

        # Delete file
        if os.path.exists(clip.output_path):
            os.unlink(clip.output_path)
            logger.info(f"Deleted clip file: {clip.output_path}")

        # Remove from memory
        del self.clips_db[clip_id]
        logger.info(f"Deleted clip: {clip_id}")

    def list_clips(self) -> List[Clip]:
        """List all clips"""
        return list(self.clips_db.values())

    def save_metadata(self, metadata_path: str):
        """Save clip metadata to JSON file"""
        data = {
            clip_id: {
                "clip_id": clip.clip_id,
                "segments": [seg.dict() for seg in clip.segments],
                "output_path": clip.output_path,
                "filesize_bytes": clip.filesize_bytes,
                "duration_s": clip.duration_s,
                "created_at": clip.created_at.isoformat()
            }
            for clip_id, clip in self.clips_db.items()
        }

        with open(metadata_path, 'w') as f:
            json.dump(data, f, indent=2)

        logger.info(f"Saved metadata for {len(data)} clips to {metadata_path}")

    def load_metadata(self, metadata_path: str):
        """Load clip metadata from JSON file"""
        if not os.path.exists(metadata_path):
            logger.warning(f"Metadata file not found: {metadata_path}")
            return

        with open(metadata_path, 'r') as f:
            data = json.load(f)

        for clip_id, clip_data in data.items():
            clip = Clip(**clip_data)
            self.clips_db[clip_id] = clip

        logger.info(f"Loaded metadata for {len(data)} clips from {metadata_path}")
