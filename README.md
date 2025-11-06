# 🏆 Match Highlights Generator

A full-stack application for creating highlight reels from video content. Upload a video, mark multiple exciting moments, and generate a combined highlights video ready for download!

## 🚀 Features

- **Video Upload & Preview**: Upload any video format and preview it in the browser
- **Multiple Event Marking**: Mark multiple exciting moments during video playback
- **Automatic Clip Extraction**: Get 20-second clips (10 seconds before and after each marked timestamp)
- **Highlights Generation**: Combine all saved clips into one seamless highlights video
- **Clip Management**: View saved clips count and clear all clips when needed
- **Instant Download**: Download individual clips or the complete highlights video
- **Modern UI**: Clean, responsive interface with custom CSS styling
- **Fast Processing**: Efficient video processing with MoviePy

## 🏗️ Architecture

### Backend (Python + FastAPI)

- **FastAPI** for the REST API
- **MoviePy** for video processing and clipping
- **CORS** enabled for frontend communication
- Handles video upload, timestamp processing, and clip generation

### Frontend (React + Vite)

- **React 18** with modern hooks
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Axios** for API communication
- Responsive design with video controls

## 📦 Installation & Setup

### Prerequisites

- Python 3.8+
- Node.js 18+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:

```bash
cd backend
```

2. Create a virtual environment:

```bash
python -m venv venv
venv\Scripts\activate
```

3. Install Python dependencies:

```bash
pip install -r requirements.txt
```

4. Start the FastAPI server:

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

The backend API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install Node.js dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 🎯 Usage

1. **Start both servers** (backend on port 8000, frontend on port 5174)
2. **Open your browser** to `http://localhost:5174`
3. **Upload a video** (match recording, gameplay, etc.)
4. **Play the video** and navigate to exciting moments
5. **Click "Mark Event & Save Clip"** for each highlight you want
6. **Repeat step 5** for all the moments you want to include
7. **Click "Generate Highlights Video"** to combine all clips
8. **Download** your complete match highlights video!

## 🛠️ API Endpoints

### `POST /extract`

Extracts a video clip around the specified timestamp.

**Parameters:**

- `video` (file): The video file to process
- `timestamp` (float): The timestamp in seconds where the event occurred

**Response:**

- Returns the extracted video clip as a downloadable MP4 file

### `GET /`

Health check endpoint to verify the API is running.

## 🎨 Technologies Used

### Backend

- **FastAPI** - Modern, fast web framework for Python
- **MoviePy** - Video editing library
- **Uvicorn** - ASGI server
- **Python Multipart** - File upload handling

### Frontend

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client

## 📝 Project Structure

```
tourna_vid_cliper/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── README.md           # Backend documentation
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   ├── main.jsx        # React entry point
│   │   └── index.css       # Tailwind CSS imports
│   ├── package.json        # Node.js dependencies
│   ├── tailwind.config.js  # Tailwind configuration
│   └── README.md          # Frontend documentation
└── README.md              # This file
```

## 🔧 Development

### Backend Development

- The FastAPI server runs with auto-reload enabled
- API documentation available at `http://localhost:8000/docs`
- Logs are displayed in the terminal

### Frontend Development

- Vite provides hot module replacement (HMR)
- Changes are reflected immediately in the browser
- Tailwind CSS classes are compiled on-demand

## 🚀 Production Deployment

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm run build
# Serve the dist/ directory with your preferred web server
```

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Issues

If you encounter any issues, please create an issue on the GitHub repository.
