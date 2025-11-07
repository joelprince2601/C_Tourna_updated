"""
Performance test script for the new FFmpeg-based system.
Tests clip creation and reel building with actual videos.
"""

import os
import sys
import time
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from services.ffmpeg_service import FFmpegService
from services.clip_service import ClipService
from services.reel_service import ReelService
from models.clip import ClipSegment


def test_single_camera_clip():
    """Test extracting a single camera clip"""
    print("\n" + "="*60)
    print("TEST 1: Single Camera Clip Extraction")
    print("="*60)

    input_videos_dir = "InputVideos"
    camera_files = {
        "C1": os.path.join(input_videos_dir, "Adayar_C1-8.23Pm to 8.35.mp4"),
        "C2": os.path.join(input_videos_dir, "Adayar_C2-8.23Pm to 8.35.mp4"),
        "C3": os.path.join(input_videos_dir, "Adayar_C3-8.23Pm to 8.35.mp4"),
        "C4": os.path.join(input_videos_dir, "Adayar_C4-8.23Pm to 8.35.mp4")
    }

    # Initialize services
    ffmpeg = FFmpegService()
    clip_service = ClipService(output_dir="test_output/clips", ffmpeg_service=ffmpeg)

    # Test: Extract 10 seconds from C1
    segments = [
        ClipSegment(camera_id="C1", start_s=10.0, end_s=20.0)
    ]

    print(f"\nExtracting 10s clip from C1 (10s-20s)...")
    start_time = time.time()

    clip = clip_service.create_clip(segments=segments, camera_files=camera_files)

    elapsed_ms = (time.time() - start_time) * 1000

    print(f"\nPASS: Clip created: {clip.clip_id}")
    print(f"  Duration: {clip.duration_s:.2f}s")
    print(f"  Filesize: {clip.filesize_bytes:,} bytes ({clip.filesize_bytes/1024/1024:.1f} MB)")
    print(f"  Processing time: {elapsed_ms:.0f}ms")
    print(f"  Output: {clip.output_path}")

    if elapsed_ms < 2000:
        print(f"  PASS: PASS: Processing time < 2s")
    else:
        print(f"  FAIL: FAIL: Processing time >= 2s (target: <2s)")

    return clip


def test_multi_camera_clip():
    """Test creating a clip with camera switching"""
    print("\n" + "="*60)
    print("TEST 2: Multi-Camera Clip with Switching")
    print("="*60)

    input_videos_dir = "InputVideos"
    camera_files = {
        "C1": os.path.join(input_videos_dir, "Adayar_C1-8.23Pm to 8.35.mp4"),
        "C2": os.path.join(input_videos_dir, "Adayar_C2-8.23Pm to 8.35.mp4"),
        "C3": os.path.join(input_videos_dir, "Adayar_C3-8.23Pm to 8.35.mp4"),
        "C4": os.path.join(input_videos_dir, "Adayar_C4-8.23Pm to 8.35.mp4")
    }

    # Initialize services
    ffmpeg = FFmpegService()
    clip_service = ClipService(output_dir="test_output/clips", ffmpeg_service=ffmpeg)

    # Test: Create a clip switching between cameras
    # C1: 10-15s (5s), C2: 15-22s (7s), C3: 22-30s (8s), C4: 30-35s (5s)
    # Total: 25s
    segments = [
        ClipSegment(camera_id="C1", start_s=10.0, end_s=15.0),
        ClipSegment(camera_id="C2", start_s=15.0, end_s=22.0),
        ClipSegment(camera_id="C3", start_s=22.0, end_s=30.0),
        ClipSegment(camera_id="C4", start_s=30.0, end_s=35.0),
    ]

    print(f"\nCreating 25s clip with 4 camera switches...")
    for i, seg in enumerate(segments):
        print(f"  Segment {i+1}: {seg.camera_id} {seg.start_s:.1f}s-{seg.end_s:.1f}s ({seg.end_s-seg.start_s:.1f}s)")

    start_time = time.time()

    clip = clip_service.create_clip(segments=segments, camera_files=camera_files)

    elapsed_ms = (time.time() - start_time) * 1000

    print(f"\nPASS: Clip created: {clip.clip_id}")
    print(f"  Duration: {clip.duration_s:.2f}s")
    print(f"  Filesize: {clip.filesize_bytes:,} bytes ({clip.filesize_bytes/1024/1024:.1f} MB)")
    print(f"  Processing time: {elapsed_ms:.0f}ms")
    print(f"  Output: {clip.output_path}")

    if elapsed_ms < 2000:
        print(f"  PASS: PASS: Processing time < 2s")
    else:
        print(f"  FAIL: FAIL: Processing time >= 2s (target: <2s)")

    return clip


def test_reel_creation(clips):
    """Test creating a highlight reel from multiple clips"""
    print("\n" + "="*60)
    print("TEST 3: Highlight Reel Creation")
    print("="*60)

    # Initialize services
    ffmpeg = FFmpegService()
    clip_service = ClipService(output_dir="test_output/clips", ffmpeg_service=ffmpeg)
    reel_service = ReelService(
        output_dir="test_output/reels",
        ffmpeg_service=ffmpeg,
        clip_service=clip_service
    )

    # Need to re-register clips (since we created a new clip_service instance)
    for clip in clips:
        clip_service.clips_db[clip.clip_id] = clip

    clip_ids = [clip.clip_id for clip in clips]
    total_duration = sum(clip.duration_s for clip in clips)

    print(f"\nCreating reel from {len(clips)} clips (total {total_duration:.1f}s)...")
    for clip in clips:
        print(f"  {clip.clip_id}: {clip.duration_s:.1f}s")

    start_time = time.time()

    reel = reel_service.create_reel(clip_ids=clip_ids)

    elapsed_ms = (time.time() - start_time) * 1000

    print(f"\nPASS: Reel created: {reel.reel_id}")
    print(f"  Duration: {reel.duration_s:.2f}s")
    print(f"  Filesize: {reel.filesize_bytes:,} bytes ({reel.filesize_bytes/1024/1024:.1f} MB)")
    print(f"  Processing time: {elapsed_ms:.0f}ms")
    print(f"  Output: {reel.output_path}")

    if elapsed_ms < 10000:
        print(f"  PASS: PASS: Processing time < 10s")
    else:
        print(f"  FAIL: FAIL: Processing time >= 10s (target: <10s)")

    return reel


def test_large_reel():
    """Test creating a 5-minute highlight reel (10s performance target)"""
    print("\n" + "="*60)
    print("TEST 4: Large Reel (~5 minutes)")
    print("="*60)

    input_videos_dir = "InputVideos"
    camera_files = {
        "C1": os.path.join(input_videos_dir, "Adayar_C1-8.23Pm to 8.35.mp4"),
        "C2": os.path.join(input_videos_dir, "Adayar_C2-8.23Pm to 8.35.mp4"),
        "C3": os.path.join(input_videos_dir, "Adayar_C3-8.23Pm to 8.35.mp4"),
        "C4": os.path.join(input_videos_dir, "Adayar_C4-8.23Pm to 8.35.mp4")
    }

    # Initialize services
    ffmpeg = FFmpegService()
    clip_service = ClipService(output_dir="test_output/clips", ffmpeg_service=ffmpeg)
    reel_service = ReelService(
        output_dir="test_output/reels",
        ffmpeg_service=ffmpeg,
        clip_service=clip_service
    )

    # Create 15 clips of ~20s each = ~300s = 5 minutes
    clips = []
    print(f"\nCreating 15 clips (~20s each)...")

    for i in range(15):
        camera_id = f"C{(i % 4) + 1}"
        start_s = 10.0 + (i * 40.0)
        end_s = start_s + 20.0

        segments = [ClipSegment(camera_id=camera_id, start_s=start_s, end_s=end_s)]

        print(f"  Clip {i+1}: {camera_id} {start_s:.1f}s-{end_s:.1f}s", end="", flush=True)

        clip = clip_service.create_clip(segments=segments, camera_files=camera_files)
        clips.append(clip)

        print(f" PASS:")

    total_duration = sum(clip.duration_s for clip in clips)
    print(f"\nPASS: Created {len(clips)} clips, total duration: {total_duration:.1f}s ({total_duration/60:.1f} min)")

    # Build reel
    clip_ids = [clip.clip_id for clip in clips]

    print(f"\nBuilding reel from {len(clips)} clips...")
    start_time = time.time()

    reel = reel_service.create_reel(clip_ids=clip_ids)

    elapsed_ms = (time.time() - start_time) * 1000

    print(f"\nPASS: Reel created: {reel.reel_id}")
    print(f"  Duration: {reel.duration_s:.2f}s ({reel.duration_s/60:.1f} min)")
    print(f"  Filesize: {reel.filesize_bytes:,} bytes ({reel.filesize_bytes/1024/1024:.1f} MB)")
    print(f"  Processing time: {elapsed_ms:.0f}ms ({elapsed_ms/1000:.1f}s)")
    print(f"  Output: {reel.output_path}")

    if elapsed_ms < 10000:
        print(f"  PASS: PASS: Processing time < 10s")
    else:
        print(f"  FAIL: FAIL: Processing time >= 10s (target: <10s)")

    return reel


if __name__ == "__main__":
    print("\n" + "="*60)
    print("PERFORMANCE TEST SUITE")
    print("Multi-Camera Highlight Generator v2")
    print("="*60)

    clips = []

    try:
        # Test 1: Single camera clip
        clip1 = test_single_camera_clip()
        clips.append(clip1)

        # Test 2: Multi-camera clip
        clip2 = test_multi_camera_clip()
        clips.append(clip2)

        # Test 3: Small reel from above clips
        reel1 = test_reel_creation(clips)

        # Test 4: Large reel (5 minutes)
        reel2 = test_large_reel()

        print("\n" + "="*60)
        print("ALL TESTS COMPLETED")
        print("="*60)

    except Exception as e:
        print(f"\nFAIL: ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
