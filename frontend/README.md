# Video Event Clip Extractor - Frontend

React frontend for the Video Event Clip Extractor application. Built with Vite, React, and custom CSS.

## Features

- 🎬 Video file upload and preview
- ⏯️ Video playback controls
- 🎯 Event marking at specific timestamps
- 📥 Clip extraction and download
- 🎨 Modern, responsive UI with custom CSS styling

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Usage

1. Upload a video file using the file input
2. Play the video and navigate to the moment you want to capture
3. Click "Mark Event & Extract Clip" to create a 20-second clip (±10 seconds around the timestamp)
4. Download your extracted clip!

## Technologies Used

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Custom CSS** - Modern responsive styling
- **Axios** - HTTP client for API requests

## API Integration

The frontend communicates with the FastAPI backend running on `http://localhost:8000`. Make sure the backend server is running before using the application.

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.
