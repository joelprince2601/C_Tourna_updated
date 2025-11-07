from fastapi import FastAPI, File, UploadFile, Form, Header
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from moviepy.editor import VideoFileClip, concatenate_videoclips, TextClip, CompositeVideoClip, ColorClip
from moviepy.video.fx.crop import crop as crop_fx
try:
    from PIL import Image as _PIL_Image, ImageDraw, ImageFont
    if not hasattr(_PIL_Image, 'ANTIALIAS') and hasattr(_PIL_Image, 'Resampling'):
        # Pillow >=10 renamed ANTIALIAS to Resampling.LANCZOS; MoviePy 1.0.3 expects ANTIALIAS
        _PIL_Image.ANTIALIAS = _PIL_Image.Resampling.LANCZOS
except Exception as _e:
    pass
import tempfile
import os
import shutil
import uuid
import json
from datetime import datetime
from typing import Optional
import psutil  # For disk space checking

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # in production, restrict this to your React app domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Default base folder
DEFAULT_BASE_DIR = os.path.join(os.getcwd(), "temp_video_clips")

# Session management
def get_session_dir(session_id: str = None, custom_path: str = None):
    """Get or create session-specific directory"""
    if not session_id:
        session_id = "default"

    # Always use default base directory
    base_dir = DEFAULT_BASE_DIR

    session_dir = os.path.join(base_dir, f"highlights_session_{session_id}")
    os.makedirs(session_dir, exist_ok=True)
    print(f"[SESSION] Using directory: {session_dir}")
    return session_dir

def get_metadata_file(session_id: str = None):
    """Get session-specific metadata file path"""
    session_dir = get_session_dir(session_id)
    return os.path.join(session_dir, "clips_metadata.json")

def check_disk_space(path, required_mb=500):
    """Check if there's enough disk space available"""
    try:
        disk_usage = psutil.disk_usage(os.path.dirname(path))
        free_mb = disk_usage.free / (1024 * 1024)
        print(f"[DISK] Free space: {free_mb:.2f} MB")
        return free_mb > required_mb
    except Exception as e:
        print(f"[DISK] Warning: Could not check disk space: {e}")
        return True  # Assume OK if we can't check

def load_clips_metadata(session_id: str = None):
    """Load clips metadata from file"""
    metadata_file = get_metadata_file(session_id)
    if os.path.exists(metadata_file):
        try:
            with open(metadata_file, 'r') as f:
                return json.load(f)
        except:
            return []
    return []

def save_clips_metadata(clips_data, session_id: str = None):
    """Save clips metadata to file"""
    metadata_file = get_metadata_file(session_id)
    with open(metadata_file, 'w') as f:
        json.dump(clips_data, f, indent=2)

def write_video_clip_no_audio(clip: "VideoClip", output_path: str):
    """Helper to write a video-only clip with consistent encoding settings.
    Preserves original aspect ratio and dimensions - no resizing."""
    clip.write_videofile(
        output_path,
        codec="libx264",
        audio=False,
        verbose=False,
        logger=None,
        preset='ultrafast',
        threads=4,
        bitrate="2000k",
        ffmpeg_params=["-crf", "23", "-vf", "scale=iw:ih"]  # Preserve original dimensions
    )

def create_scorecard_overlay(video_clip, team_a_score, team_b_score, event_type):
    """Create a football-style scorecard overlay for the video clip."""
    try:
        from moviepy.editor import ColorClip, TextClip, CompositeVideoClip
        
        # Create football-style scorecard like in the image
        # Format: "50:24 | LIV 0 - 0 RMA"
        
        # Calculate match time (simulate based on video duration)
        match_time = f"{int(video_clip.duration // 60):02d}:{int(video_clip.duration % 60):02d}"
        
        # Create the scorecard text in football style
        scorecard_text = f"{match_time} | TEAM A {team_a_score} - {team_b_score} TEAM B"
        
        # Create semi-transparent dark background bar
        bg_clip = ColorClip(
            size=(video_clip.w, 80),
            color=(0, 0, 0),  # Black background
            duration=video_clip.duration
        ).set_position(('center', 0)).set_opacity(0.8)  # Semi-transparent
        
        # Create main scorecard text
        scorecard_clip = TextClip(
            scorecard_text,
            fontsize=32,
            color='white',
            font='Arial-Bold',
            stroke_color='black',
            stroke_width=2
        ).set_position(('center', 25)).set_duration(video_clip.duration)
        
        # Create event indicator below the scorecard
        event_emoji = {
            'goal_a': '⚽',
            'goal_b': '⚽', 
            'switch': '🔄',
            'highlight': '⭐'
        }.get(event_type, '⭐')
        
        event_text = f"{event_emoji} {event_type.replace('_', ' ').upper()}"
        event_clip = TextClip(
            event_text,
            fontsize=20,
            color='yellow',
            font='Arial-Bold',
            stroke_color='black',
            stroke_width=1
        ).set_position(('center', 55)).set_duration(video_clip.duration)
        
        # Composite the video with overlays
        final_clip = CompositeVideoClip([video_clip, bg_clip, scorecard_clip, event_clip])
        
        print(f"[SCORECARD] Football-style overlay created: {scorecard_text}")
        print(f"[SCORECARD] Event: {event_text}")
        print(f"[SCORECARD] Match time: {match_time}")
        print(f"[SCORECARD] Video duration: {video_clip.duration}s")
        
        return final_clip
    except Exception as e:
        print(f"[SCORECARD] Error creating overlay: {e}")
        import traceback
        traceback.print_exc()
        return video_clip  # Return original clip if overlay fails

def parse_switch_plan(plan_json: str):
    try:
        plan = json.loads(plan_json)
        # Expect list of {view: "left"|"right", till: number} (split removed)
        if not isinstance(plan, list):
            raise ValueError("switch_plan must be a list")
        normalized = []
        for seg in plan:
            view = seg.get("view")
            till = seg.get("till")
            if view not in ("left", "right"):
                raise ValueError("Invalid view in switch_plan (only 'left' or 'right' allowed)")
            if not isinstance(till, (int, float)) or till <= 0:
                raise ValueError("Invalid till in switch_plan")
            normalized.append({"view": view, "till": float(till)})
        return normalized
    except Exception as e:
        raise ValueError(f"Invalid switch_plan: {e}")

def build_switch_timeline(left_sub, right_sub, plan_segments):
    # Use original dimensions - no resizing, no letterboxing
    segments = []
    cursor = 0.0
    for seg in plan_segments:
        seg_dur = max(0.0, seg["till"] - cursor)
        if seg_dur <= 0:
            continue
        view = seg["view"]
        if view == "left":
            composed = left_sub.subclip(cursor, cursor + seg_dur)
        else:  # right (split removed)
            composed = right_sub.subclip(cursor, cursor + seg_dur)
        segments.append(composed)
        cursor += seg_dur
    if not segments:
        return None
    # Use method="chain" to preserve original dimensions without resizing
    final = concatenate_videoclips(segments, method="chain")
    final.audio = None
    return final

@app.post("/extract_switch")
async def extract_switch_clip(
    video_left: UploadFile = File(...),
    video_right: UploadFile = File(...),
    timestamp: float = Form(...),
    switch_plan: str = Form(...),
    total_duration: float = Form(20.0),
    x_session_id: Optional[str] = Header(None)
):
    """
    Extract a window around timestamp and compose a video that switches views
    (left/right/split) according to switch_plan segments within the window.
    The plan uses cumulative "till" seconds from 0..total_duration.
    """
    session_id = x_session_id or "default"
    session_dir = get_session_dir(session_id)

    temp_left_path = None
    temp_right_path = None
    left_clip = None
    right_clip = None
    output_clip = None

    try:
        # Validate plan
        plan_segments = parse_switch_plan(switch_plan)
        if not plan_segments:
            return JSONResponse(status_code=400, content={"error": "switch_plan is empty"})

        # Ensure last till does not exceed total_duration
        if plan_segments[-1]["till"] > float(total_duration):
            plan_segments[-1]["till"] = float(total_duration)

        # Check disk space
        if not check_disk_space(session_dir, required_mb=700):
            return JSONResponse(status_code=507, content={"error": "Insufficient disk space. Please free up at least 700MB and try again."})

        # Save uploads to temp
        tleft = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        temp_left_path = tleft.name
        tleft.write(await video_left.read())
        tleft.close()

        tright = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        temp_right_path = tright.name
        tright.write(await video_right.read())
        tright.close()

        # Compute extraction window
        half = float(total_duration) / 2.0
        start = max(0.0, float(timestamp) - half)
        # Load
        left_clip = VideoFileClip(temp_left_path, audio=False)
        right_clip = VideoFileClip(temp_right_path, audio=False)
        end = min(start + float(total_duration), left_clip.duration, right_clip.duration)
        # Adjust total_duration if needed
        total_duration_effective = end - start

        left_sub = left_clip.subclip(start, end)
        right_sub = right_clip.subclip(start, end)

        # Normalize plan till to effective duration if shorter
        norm_plan = []
        for seg in plan_segments:
            norm_plan.append({"view": seg["view"], "till": min(seg["till"], total_duration_effective)})

        output_clip = build_switch_timeline(left_sub, right_sub, norm_plan)
        if output_clip is None:
            return JSONResponse(status_code=400, content={"error": "switch_plan produced no segments"})

        # Write output
        clip_id = str(uuid.uuid4())[:8]
        output_path = os.path.join(session_dir, f"clip_{clip_id}.mp4")
        write_video_clip_no_audio(output_clip, output_path)

        # Cleanup subclips
        try:
            left_sub.close()
        except:
            pass
        try:
            right_sub.close()
        except:
            pass

        # Save metadata
        clips_data = load_clips_metadata(session_id)
        clip_info = {
            "clip_id": clip_id,
            "timestamp": timestamp,
            "start_time": start,
            "end_time": end,
            "filename": f"clip_{clip_id}.mp4",
            "path": output_path,
            "created_at": datetime.now().isoformat(),
            "session_id": session_id,
            "mode": "switch",
            "switch_plan": norm_plan
        }
        clips_data.append(clip_info)
        save_clips_metadata(clips_data, session_id)

        return JSONResponse({
            "message": "Switch clip extracted and saved",
            "clip_id": clip_id,
            "timestamp": timestamp,
            "duration": end - start,
            "total_clips": len(clips_data)
        })
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        print(f"[EXTRACT_SWITCH] ERROR: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        for c in [output_clip, left_clip, right_clip]:
            try:
                if c:
                    c.close()
            except:
                pass
        for p in [temp_left_path, temp_right_path]:
            try:
                if p and os.path.exists(p):
                    os.unlink(p)
            except Exception as cleanup_error:
                print(f"[EXTRACT_SWITCH] Cleanup warning: {cleanup_error}")

@app.post("/extract")
async def extract_clip(
    video: UploadFile = File(...),
    timestamp: float = Form(...),
    x_session_id: Optional[str] = Header(None)
):
    """
    Extract a video clip of ±10 seconds around the given timestamp and save it.

    Args:
        video: The uploaded video file
        timestamp: The timestamp in seconds where the event occurred
        x_session_id: Optional session ID for isolating clips

    Returns:
        JSONResponse: Information about the saved clip
    """
    temp_input_path = None
    clip = None
    session_id = x_session_id or "default"

    try:
        print(f"[EXTRACT] Session: {session_id}, Starting clip extraction at timestamp {timestamp}")

        # Get session directory (uses custom path if set)
        session_dir = get_session_dir(session_id)

        # Check disk space before processing
        if not check_disk_space(session_dir, required_mb=300):
            return JSONResponse(
                status_code=507,
                content={"error": "Insufficient disk space. Please free up at least 300MB and try again."}
            )

        # Save uploaded video to temporary file
        temp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        temp_input_path = temp_input.name

        # Read video data
        video_data = await video.read()
        print(f"[EXTRACT] Read {len(video_data)} bytes from uploaded video")

        temp_input.write(video_data)
        temp_input.close()

        print(f"[EXTRACT] Saved uploaded video to: {temp_input_path}")

        # Compute clip range (±10 seconds around timestamp)
        start = max(0, timestamp - 10)
        end = timestamp + 10

        print(f"[EXTRACT] Clip range: {start}s to {end}s")

        # Generate unique clip ID and filename
        clip_id = str(uuid.uuid4())[:8]
        session_dir = get_session_dir(session_id)
        output_path = os.path.join(session_dir, f"clip_{clip_id}.mp4")

        print(f"[EXTRACT] Session dir: {session_dir}")
        print(f"[EXTRACT] Output path: {output_path}")

        # Load video and extract clip
        print(f"[EXTRACT] Loading video file...")
        clip = VideoFileClip(temp_input_path, audio=False)

        print(f"[EXTRACT] Video duration: {clip.duration}s")
        print(f"[EXTRACT] Extracting subclip from {start}s to {end}s...")

        # Adjust end time if it exceeds video duration
        if end > clip.duration:
            end = clip.duration
            print(f"[EXTRACT] Adjusted end time to {end}s (video duration)")

        subclip = clip.subclip(start, end)

        print(f"[EXTRACT] Writing video file (no audio) to {output_path}...")

        # Write video only (no audio processing) preserving original aspect ratio and dimensions
        subclip.write_videofile(
            output_path,
            codec="libx264",
            audio=False,
            verbose=False,
            logger=None,
            preset='ultrafast',  # Better compression than ultrafast
            threads=4,
            bitrate="2000k",  # Limit bitrate to reduce file size
            ffmpeg_params=["-crf", "23", "-vf", "scale=iw:ih"]  # Preserve original dimensions (iw=input width, ih=input height)
        )

        print(f"[EXTRACT] Video file written successfully!")

        # Close clips
        try:
            subclip.close()
        except:
            pass

        try:
            clip.close()
        except:
            pass

        clip = None

        # Clean up input file
        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.unlink(temp_input_path)
                print(f"[EXTRACT] Cleaned up temp input file")
            except Exception as cleanup_error:
                print(f"[EXTRACT] Warning: Could not delete temp file (file may be in use): {cleanup_error}")

        # Save clip metadata
        clips_data = load_clips_metadata(session_id)
        clip_info = {
            "clip_id": clip_id,
            "timestamp": timestamp,
            "start_time": start,
            "end_time": end,
            "filename": f"clip_{clip_id}.mp4",
            "path": output_path,
            "created_at": datetime.now().isoformat(),
            "session_id": session_id
        }
        clips_data.append(clip_info)
        save_clips_metadata(clips_data, session_id)

        print(f"[EXTRACT] Clip metadata saved. Total clips: {len(clips_data)}")

        return JSONResponse({
            "message": "Clip extracted and saved",
            "clip_id": clip_id,
            "timestamp": timestamp,
            "duration": end - start,
            "total_clips": len(clips_data)
        })

    except Exception as e:
        print(f"[EXTRACT] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()

        # Cleanup on error
        if clip:
            try:
                clip.close()
            except:
                pass

        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.unlink(temp_input_path)
            except:
                pass

        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/highlights")
async def generate_highlights(x_session_id: Optional[str] = Header(None)):
    """
    Generate a combined highlights video from all saved clips.

    Args:
        x_session_id: Optional session ID for isolating clips

    Returns:
        FileResponse: The combined highlights video
    """
    session_id = x_session_id or "default"
    session_dir = get_session_dir(session_id)

    try:
        clips_data = load_clips_metadata(session_id)
        print(f"[HIGHLIGHTS] Session: {session_id}, Found {len(clips_data)} clips in metadata")

        if not clips_data:
            return JSONResponse(status_code=400, content={"error": "No clips available to generate highlights"})

        # Sort clips by timestamp to ensure chronological order
        clips_data.sort(key=lambda x: x.get("timestamp", 0))
        print(f"[HIGHLIGHTS] Sorted clips by timestamp for chronological order")
        
        # Load all clip files in chronological order
        video_clips = []
        for clip_info in clips_data:
            clip_path = clip_info["path"]
            print(f"[HIGHLIGHTS] Checking clip: {clip_path} (timestamp: {clip_info.get('timestamp', 'unknown')})")
            if os.path.exists(clip_path):
                print(f"[HIGHLIGHTS] Loading clip: {clip_path}")
                video_clips.append(VideoFileClip(clip_path, audio=False))
            else:
                print(f"[HIGHLIGHTS] Warning: Clip file not found: {clip_path}")

        if not video_clips:
            return JSONResponse(status_code=400, content={"error": "No valid clip files found"})

        print(f"[HIGHLIGHTS] Concatenating {len(video_clips)} clips...")

        # Fit all clips into a 16:9, 1280x720 frame with black borders (letterboxing/pillarboxing)
        target_width = 1280
        target_height = 720
        
        print(f"[HIGHLIGHTS] Fitting all clips into 16:9 ({target_width}x{target_height}) with black borders")
        
        processed_clips = []
        for i, clip in enumerate(video_clips):
            original_w, original_h = clip.size
            print(f"[HIGHLIGHTS] Clip {i+1}: Original size {original_w}x{original_h}")

            # Determine the new size to fit within the target dimensions while maintaining aspect ratio
            ratio = min(target_width / original_w, target_height / original_h)
            new_size = (int(original_w * ratio), int(original_h * ratio))

            # Resize the clip
            resized_clip = clip.resize(new_size)
            print(f"[HIGHLIGHTS] Clip {i+1}: Resized to {new_size[0]}x{new_size[1]} to fit 16:9 frame")

            # Create a black background clip
            background = ColorClip(size=(target_width, target_height),
                                   color=(0, 0, 0),
                                   duration=resized_clip.duration)

            # Composite the resized clip onto the background, centered
            composited_clip = CompositeVideoClip([background, resized_clip.set_position("center")])
            
            processed_clips.append(composited_clip)

        # Combine all clips (video only, no audio) - all clips are now 1280x720
        print(f"[HIGHLIGHTS] Concatenating {len(processed_clips)} clips with 16:9 dimensions...")
        final_clip = concatenate_videoclips(processed_clips, method="compose")
        
        # Verify final clip dimensions
        print(f"[HIGHLIGHTS] After concatenation: {final_clip.w}x{final_clip.h} (should be {target_width}x{target_height})")

        # Generate output path for highlights
        highlights_path = os.path.join(session_dir, "match_highlights.mp4")

        # Remove old highlights file if it exists
        if os.path.exists(highlights_path):
            try:
                os.unlink(highlights_path)
                print(f"[HIGHLIGHTS] Removed old highlights file")
            except Exception as e:
                print(f"[HIGHLIGHTS] Warning: Could not remove old file: {e}")

        print(f"[HIGHLIGHTS] Writing combined video (no audio) to: {highlights_path}")
        print(f"[HIGHLIGHTS] Final video dimensions: {final_clip.w}x{final_clip.h} (should be {target_width}x{target_height} for 16:1)")
        
        # Ensure final clip has exact 1:1 dimensions
        if final_clip.w != target_width or final_clip.h != target_height:
            print(f"[HIGHLIGHTS] Resizing final clip from {final_clip.w}x{final_clip.h} to {target_width}x{target_height}")
            final_clip = final_clip.resize((target_width, target_height))

        # Write the combined video (video only, no audio) with 1:1 aspect ratio
        # Force exact dimensions and aspect ratio in ffmpeg
        final_clip.write_videofile(
            highlights_path,
            codec="libx264",
            audio=False,
            verbose=False,
            logger=None,
            preset='ultrafast',  # Better compression
            threads=4,
            bitrate="2000k",  # Limit bitrate
            ffmpeg_params=[
                "-crf", "23",
                "-aspect", "16:9",  # Set aspect ratio metadata
                "-pix_fmt", "yuv420p"  # Ensure compatibility
            ]
        )

        print(f"[HIGHLIGHTS] Video written successfully!")
        print(f"[HIGHLIGHTS] File size: {os.path.getsize(highlights_path)} bytes")

        # Close all clips to free memory
        try:
            final_clip.close()
        except:
            pass

        # Close resized clips
        for clip in processed_clips:
            try:
                clip.close()
            except:
                pass

        # Close original clips
        for clip in video_clips:
            try:
                clip.close()
            except:
                pass

        print(f"[HIGHLIGHTS] Returning file: {highlights_path}")

        return FileResponse(
            highlights_path,
            media_type="video/mp4",
            filename="match_highlights.mp4"
        )

    except Exception as e:
        print(f"[HIGHLIGHTS] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/clips")
async def get_clips(x_session_id: Optional[str] = Header(None)):
    """
    Get information about all saved clips.

    Args:
        x_session_id: Optional session ID for isolating clips

    Returns:
        JSONResponse: List of saved clips with metadata
    """
    session_id = x_session_id or "default"
    print(f"[GET_CLIPS] Received session ID: {session_id}")

    try:
        clips_data = load_clips_metadata(session_id)
        return JSONResponse({
            "clips": clips_data,
            "total_clips": len(clips_data),
            "session_id": session_id
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/clip/{clip_id}")
async def get_clip_file(clip_id: str, x_session_id: Optional[str] = Header(None)):
    """
    Stream a specific clip file by its clip_id.

    Args:
        clip_id: The clip identifier stored in metadata
        x_session_id: Optional session ID

    Returns:
        FileResponse: The video/mp4 clip file if found
    """
    session_id = x_session_id or "default"
    print(f"[GET_CLIP] Received session ID: {session_id}")
    try:
        print(f"[GET_CLIP] Looking for clip_id: {clip_id} in session: {session_id}")
        clips_data = load_clips_metadata(session_id)
        print(f"[GET_CLIP] Found {len(clips_data)} clips in metadata")
        
        for clip_info in clips_data:
            print(f"[GET_CLIP] Checking clip: {clip_info.get('clip_id')} vs {clip_id}")
            if clip_info.get("clip_id") == clip_id:
                clip_path = clip_info.get("path")
                print(f"[GET_CLIP] Found matching clip, path: {clip_path}")
                if clip_path and os.path.exists(clip_path):
                    print(f"[GET_CLIP] File exists, serving: {clip_path}")
                    return FileResponse(
                        clip_path,
                        media_type="video/mp4",
                        filename=clip_info.get("filename", f"clip_{clip_id}.mp4")
                    )
                else:
                    print(f"[GET_CLIP] File not found at path: {clip_path}")
                    return JSONResponse(status_code=404, content={"error": "Clip file not found"})
        
        print(f"[GET_CLIP] No matching clip found for clip_id: {clip_id}")
        return JSONResponse(status_code=404, content={"error": "Clip not found"})
    except Exception as e:
        print(f"[GET_CLIP] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.delete("/clip/{clip_id}")
async def delete_clip(clip_id: str, x_session_id: Optional[str] = Header(None)):
    """
    Delete a specific clip by its clip_id.
    """
    session_id = x_session_id or "default"
    print(f"[DELETE_CLIP] Received request to delete clip_id: {clip_id} in session: {session_id}")
    try:
        clips_data = load_clips_metadata(session_id)
        
        clip_to_delete = None
        for clip_info in clips_data:
            if clip_info.get("clip_id") == clip_id:
                clip_to_delete = clip_info
                break
        
        if not clip_to_delete:
            print(f"[DELETE_CLIP] Clip not found: {clip_id}")
            return JSONResponse(status_code=404, content={"error": "Clip not found"})
            
        # Delete the file
        clip_path = clip_to_delete.get("path")
        if clip_path and os.path.exists(clip_path):
            try:
                os.unlink(clip_path)
                print(f"[DELETE_CLIP] Deleted file: {clip_path}")
            except Exception as e:
                print(f"[DELETE_CLIP] Warning: Could not delete file {clip_path}: {e}")
            
        # Remove from metadata
        new_clips_data = [c for c in clips_data if c.get("clip_id") != clip_id]
        save_clips_metadata(new_clips_data, session_id)
        print(f"[DELETE_CLIP] Removed clip {clip_id} from metadata. New total: {len(new_clips_data)}")
        
        return JSONResponse({"message": f"Clip {clip_id} deleted successfully", "total_clips": len(new_clips_data)})

    except Exception as e:
        print(f"[DELETE_CLIP] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.delete("/clear_clips")
async def clear_clips(x_session_id: Optional[str] = Header(None)):
    """
    Clear all saved clips and their metadata.

    Args:
        x_session_id: Optional session ID for isolating clips

    Returns:
        JSONResponse: Confirmation message
    """
    session_id = x_session_id or "default"
    session_dir = get_session_dir(session_id)

    try:
        # Remove all clip files
        clips_data = load_clips_metadata(session_id)
        for clip_info in clips_data:
            clip_path = clip_info["path"]
            if os.path.exists(clip_path):
                try:
                    os.unlink(clip_path)
                except Exception as e:
                    print(f"[CLEAR] Warning: Could not delete {clip_path}: {e}")

        # Remove highlights file if it exists
        highlights_path = os.path.join(session_dir, "match_highlights.mp4")
        if os.path.exists(highlights_path):
            try:
                os.unlink(highlights_path)
            except Exception as e:
                print(f"[CLEAR] Warning: Could not delete highlights: {e}")

        # Clear metadata
        save_clips_metadata([], session_id)

        print(f"[CLEAR] Session {session_id} cleared successfully")

        return JSONResponse({"message": "All clips cleared successfully", "session_id": session_id})
    except Exception as e:
        print(f"[CLEAR] ERROR: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# Removed set_save_location endpoint and custom path handling


@app.post("/extract_slider")
async def extract_slider_clips(
    video_left: UploadFile = File(...),
    video_right: UploadFile = File(...),
    events: str = Form(...),
    x_session_id: Optional[str] = Header(None)
):
    """
    Extract clips from left and right videos based on slider events.
    Each event defines left/right ranges and view type (left/right/split).
    """
    session_id = x_session_id or "default"
    print(f"[EXTRACT_SLIDER] Received session ID: {session_id}")
    session_dir = get_session_dir(session_id)
    
    # Ensure session directory exists
    os.makedirs(session_dir, exist_ok=True)
    print(f"[EXTRACT_SLIDER] Session directory: {session_dir}")
    print(f"[EXTRACT_SLIDER] Directory exists: {os.path.exists(session_dir)}")

    temp_left_path = None
    temp_right_path = None
    left_clip = None
    right_clip = None
    output_clips = []

    try:
        print(f"[EXTRACT_SLIDER] Session: {session_id}, Processing {len(events)} events")

        # Parse events JSON
        import json
        events_data = json.loads(events)
        if not events_data or not isinstance(events_data, list):
            return JSONResponse(status_code=400, content={"error": "Invalid events data"})

        # Check disk space
        required_mb = len(events_data) * 100  # Estimate 100MB per event
        if not check_disk_space(session_dir, required_mb=required_mb):
            return JSONResponse(status_code=507, content={"error": f"Insufficient disk space. Please free up at least {required_mb}MB and try again."})

        # Save uploads to temp files
        tleft = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        temp_left_path = tleft.name
        tleft.write(await video_left.read())
        tleft.close()

        tright = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        temp_right_path = tright.name
        tright.write(await video_right.read())
        tright.close()

        # Load base clips
        left_clip = VideoFileClip(temp_left_path, audio=False)
        right_clip = VideoFileClip(temp_right_path, audio=False)

        print(f"[EXTRACT_SLIDER] Left video duration: {left_clip.duration}s")
        print(f"[EXTRACT_SLIDER] Right video duration: {right_clip.duration}s")

        # Process each event
        clips_data = load_clips_metadata(session_id)
        
        # Calculate cumulative scores for overlay
        team_a_score = 0
        team_b_score = 0
        
        for event in events_data:
            event_id = event.get("eventId", 1)
            left_start = float(event.get("left_start", 0))
            left_end = float(event.get("left_end", 10))
            right_start = float(event.get("right_start", 0))
            right_end = float(event.get("right_end", 10))
            view = event.get("view", "total")
            views = event.get("views", [])

            print(f"[EXTRACT_SLIDER] Processing event {event_id}: {view} view")
            print(f"[EXTRACT_SLIDER] Left range: {left_start}s to {left_end}s")
            print(f"[EXTRACT_SLIDER] Right range: {right_start}s to {right_end}s")

            # Validate ranges
            left_start = max(0, min(left_start, left_clip.duration))
            left_end = max(left_start, min(left_end, left_clip.duration))
            right_start = max(0, min(right_start, right_clip.duration))
            right_end = max(right_start, min(right_end, right_clip.duration))

            # Create output based on view - use same logic as switch mode
            if view == "left":
                # Left only - use left video range
                output_clip = left_clip.subclip(left_start, left_end)
            elif view == "right":
                # Right only - use right video range
                output_clip = right_clip.subclip(right_start, right_end)
            else:  # total (use switch timeline logic)
                # Extract clips with their exact ranges as specified
                left_sub = left_clip.subclip(left_start, left_end)
                right_sub = right_clip.subclip(right_start, right_end)
                
                # Calculate the total duration based on your views configuration
                if views and len(views) > 0:
                    # Use the total duration from your views configuration
                    total_duration = sum(view_item.get("duration", 5) for view_item in views)
                    
                    # Convert views array to switch plan format (split removed)
                    switch_plan = []
                    cumulative_time = 0
                    for view_item in views:
                        view_type = view_item.get("type", "left")
                        # Convert "split" to "left" (split screen removed)
                        if view_type == "split" or view_type == "total":
                            view_type = "left"
                        cumulative_time += view_item.get("duration", 5)
                        switch_plan.append({
                            "view": view_type,
                            "till": cumulative_time
                        })
                else:
                    # Default: left for half duration, then right
                    left_duration = left_end - left_start
                    right_duration = right_end - right_start
                    total_duration = left_duration + right_duration
                    
                    switch_plan = [
                        {"view": "left", "till": left_duration},
                        {"view": "right", "till": total_duration}
                    ]
                
                print(f"[EXTRACT_SLIDER] Using switch plan: {switch_plan}")
                print(f"[EXTRACT_SLIDER] Total duration: {total_duration}s")
                print(f"[EXTRACT_SLIDER] Left range: {left_start}s-{left_end}s ({left_end-left_start}s)")
                print(f"[EXTRACT_SLIDER] Right range: {right_start}s-{right_end}s ({right_end-right_start}s)")
                
                # Create a custom switch timeline that respects your exact time ranges
                # No resizing, no letterboxing - use original dimensions
                segments = []
                cursor = 0.0
                
                for seg in switch_plan:
                    seg_dur = max(0.0, seg["till"] - cursor)
                    if seg_dur <= 0:
                        continue
                    
                    view = seg["view"]
                    print(f"[EXTRACT_SLIDER] Creating segment: {view} for {seg_dur}s (cursor: {cursor}s)")
                    
                    if view == "left":
                        # Use left video for this segment - no resizing
                        segment_clip = left_sub.subclip(0, min(seg_dur, left_sub.duration))
                    else:  # right (split removed)
                        # Use right video for this segment - no resizing
                        segment_clip = right_sub.subclip(0, min(seg_dur, right_sub.duration))
                    
                    if segment_clip and segment_clip.duration > 0:
                        segments.append(segment_clip)
                    
                    cursor += seg_dur
                
                if not segments:
                    print(f"[EXTRACT_SLIDER] Warning: No valid segments created for event {event_id}")
                    continue
                
                # Concatenate all segments using chain method to preserve original dimensions
                output_clip = concatenate_videoclips(segments, method="chain")
                
                # Cleanup subclips
                try:
                    left_sub.close()
                    right_sub.close()
                except:
                    pass

            # Add scorecard overlay
            event_type = event.get("eventType", "goal_a")
            if event_type == "goal_a":
                team_a_score += 1
            elif event_type == "goal_b":
                team_b_score += 1
            
            # Create scorecard overlay
            final_clip = create_scorecard_overlay(output_clip, team_a_score, team_b_score, event_type)
            
            # Save clip
            clip_id = str(uuid.uuid4())[:8]
            output_path = os.path.join(session_dir, f"slider_clip_{clip_id}.mp4")
            
            print(f"[EXTRACT_SLIDER] Writing clip {event_id} to {output_path}")
            print(f"[EXTRACT_SLIDER] Scorecard: Team A: {team_a_score}, Team B: {team_b_score}")
            
            try:
                write_video_clip_no_audio(final_clip, output_path)
                
                # Verify file was created
                if os.path.exists(output_path):
                    file_size = os.path.getsize(output_path)
                    print(f"[EXTRACT_SLIDER] ✅ File created successfully: {output_path} ({file_size} bytes)")
                else:
                    print(f"[EXTRACT_SLIDER] ❌ ERROR: File was not created: {output_path}")
                    continue  # Skip this clip if file creation failed
                    
            except Exception as write_error:
                print(f"[EXTRACT_SLIDER] ❌ ERROR writing video file: {write_error}")
                continue  # Skip this clip if writing failed

            # Cleanup subclips
            try:
                left_sub.close()
                right_sub.close()
                if output_clip != left_sub and output_clip != right_sub:
                    output_clip.close()
            except:
                pass

            # Save metadata
            clip_info = {
                "clip_id": clip_id,
                "event_id": event_id,
                "timestamp": (left_start + left_end) / 2,  # Average timestamp
                "start_time": min(left_start, right_start),
                "end_time": max(left_end, right_end),
                "filename": f"slider_clip_{clip_id}.mp4",
                "path": output_path,
                "created_at": datetime.now().isoformat(),
                "session_id": session_id,
                "mode": "slider",
                "view": view,
                "left_range": [left_start, left_end],
                "right_range": [right_start, right_end]
            }
            
            print(f"[EXTRACT_SLIDER] Saving metadata for clip_id: {clip_id}")
            print(f"[EXTRACT_SLIDER] Clip path: {output_path}")
            print(f"[EXTRACT_SLIDER] File exists: {os.path.exists(output_path)}")
            
            # Add switch plan for total view mode
            if view == "total" and views:
                clip_info["switch_plan"] = switch_plan
                clip_info["views"] = views
            clips_data.append(clip_info)

            output_clips.append({
                "eventId": event_id,
                "clip_id": clip_id,
                "path": f"/clip/{clip_id}",
                "view": view
            })

        # Save updated metadata
        save_clips_metadata(clips_data, session_id)

        print(f"[EXTRACT_SLIDER] Successfully processed {len(output_clips)} events")

        return JSONResponse({
            "status": "ok",
            "clips": output_clips,
            "total_clips": len(clips_data)
        })

    except Exception as e:
        print(f"[EXTRACT_SLIDER] ERROR: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        # Cleanup
        for c in [left_clip, right_clip]:
            try:
                if c:
                    c.close()
            except:
                pass
        for p in [temp_left_path, temp_right_path]:
            try:
                if p and os.path.exists(p):
                    os.unlink(p)
            except Exception as cleanup_error:
                print(f"[EXTRACT_SLIDER] Cleanup warning: {cleanup_error}")


@app.post("/convert_aspect")
async def convert_aspect_video(
    video: UploadFile = File(...),
    x_session_id: Optional[str] = Header(None)
):
    """
    Convert a video to 1:1 aspect ratio with 5:4 crop ratio.
    Crops the video to 5:4 (center crop), then stretches to fill 1:1 frame.
    
    Args:
        video: The uploaded video file
        x_session_id: Optional session ID
    
    Returns:
        FileResponse: The converted video with 1:1 aspect ratio
    """
    temp_input_path = None
    clip = None
    session_id = x_session_id or "default"
    session_dir = get_session_dir(session_id)
    
    try:
        print(f"[CONVERT_ASPECT] Session: {session_id}, Converting video to 1:1 (5:4 crop)")
        
        # Check disk space
        if not check_disk_space(session_dir, required_mb=500):
            return JSONResponse(
                status_code=507,
                content={"error": "Insufficient disk space. Please free up at least 500MB and try again."}
            )
        
        # Save uploaded video to temporary file
        temp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        temp_input_path = temp_input.name
        
        video_data = await video.read()
        print(f"[CONVERT_ASPECT] Read {len(video_data)} bytes from uploaded video")
        
        temp_input.write(video_data)
        temp_input.close()
        
        print(f"[CONVERT_ASPECT] Saved uploaded video to: {temp_input_path}")
        
        # Load video
        clip = VideoFileClip(temp_input_path, audio=False)
        original_w, original_h = clip.size
        original_aspect = original_w / original_h
        
        print(f"[CONVERT_ASPECT] Original size: {original_w}x{original_h} (aspect {original_aspect:.2f})")
        
        # Target dimensions: 1:1 aspect ratio
        target_width = 1920
        target_height = 1920
        target_aspect = 1.0 / 1.0
        crop_aspect = 5.0 / 4.0  # 5:4 crop ratio
        
        print(f"[CONVERT_ASPECT] Target: 1:1 aspect ratio ({target_width}x{target_height})")
        print(f"[CONVERT_ASPECT] Crop ratio: 5:4")
        
        # Step 1 & 2: Chain crop and resize operations
        final_clip = None
        try:
            if abs(original_aspect - crop_aspect) < 0.01:
                # Already 5:4, just resize
                print(f"[CONVERT_ASPECT] Already 5:4, resizing to {target_width}x{target_height}")
                final_clip = clip.resize((target_width, target_height))
            elif original_aspect > crop_aspect:
                # Wider than 5:4 - crop sides and resize
                crop_width = int(original_h * crop_aspect)
                print(f"[CONVERT_ASPECT] Cropping sides to {crop_width}x{original_h} and resizing")
                final_clip = clip.fx(crop_fx, width=crop_width, x_center=original_w / 2).resize((target_width, target_height))
            else:
                # Taller than 5:4 - crop top/bottom and resize
                crop_height = int(original_w / crop_aspect)
                print(f"[CONVERT_ASPECT] Cropping top/bottom to {original_w}x{crop_height} and resizing")
                final_clip = clip.fx(crop_fx, height=crop_height, y_center=original_h / 2).resize((target_width, target_height))
        
        except Exception as e:
            print(f"[CONVERT_ASPECT] ERROR processing video: {e}. Falling back to resize only.")
            final_clip = clip.resize((target_width, target_height))

        # Verify final dimensions
        final_w, final_h = final_clip.size
        final_aspect = final_w / final_h
        print(f"[CONVERT_ASPECT] Final size: {final_w}x{final_h} (aspect {final_aspect:.3f}, should be {target_aspect:.3f})")
        
        # Verify the clip has correct dimensions
        if final_w != target_width or final_h != target_height:
            print(f"[CONVERT_ASPECT] WARNING: Dimensions don't match! Expected {target_width}x{target_height}, got {final_w}x{final_h}")
            # Force resize to correct dimensions
            try:
                final_clip = final_clip.resize((target_width, target_height))
                print(f"[CONVERT_ASPECT] Force resized to {target_width}x{target_height}")
            except Exception as e:
                print(f"[CONVERT_ASPECT] ERROR force resizing: {e}")
                import traceback
                traceback.print_exc()
                raise
        
        # Generate output path
        output_filename = f"converted_{str(uuid.uuid4())[:8]}.mp4"
        output_path = os.path.join(session_dir, output_filename)
        
        print(f"[CONVERT_ASPECT] Writing converted video to: {output_path}")
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Write the converted video with 1:1 aspect ratio
        try:
            final_clip.write_videofile(
                output_path,
                codec="libx264",
                audio=False,
                verbose=False,
                logger=None,
                preset='ultrafast',
                threads=4,
                bitrate="2000k",
                ffmpeg_params=[
                    "-crf", "23",
                    "-vf", f"scale={target_width}:{target_height},setsar=1:1",
                    "-aspect", "1:1",
                    "-pix_fmt", "yuv420p"
                ]
            )
        except Exception as e:
            print(f"[CONVERT_ASPECT] ERROR writing video file: {e}")
            import traceback
            traceback.print_exc()
            raise
        
        # Verify output file exists and has content
        if not os.path.exists(output_path):
            raise FileNotFoundError(f"Output file was not created: {output_path}")
        
        file_size = os.path.getsize(output_path)
        if file_size == 0:
            raise ValueError(f"Output file is empty: {output_path}")
        
        print(f"[CONVERT_ASPECT] Video written successfully!")
        print(f"[CONVERT_ASPECT] File size: {file_size} bytes")
        
        # Close clips (avoid closing same clip twice)
        try:
            final_clip.close()
        except:
            pass
        # Only close cropped if it's different from clip
        if clip is not None: # Ensure clip is not None before checking
            try:
                clip.close()
            except:
                pass
        
        # Clean up input file
        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.unlink(temp_input_path)
                print(f"[CONVERT_ASPECT] Cleaned up temp input file")
            except Exception as cleanup_error:
                print(f"[CONVERT_ASPECT] Warning: Could not delete temp file: {cleanup_error}")
        
        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename=output_filename
        )
        
    except Exception as e:
        print(f"[CONVERT_ASPECT] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Cleanup on error
        if clip:
            try:
                clip.close()
            except:
                pass
        
        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.unlink(temp_input_path)
            except:
                pass
        
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Match Highlights Generator API is running!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
