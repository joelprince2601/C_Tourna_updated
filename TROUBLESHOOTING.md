# 🔧 Troubleshooting Guide - Match Highlights Generator

## ✅ Recent Fixes Applied

### Enhanced Error Handling & Logging
- ✅ Added detailed logging for every step of clip extraction
- ✅ Added detailed logging for highlights generation
- ✅ Better error messages with full stack traces
- ✅ Proper cleanup of temporary files on errors
- ✅ Video duration validation
- ✅ Optimized video encoding settings

### Video Processing Improvements
- ✅ Added `preset='ultrafast'` for faster encoding
- ✅ Added `threads=4` for multi-threaded processing
- ✅ Better handling of video duration limits
- ✅ Proper temp audio file management
- ✅ Automatic cleanup of temporary files

## 🐛 Common Errors & Solutions

### Error 1: "Error extracting clip" in Event Log

**Possible Causes:**
1. Video format not supported
2. Video file corrupted
3. Timestamp exceeds video duration
4. MoviePy/FFmpeg issue

**Solutions:**

**Check Backend Logs:**
```bash
# Look for [EXTRACT] messages in the backend terminal
# You should see:
[EXTRACT] Starting clip extraction at timestamp X
[EXTRACT] Read XXXXX bytes from uploaded video
[EXTRACT] Saved uploaded video to: /path/to/temp.mp4
[EXTRACT] Clip range: Xs to Ys
[EXTRACT] Loading video file...
[EXTRACT] Video duration: XXs
[EXTRACT] Extracting subclip...
[EXTRACT] Writing video file...
[EXTRACT] Video file written successfully!
```

**If you see errors:**

1. **"No such file or directory"**
   - Check if CLIPS_DIR exists
   - Solution: Restart backend (it creates the directory on startup)

2. **"codec not found" or "ffmpeg error"**
   - FFmpeg not properly installed
   - Solution: Install imageio-ffmpeg
   ```bash
   cd backend
   .\venv\Scripts\pip.exe install imageio-ffmpeg
   ```

3. **"Invalid timestamp" or "duration exceeded"**
   - Trying to extract clip beyond video end
   - Solution: Code now auto-adjusts end time to video duration

4. **"Permission denied"**
   - Temp directory not writable
   - Solution: Check Windows temp folder permissions

### Error 2: "Error generating highlights"

**Possible Causes:**
1. No clips saved yet
2. Clip files were deleted
3. Concatenation failed
4. Disk space full

**Solutions:**

**Check Backend Logs:**
```bash
# Look for [HIGHLIGHTS] messages
[HIGHLIGHTS] Found X clips in metadata
[HIGHLIGHTS] Checking clip: /path/to/clip_xxx.mp4
[HIGHLIGHTS] Loading clip: /path/to/clip_xxx.mp4
[HIGHLIGHTS] Concatenating X clips...
[HIGHLIGHTS] Writing combined video...
[HIGHLIGHTS] Video written successfully!
[HIGHLIGHTS] File size: XXXXX bytes
```

**If you see errors:**

1. **"No clips available"**
   - No clips have been saved yet
   - Solution: Mark some events first, wait for green checkmarks

2. **"No valid clip files found"**
   - Clip files were deleted or moved
   - Solution: Clear clips and mark new events

3. **"Concatenation failed"**
   - Clips have different formats/codecs
   - Solution: All clips should be from same video (this is normal usage)

4. **"Disk space full"**
   - Not enough space for combined video
   - Solution: Free up disk space or clear old clips

### Error 3: Video Player Shows "Error" or Blank

**Possible Causes:**
1. Browser doesn't support video format
2. Video file corrupted
3. CORS issue
4. Blob URL expired

**Solutions:**

1. **Check Browser Console (F12)**
   - Look for error messages
   - Check Network tab for failed requests

2. **Try Different Browser**
   - Chrome/Edge usually have best video support
   - Firefox may have codec issues

3. **Check Video Format**
   - Should be MP4 with H.264 codec
   - AAC audio codec

4. **Refresh Page**
   - Blob URLs can expire
   - Regenerate highlights if needed

### Error 4: Download Doesn't Work

**Possible Causes:**
1. Browser blocking download
2. Blob URL issue
3. File permissions

**Solutions:**

1. **Right-click Video → "Save video as..."**
   - Manual download method
   - Always works

2. **Check Browser Download Settings**
   - Allow downloads from localhost
   - Check download folder permissions

3. **Try Different Browser**
   - Some browsers handle blob downloads better

## 📊 How to Check Logs

### Backend Logs (Terminal)
The backend terminal shows detailed logs for every operation:

```bash
# Clip Extraction Logs
[EXTRACT] Starting clip extraction at timestamp 15.5
[EXTRACT] Read 5242880 bytes from uploaded video
[EXTRACT] Saved uploaded video to: C:\Users\...\tmp\tmpxxx.mp4
[EXTRACT] Clip range: 5.5s to 25.5s
[EXTRACT] Output path: C:\Users\...\video_clips\clip_a3f2b7e9.mp4
[EXTRACT] Loading video file...
[EXTRACT] Video duration: 120.5s
[EXTRACT] Extracting subclip from 5.5s to 25.5s...
[EXTRACT] Writing video file to C:\Users\...\video_clips\clip_a3f2b7e9.mp4...
[EXTRACT] Video file written successfully!
[EXTRACT] Cleaned up temp input file
[EXTRACT] Clip metadata saved. Total clips: 3

# Highlights Generation Logs
[HIGHLIGHTS] Found 3 clips in metadata
[HIGHLIGHTS] Checking clip: C:\Users\...\video_clips\clip_a3f2b7e9.mp4
[HIGHLIGHTS] Loading clip: C:\Users\...\video_clips\clip_a3f2b7e9.mp4
[HIGHLIGHTS] Checking clip: C:\Users\...\video_clips\clip_b7e9c4d2.mp4
[HIGHLIGHTS] Loading clip: C:\Users\...\video_clips\clip_b7e9c4d2.mp4
[HIGHLIGHTS] Checking clip: C:\Users\...\video_clips\clip_c4d2e5f3.mp4
[HIGHLIGHTS] Loading clip: C:\Users\...\video_clips\clip_c4d2e5f3.mp4
[HIGHLIGHTS] Concatenating 3 clips...
[HIGHLIGHTS] Writing combined video to: C:\Users\...\video_clips\match_highlights.mp4
[HIGHLIGHTS] Removed old highlights file
[HIGHLIGHTS] Video written successfully!
[HIGHLIGHTS] File size: 15728640 bytes
[HIGHLIGHTS] Returning file: C:\Users\...\video_clips\match_highlights.mp4
```

### Frontend Logs (Browser Console - F12)
Open browser console to see frontend logs:

```javascript
// Clip Extraction
Requesting clip extraction at timestamp: 15.5
Clip saved successfully: {clip_id: "a3f2b7e9", ...}

// Highlights Generation
Requesting highlights from backend...
Highlights received, creating blob URL...
Highlights ready! Blob URL: blob:http://localhost:5173/xxx-xxx-xxx
```

## 🔍 Debugging Steps

### Step 1: Verify Servers Are Running

**Backend:**
```bash
curl http://localhost:8000/
# Should return: {"message":"Match Highlights Generator API is running!"}
```

**Frontend:**
```bash
# Open http://localhost:5173 in browser
# Should see the application UI
```

### Step 2: Test Clip Extraction

1. Upload a short test video (30-60 seconds)
2. Play video for 10 seconds
3. Click "Mark Event" button
4. **Watch backend terminal** for [EXTRACT] logs
5. **Watch frontend** for event log entry
6. Entry should turn green with ✅ Saved

**If it fails:**
- Check backend logs for error message
- Check browser console for errors
- Verify video format (MP4 recommended)

### Step 3: Test Highlights Generation

1. Mark 2-3 events (wait for all to turn green)
2. Click "Generate Highlights Video"
3. **Watch backend terminal** for [HIGHLIGHTS] logs
4. **Watch for success alert** in browser
5. Video player should appear and auto-play

**If it fails:**
- Check backend logs for error message
- Verify all clips show green checkmarks
- Check disk space
- Try with fewer clips first (2 clips)

## 🎯 Best Practices

### For Reliable Operation:

1. **Use MP4 Videos**
   - Best compatibility
   - H.264 video codec
   - AAC audio codec

2. **Keep Videos Reasonable Size**
   - Under 500MB recommended
   - Under 30 minutes duration
   - 1080p or lower resolution

3. **Wait for Green Checkmarks**
   - Don't generate highlights while clips are processing
   - All events should show ✅ Saved

4. **Clear Clips Regularly**
   - Prevents disk space issues
   - Keeps metadata clean
   - Use "Clear All Clips" button

5. **Check Logs When Issues Occur**
   - Backend terminal shows detailed info
   - Browser console shows frontend errors
   - Both are needed for full picture

## 🚨 Emergency Fixes

### If Everything Breaks:

1. **Restart Both Servers**
   ```bash
   # Kill both terminals (Ctrl+C)
   # Restart backend
   cd backend
   python -m uvicorn main:app --reload --port 8000
   
   # Restart frontend
   cd frontend
   npm run dev
   ```

2. **Clear All Data**
   ```bash
   # Delete clips directory
   # Windows: C:\Users\YourName\AppData\Local\Temp\video_clips
   # The backend will recreate it on next request
   ```

3. **Reinstall Dependencies**
   ```bash
   cd backend
   .\venv\Scripts\pip.exe install --force-reinstall moviepy imageio-ffmpeg
   ```

4. **Check Python/Node Versions**
   ```bash
   python --version  # Should be 3.8+
   node --version    # Should be 18+
   ```

## 📞 Getting Help

When reporting issues, please provide:

1. **Backend logs** (copy from terminal)
2. **Browser console logs** (F12 → Console tab)
3. **Video format** (codec, resolution, duration)
4. **Steps to reproduce** the error
5. **Operating system** and versions

## ✅ Verification Checklist

Before reporting an issue, verify:

- [ ] Backend is running on port 8000
- [ ] Frontend is running on port 5173
- [ ] Video file is MP4 format
- [ ] Video file is under 500MB
- [ ] Checked backend terminal for errors
- [ ] Checked browser console for errors
- [ ] Tried with a different video file
- [ ] Tried clearing clips and starting fresh
- [ ] Restarted both servers

## 🎉 Success Indicators

Everything is working when you see:

**Backend Terminal:**
- `INFO: Uvicorn running on http://127.0.0.1:8000`
- `[EXTRACT] Video file written successfully!`
- `[HIGHLIGHTS] Video written successfully!`

**Frontend:**
- Event log shows ✅ Saved for all events
- Success alert: "🎉 Highlights video generated successfully!"
- Video player appears with green border
- Video auto-plays
- Download button works

**Browser Console:**
- No red error messages
- "Highlights ready! Blob URL: ..." message

