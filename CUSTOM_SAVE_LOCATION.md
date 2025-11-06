# 💾 Custom Save Location - USER CHOOSES WHERE TO SAVE!

## ✅ **Problem SOLVED!**

You no longer have to worry about disk space errors! The application now lets YOU choose where to save your video clips.

## 🎯 **How It Works:**

### **Step 1: Choose Your Save Location**

When you open the application, you'll see a new section at the top:

```
💾 Step 1: Set Save Location
Choose where to save your video clips (e.g., D:\Videos or C:\Users\YourName\Desktop)

[Enter folder path] [Set Location]
```

### **Step 2: Enter a Path**

Enter any folder path where you have space, for example:
- `D:\Videos`
- `D:\MyClips`
- `C:\Users\YourName\Desktop\Highlights`
- `E:\Storage\VideoClips`

### **Step 3: Click "Set Location"**

The application will:
- ✅ Check if the folder exists
- ✅ Check if you have write permissions
- ✅ Check how much free space is available
- ✅ Show you the free space in GB

### **Step 4: Upload Your Video**

Once the location is set, you can upload your video and start marking events!

## 📊 **What You'll See:**

### **Before Setting Location:**
```
💾 Step 1: Set Save Location
[D:\Videos                    ] [Set Location]

📁 Step 2: Upload Video (Set location first)
⚠️ Please set a save location first
```

### **After Setting Location:**
```
💾 Step 1: Set Save Location ✅
💾 Free space: 45.23 GB
📁 Saving to: D:\Videos
[D:\Videos                    ] [✅ Location Set]

📁 Step 2: Upload Video
[Choose File]
```

## 🗂️ **Where Files Are Saved:**

Your clips will be saved in a session folder inside your chosen location:

```
D:\Videos\
└── highlights_session_1760090835329_samgh7gza\
    ├── clip_55ad3be2.mp4 (18 MB)
    ├── clip_41655128.mp4 (18 MB)
    ├── clip_f6700841.mp4 (18 MB)
    ├── clip_d8b79662.mp4 (18 MB)
    ├── clip_bf7ec974.mp4 (18 MB)
    ├── clip_a1b2c3d4.mp4 (18 MB)
    ├── clip_e5f6g7h8.mp4 (18 MB)
    ├── match_highlights.mp4 (126 MB)
    └── clips_metadata.json
```

## 💡 **Recommended Locations:**

### **Best Options:**
1. **External Drive** (if you have one)
   - `E:\VideoClips`
   - `F:\Highlights`
   - Usually has lots of space!

2. **D: Drive** (if you have one)
   - `D:\Videos`
   - `D:\Highlights`
   - Usually more space than C: drive

3. **Desktop** (easy to find)
   - `C:\Users\YourName\Desktop\Highlights`
   - Easy to access and manage

4. **Documents** (organized)
   - `C:\Users\YourName\Documents\VideoHighlights`
   - Keeps things organized

### **Space Requirements:**

For **7 clips** (20 seconds each):
- Each clip: ~18 MB
- 7 clips: ~126 MB
- Highlights video: ~126 MB
- **Total needed: ~300 MB**

**Recommendation:** Choose a location with at least **1 GB free space** to be safe!

## 🔒 **Security & Validation:**

The application checks:
1. ✅ **Folder exists** - Path must be valid
2. ✅ **Write permissions** - You must have permission to write files
3. ✅ **Free space** - Shows you how much space is available
4. ✅ **Test write** - Creates a test file to verify it works

## 🎬 **Complete Workflow:**

### **1. Open Application**
```
http://localhost:5173
```

### **2. Set Save Location**
```
Enter path: D:\Videos
Click: "Set Location"
See: ✅ Save location set successfully!
     Free space: 45.23 GB
```

### **3. Upload Video**
```
Click: "Choose File"
Select: your_video.mp4
```

### **4. Mark Events**
```
Play video
Click "Mark Event" 6-7 times
Wait for green checkmarks (✅ Saved)
```

### **5. Generate Highlights**
```
Click: "Generate Highlights Video"
Wait: Video processing...
See: Video appears and auto-plays!
```

### **6. Download**
```
Click: "Download Highlights"
File saves to your Downloads folder
```

### **7. Find Your Clips**
```
Go to: D:\Videos\highlights_session_xxx\
See: All your clips + highlights video!
```

## 🚨 **Error Messages & Solutions:**

### **"Directory does not exist"**
**Problem:** The path you entered doesn't exist

**Solution:**
1. Create the folder first in Windows Explorer
2. Or use an existing folder path
3. Make sure the path is correct (check spelling)

### **"Directory is not writable"**
**Problem:** You don't have permission to write to that folder

**Solution:**
1. Choose a different folder
2. Or right-click folder → Properties → Security → Give yourself write permission

### **"Insufficient disk space"**
**Problem:** Not enough space in the chosen location

**Solution:**
1. Choose a different drive with more space
2. Or free up space in the current location
3. Delete old files you don't need

## 📝 **Backend Logs:**

When you set a save location, you'll see:

```
[SAVE_LOCATION] Session session_xxx set to: D:\Videos
[SAVE_LOCATION] Free space: 45.23 GB
```

When extracting clips:

```
[SESSION] Using directory: D:\Videos\highlights_session_xxx
[DISK] Free space: 45230.45 MB
[EXTRACT] Writing video file (no audio) to D:\Videos\highlights_session_xxx\clip_xxx.mp4...
[EXTRACT] Video file written successfully!
```

## 🎉 **Benefits:**

### **Before (Automatic Location):**
- ❌ Used C: drive temp folder (limited space)
- ❌ Hard to find your clips
- ❌ "No space left on device" errors
- ❌ No control over location

### **After (User Chooses Location):**
- ✅ You choose where to save (any drive!)
- ✅ Easy to find your clips
- ✅ No space errors (you pick a drive with space)
- ✅ Full control over location
- ✅ Can use external drives
- ✅ See free space before starting

## 💾 **Space Management:**

### **Check Free Space:**
The application shows you free space when you set the location:
```
💾 Free space: 45.23 GB
```

### **Estimate Your Needs:**
- 1 clip (20 sec) = ~18 MB
- 5 clips = ~90 MB
- 7 clips = ~126 MB
- 10 clips = ~180 MB
- Highlights video = same as total clips

**Rule of thumb:** Need about **2x the total clip size** (for clips + highlights)

### **Clean Up Old Sessions:**
After you're done, you can delete old session folders:
```
D:\Videos\highlights_session_old_xxx\  ← Delete this when done
```

## 🔄 **Session Isolation:**

Each time you refresh the page or open a new tab:
- New session ID is created
- New session folder is created
- Your clips are isolated from other sessions
- No interference between different videos

## 🎯 **Pro Tips:**

### **1. Use External Drive**
If you have an external USB drive or external hard drive:
- Usually has LOTS of space
- Example: `E:\VideoClips`
- Perfect for video storage!

### **2. Create a Dedicated Folder**
Create a folder just for highlights:
```
D:\VideoHighlights\
```
Then all your sessions go there, easy to manage!

### **3. Check Space First**
Before starting, check your drive space:
- Right-click drive in Windows Explorer
- Click "Properties"
- See "Free space"
- Make sure you have at least 1 GB free

### **4. Clean Up Regularly**
After downloading your highlights:
- Delete the session folder
- Frees up space for next time
- Keeps things organized

## 🚀 **Ready to Use!**

1. **Refresh the page** to get the new interface
2. **Set your save location** (e.g., D:\Videos)
3. **Upload your video**
4. **Mark 6-7 events**
5. **Generate highlights**
6. **Download and enjoy!**

No more disk space errors! You're in control! 🎊

