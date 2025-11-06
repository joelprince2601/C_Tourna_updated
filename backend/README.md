# Video Event Clip Extractor - Backend

FastAPI backend for extracting video clips around specific timestamps.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the server:
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

- `GET /` - Health check
- `POST /extract` - Extract video clip around timestamp
  - Form data:
    - `video`: Video file (multipart/form-data)
    - `timestamp`: Float timestamp in seconds

## Example Usage

```bash
curl -X POST "http://localhost:8000/extract" \
  -F "video=@your_video.mp4" \
  -F "timestamp=30.5" \
  --output extracted_clip.mp4
```
