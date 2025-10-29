import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';
import { transcribeAudio, MAX_AUDIO_SIZE_BYTES, MAX_AUDIO_DURATION_MINUTES } from '@/lib/gemini';

// Allow large file uploads (up to 2GB)
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max execution time

export async function POST(request: NextRequest) {
  try {
    // Check for password in form data or Authorization header
    const authHeader = request.headers.get('authorization');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const passwordFromForm = formData.get('password') as string;

    let password = passwordFromForm;

    // If no password in form, check Authorization header
    if (!password && authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        password = authHeader.substring(7);
      } else if (authHeader.startsWith('Basic ')) {
        // Decode Basic auth (format: Basic base64(username:password))
        const decoded = Buffer.from(authHeader.substring(6), 'base64').toString();
        password = decoded.split(':')[1]; // Take password part
      }
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Password required (provide via form data or Authorization header)' },
        { status: 401 }
      );
    }

    if (!verifyPassword(password)) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 403 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate file size
    if (buffer.length > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: 'File too large',
          details: `File size: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Maximum allowed: ${MAX_AUDIO_SIZE_BYTES / 1024 / 1024}MB (~${MAX_AUDIO_DURATION_MINUTES} minutes at 128 kbps)`,
        },
        { status: 413 }
      );
    }

    const result = await transcribeAudio(buffer, file.type);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Automation transcription error:', error);
    return NextResponse.json(
      { error: 'Transcription failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
