# Easy Transcribe

AI-powered audio transcription application using Google Gemini 2.5 Flash. Upload or record audio, convert to MP3 in-browser, and get accurate transcriptions with AI-powered cleaning and improvement options.

## Features

- Password-protected access with 30-day cookie sessions
- Upload audio/video files or record directly in browser
- Client-side MP3 conversion (original files never leave your browser)
- AI transcription using Google Gemini 2.5 Flash
- Clean and improve transcripts with AI
- Download converted MP3 files
- Automation API for external workflows (Make, Zapier, etc.)
- No database required
- Vercel-ready deployment

## Quick Start

### 1. Environment Variables

Create a `.env` file in the project root:

```env
APP_PASSWORD=your-secure-password
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_APP_NAME=Easy Transcribe
```

**Required:**
- `APP_PASSWORD` - Password for login and API access
- `GEMINI_API_KEY` - Google AI Studio API key ([get one here](https://aistudio.google.com/apikey))

**Optional:**
- `NEXT_PUBLIC_APP_NAME` - Customize the app name (default: "Easy Transcribe")

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with your password.

### 4. Build for Production

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push your code to GitHub (exclude `.env` from commits)
2. Import your repository in Vercel
3. Add environment variables in Vercel project settings:
   - `APP_PASSWORD`
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_APP_NAME` (optional)
4. Deploy

The app will work immediately with no additional configuration.

## API Routes

### Web UI Routes (Require Login Cookie)

- **POST** `/api/login` - Log in with password
- **POST** `/api/logout` - Log out
- **POST** `/api/transcribe` - Transcribe audio file
- **POST** `/api/clean` - Clean transcript
- **POST** `/api/improve` - Improve transcript structure

### Automation API (For External Tools)

**POST** `/api/automation/transcribe`

External endpoint for Make, Zapier, or custom scripts. Returns raw transcription JSON.

**Authentication:**
- Form field: `password=your-app-password`
- OR Bearer token: `Authorization: Bearer your-app-password`
- OR Basic auth: `Authorization: Basic base64(username:password)`

**Request:**
```bash
curl -X POST https://your-app.vercel.app/api/automation/transcribe \
  -F "file=@audio.mp3" \
  -F "password=your-app-password"
```

**Response:**
```json
{
  "transcript": "Your transcribed text here...",
  "model": "gemini-2.5-flash",
  "usage": {
    "promptTokens": 1234,
    "completionTokens": 567,
    "totalTokens": 1801
  }
}
```

**Error Responses:**
- `401` - Missing password
- `403` - Invalid password
- `400` - No file provided
- `500` - Transcription failed

## File Size Limits & Browser Constraints

### Server Upload Limits

- **Max upload size:** 2GB (configured for API routes)
- **Max execution time:** 5 minutes per request
- **Max audio duration:** 9.5 hours per request (Gemini API limit)
- **Audio processing:** Files are downsampled to 16 kHz mono by Gemini

### Browser Constraints

- **Recording format:** WebM (browser-dependent codec)
- **Converted format:** MP3 at 128 kbps, 16 kHz, mono
- **Browser memory limits:** Files over 500MB may fail during in-browser MP3 conversion
- **Microphone access:** Requires HTTPS in production (or localhost for dev)

### Recommendations

- **For files under 500MB:** Upload and convert in browser works great
- **For files 500MB-2GB:** Browser conversion may fail due to memory; use pre-converted MP3 files
- **Best performance:** Keep audio files under 100 MB
- **Large files:** For optimal results with very large files, pre-convert to MP3 before upload
- Ensure stable internet connection for transcription requests

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── automation/transcribe/  # External automation endpoint
│   │   ├── clean/                  # Clean transcript
│   │   ├── improve/                # Improve transcript
│   │   ├── login/                  # Login endpoint
│   │   ├── logout/                 # Logout endpoint
│   │   └── transcribe/             # Main transcription endpoint
│   ├── login/                      # Login page
│   ├── page.tsx                    # Main app UI
│   └── layout.tsx                  # Root layout
├── lib/
│   ├── auth.ts                     # Authentication utilities
│   ├── audio.ts                    # Audio recording & MP3 conversion
│   └── gemini.ts                   # Gemini API integration
├── middleware.ts                   # Auth middleware
└── .env.example                    # Environment template
```

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI Model:** Google Gemini 2.5 Flash
- **Audio Encoding:** lamejs (MP3 encoder, loaded from CDN)
- **Deployment:** Vercel

## Troubleshooting

### Microphone not working
- Ensure site is served over HTTPS (or localhost)
- Check browser permissions for microphone access

### Transcription fails
- Verify `GEMINI_API_KEY` is correct and has quota
- Check file format is supported (most audio/video formats work)
- Ensure audio duration is under 9.5 hours

### Conversion fails
- Try a different file format
- Check browser console for specific errors
- Use "Download Raw Recording" and re-upload if needed

### Production build fails
- Ensure all environment variables are set
- Check for TypeScript errors: `npm run build`

## License

MIT
