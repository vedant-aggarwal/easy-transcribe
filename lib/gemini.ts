import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// File size limits
export const MAX_AUDIO_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB (Next.js server limit)
export const INLINE_DATA_THRESHOLD = 15 * 1024 * 1024; // 15MB - use inlineData for files smaller than this

// At 128 kbps MP3: 16 KB/sec = ~960 KB/min
// 2 GB = ~2133 minutes = ~35.5 hours of audio at 128 kbps
export const MAX_AUDIO_DURATION_HOURS = 35;

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string) {
  // Validate file size before processing
  if (audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
    throw new Error(
      `Audio file too large (${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB). ` +
      `Maximum size is ${(MAX_AUDIO_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB (~${MAX_AUDIO_DURATION_HOURS} hours at 128 kbps). ` +
      `Please upload a shorter audio file.`
    );
  }

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = 'Transcribe this audio clearly. Preserve meaning and context. Avoid hallucination. Return only the transcription text.';

  try {
    let result;

    // For files < 15MB, use inlineData (faster, no temp file needed)
    if (audioBuffer.length < INLINE_DATA_THRESHOLD) {
      result = await model.generateContent([
        {
          inlineData: {
            data: audioBuffer.toString('base64'),
            mimeType,
          },
        },
        prompt,
      ]);
    } else {
      // For files >= 15MB, use File API (supports up to 2GB)
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const fileManager = new GoogleAIFileManager(apiKey);

      // Write buffer to temporary file
      const tempFilePath = join(tmpdir(), `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);
      await writeFile(tempFilePath, audioBuffer);

      let uploadedFile;
      try {
        // Upload file to Google's File API
        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
          mimeType,
          displayName: `transcription-${Date.now()}`,
        });
        uploadedFile = uploadResponse.file;

        // Wait for file to be processed (required for audio/video files)
        let file = await fileManager.getFile(uploadedFile.name);
        while (file.state === 'PROCESSING') {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          file = await fileManager.getFile(uploadedFile.name);
        }

        if (file.state === 'FAILED') {
          throw new Error('File processing failed on Google servers');
        }

        // Generate content using uploaded file reference
        result = await model.generateContent([
          {
            fileData: {
              fileUri: uploadedFile.uri,
              mimeType: uploadedFile.mimeType,
            },
          },
          prompt,
        ]);

      } finally {
        // Clean up: delete temp file and Google file
        try {
          await unlink(tempFilePath);
        } catch (error) {
          console.error('Failed to delete temp file:', error);
        }

        if (uploadedFile) {
          try {
            await fileManager.deleteFile(uploadedFile.name);
          } catch (error) {
            console.error('Failed to delete uploaded file from Google:', error);
          }
        }
      }
    }

    const response = result.response;
    const text = response.text();

    return {
      transcript: text,
      model: 'gemini-2.5-flash',
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  } catch (error: unknown) {
    // Handle Gemini API errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for payload size errors
    if (errorMessage.includes('PAYLOAD_TOO_LARGE') || errorMessage.includes('TOO_LARGE')) {
      throw new Error(
        `Audio file exceeds Gemini API limits. Maximum size is ${(MAX_AUDIO_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB ` +
        `(~${MAX_AUDIO_DURATION_HOURS} hours at 128 kbps). Please use a shorter audio file.`
      );
    }

    // Re-throw other errors
    throw error;
  }
}

export async function cleanTranscript(text: string) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Clean the following transcript without changing its meaning. Fix grammar, remove filler words (um, uh, like), and correct obvious speech recognition errors. Preserve all domain-specific terms and technical language exactly as they appear. Return only the cleaned text.

Transcript:
${text}`;

  const result = await model.generateContent(prompt);
  const cleaned = result.response.text();

  return { cleaned };
}

export async function improveTranscript(text: string) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Improve the structure and readability of this transcript without altering facts or inventing new content. Use short paragraphs, add section headings where appropriate, and organize with bullet points if helpful. Maintain all original information and meaning. Return only the improved text.

Transcript:
${text}`;

  const result = await model.generateContent(prompt);
  const improved = result.response.text();

  return { improved };
}
