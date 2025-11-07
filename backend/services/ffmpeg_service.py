"""
FFmpeg service for stream-copy operations.
Zero re-encoding, maximum performance.
"""

import subprocess
import json
import time
import tempfile
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class VideoMetadata:
    """Video stream metadata"""
    codec_name: str
    profile: str
    level: int
    width: int
    height: int
    pix_fmt: str
    r_frame_rate: str
    avg_frame_rate: str
    duration: float
    nb_frames: int
    time_base: str
    color_range: str
    sample_aspect_ratio: str


@dataclass
class FFmpegResult:
    """Result of FFmpeg operation"""
    success: bool
    output_path: Optional[str]
    duration_ms: float
    command: str
    exit_code: int
    stderr: str
    filesize_bytes: int = 0
    throughput_mbps: float = 0.0


class FFmpegService:
    """High-performance FFmpeg service for stream-copy operations"""

    def __init__(self, ffmpeg_bin: str = "ffmpeg", ffprobe_bin: str = "ffprobe"):
        self.ffmpeg_bin = ffmpeg_bin
        self.ffprobe_bin = ffprobe_bin

    def probe_video(self, video_path: str) -> VideoMetadata:
        """
        Extract video metadata using ffprobe.
        """
        cmd = [
            self.ffprobe_bin,
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=codec_name,profile,level,width,height,pix_fmt,"
                             "r_frame_rate,avg_frame_rate,duration,nb_frames,time_base,"
                             "color_range,sample_aspect_ratio",
            "-of", "json",
            video_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffprobe failed: {result.stderr}")

        data = json.loads(result.stdout)
        stream = data["streams"][0]

        return VideoMetadata(
            codec_name=stream.get("codec_name", ""),
            profile=stream.get("profile", ""),
            level=stream.get("level", 0),
            width=stream.get("width", 0),
            height=stream.get("height", 0),
            pix_fmt=stream.get("pix_fmt", ""),
            r_frame_rate=stream.get("r_frame_rate", ""),
            avg_frame_rate=stream.get("avg_frame_rate", ""),
            duration=float(stream.get("duration", 0)),
            nb_frames=int(stream.get("nb_frames", 0)),
            time_base=stream.get("time_base", ""),
            color_range=stream.get("color_range", ""),
            sample_aspect_ratio=stream.get("sample_aspect_ratio", "1:1")
        )

    def validate_compatibility(self, video_paths: List[str]) -> Tuple[bool, str]:
        """
        Validate that all videos are compatible for stream-copy concat.
        Returns (is_compatible, error_message)
        """
        if len(video_paths) < 2:
            return True, ""

        metadatas = [self.probe_video(path) for path in video_paths]
        reference = metadatas[0]

        for i, meta in enumerate(metadatas[1:], start=1):
            if meta.codec_name != reference.codec_name:
                return False, f"Video {i} codec mismatch: {meta.codec_name} != {reference.codec_name}"
            if meta.profile != reference.profile:
                return False, f"Video {i} profile mismatch: {meta.profile} != {reference.profile}"
            if meta.width != reference.width or meta.height != reference.height:
                return False, f"Video {i} resolution mismatch: {meta.width}x{meta.height} != {reference.width}x{reference.height}"
            if meta.pix_fmt != reference.pix_fmt:
                return False, f"Video {i} pix_fmt mismatch: {meta.pix_fmt} != {reference.pix_fmt}"
            if meta.r_frame_rate != reference.r_frame_rate:
                return False, f"Video {i} frame rate mismatch: {meta.r_frame_rate} != {reference.r_frame_rate}"

        return True, ""

    def extract_segment(
        self,
        input_path: str,
        start_s: float,
        end_s: float,
        output_path: str,
        accurate_seek: bool = True
    ) -> FFmpegResult:
        """
        Extract a segment from a video using stream-copy.

        Args:
            input_path: Source video file
            start_s: Start time in seconds
            end_s: End time in seconds
            output_path: Output file path
            accurate_seek: If True, seeks accurately (slower). If False, seeks to nearest keyframe (faster)

        Returns:
            FFmpegResult with operation details
        """
        duration = end_s - start_s

        # Build FFmpeg command
        # For accurate seeking: -ss before -i (fast seek to keyframe) + -ss after -i (accurate frame)
        # For keyframe-only: -ss before -i only
        if accurate_seek:
            cmd = [
                self.ffmpeg_bin,
                "-ss", str(start_s),
                "-i", input_path,
                "-t", str(duration),
                "-c", "copy",  # Stream copy (no re-encode)
                "-an",  # No audio
                "-avoid_negative_ts", "make_zero",  # Fix timestamp issues
                "-y",  # Overwrite output
                output_path
            ]
        else:
            cmd = [
                self.ffmpeg_bin,
                "-ss", str(start_s),
                "-i", input_path,
                "-t", str(duration),
                "-c", "copy",
                "-an",
                "-y",
                output_path
            ]

        start_time = time.time()
        result = subprocess.run(cmd, capture_output=True, text=True)
        duration_ms = (time.time() - start_time) * 1000

        success = result.returncode == 0
        filesize = 0
        throughput = 0.0

        if success and os.path.exists(output_path):
            filesize = os.path.getsize(output_path)
            if duration_ms > 0:
                throughput = (filesize * 8 / 1_000_000) / (duration_ms / 1000)  # Mbps

        logger.info(f"Extract segment: {start_s:.2f}s-{end_s:.2f}s, "
                   f"duration={duration_ms:.0f}ms, size={filesize:,} bytes, "
                   f"throughput={throughput:.1f} Mbps")

        return FFmpegResult(
            success=success,
            output_path=output_path if success else None,
            duration_ms=duration_ms,
            command=" ".join(cmd),
            exit_code=result.returncode,
            stderr=result.stderr,
            filesize_bytes=filesize,
            throughput_mbps=throughput
        )

    def concat_segments(
        self,
        segment_paths: List[str],
        output_path: str
    ) -> FFmpegResult:
        """
        Concatenate multiple video segments using stream-copy.
        Uses ffmpeg concat demuxer for maximum performance.

        Args:
            segment_paths: List of video file paths to concatenate
            output_path: Output file path

        Returns:
            FFmpegResult with operation details
        """
        if not segment_paths:
            return FFmpegResult(
                success=False,
                output_path=None,
                duration_ms=0,
                command="",
                exit_code=-1,
                stderr="No segments provided"
            )

        if len(segment_paths) == 1:
            # Single segment - just copy
            import shutil
            shutil.copy2(segment_paths[0], output_path)
            filesize = os.path.getsize(output_path)
            return FFmpegResult(
                success=True,
                output_path=output_path,
                duration_ms=0,
                command=f"cp {segment_paths[0]} {output_path}",
                exit_code=0,
                stderr="",
                filesize_bytes=filesize
            )

        # Create concat file
        concat_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
        try:
            for path in segment_paths:
                # Convert to absolute path and forward slashes for ffmpeg compatibility
                abs_path = os.path.abspath(path).replace('\\', '/')
                # Escape special characters for ffmpeg concat format
                escaped_path = abs_path.replace("'", "'\\''")
                concat_file.write(f"file '{escaped_path}'\n")
            concat_file.close()

            cmd = [
                self.ffmpeg_bin,
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file.name,
                "-c", "copy",  # Stream copy
                "-an",  # No audio
                "-y",
                output_path
            ]

            start_time = time.time()
            result = subprocess.run(cmd, capture_output=True, text=True)
            duration_ms = (time.time() - start_time) * 1000

            success = result.returncode == 0
            filesize = 0
            throughput = 0.0

            if success and os.path.exists(output_path):
                filesize = os.path.getsize(output_path)
                if duration_ms > 0:
                    throughput = (filesize * 8 / 1_000_000) / (duration_ms / 1000)  # Mbps

            logger.info(f"Concat {len(segment_paths)} segments: "
                       f"duration={duration_ms:.0f}ms, size={filesize:,} bytes, "
                       f"throughput={throughput:.1f} Mbps")

            return FFmpegResult(
                success=success,
                output_path=output_path if success else None,
                duration_ms=duration_ms,
                command=" ".join(cmd),
                exit_code=result.returncode,
                stderr=result.stderr,
                filesize_bytes=filesize,
                throughput_mbps=throughput
            )
        finally:
            # Cleanup concat file
            try:
                os.unlink(concat_file.name)
            except:
                pass

    def extract_and_concat(
        self,
        segments: List[Dict],  # [{path, start_s, end_s}, ...]
        output_path: str,
        temp_dir: Optional[str] = None
    ) -> FFmpegResult:
        """
        Extract multiple segments and concatenate them in one operation.
        This is the core function for building clips.

        Args:
            segments: List of dicts with keys: path, start_s, end_s
            output_path: Final output file path
            temp_dir: Directory for temporary segment files

        Returns:
            FFmpegResult with operation details
        """
        if not segments:
            return FFmpegResult(
                success=False,
                output_path=None,
                duration_ms=0,
                command="",
                exit_code=-1,
                stderr="No segments provided"
            )

        if temp_dir is None:
            temp_dir = tempfile.gettempdir()

        temp_segments = []
        total_extract_ms = 0

        try:
            # Step 1: Extract all segments
            for i, seg in enumerate(segments):
                temp_seg_path = os.path.join(temp_dir, f"seg_{i:04d}_{int(time.time()*1000)}.mp4")

                result = self.extract_segment(
                    input_path=seg["path"],
                    start_s=seg["start_s"],
                    end_s=seg["end_s"],
                    output_path=temp_seg_path,
                    accurate_seek=False  # Use keyframe seeking for speed
                )

                if not result.success:
                    raise RuntimeError(f"Failed to extract segment {i}: {result.stderr}")

                temp_segments.append(temp_seg_path)
                total_extract_ms += result.duration_ms

            # Step 2: Concatenate all segments
            concat_result = self.concat_segments(temp_segments, output_path)

            if not concat_result.success:
                raise RuntimeError(f"Failed to concatenate segments: {concat_result.stderr}")

            total_duration_ms = total_extract_ms + concat_result.duration_ms

            logger.info(f"Extract & concat complete: {len(segments)} segments, "
                       f"extract={total_extract_ms:.0f}ms, "
                       f"concat={concat_result.duration_ms:.0f}ms, "
                       f"total={total_duration_ms:.0f}ms")

            return FFmpegResult(
                success=True,
                output_path=output_path,
                duration_ms=total_duration_ms,
                command=f"extract({len(segments)}) + concat",
                exit_code=0,
                stderr="",
                filesize_bytes=concat_result.filesize_bytes,
                throughput_mbps=concat_result.throughput_mbps
            )

        finally:
            # Cleanup temp segments
            for temp_seg in temp_segments:
                try:
                    if os.path.exists(temp_seg):
                        os.unlink(temp_seg)
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp segment {temp_seg}: {e}")
