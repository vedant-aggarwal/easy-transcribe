import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini API limits: ~20MB for base64 inlineData payload
// Base64 encoding increases size by ~33%, so binary limit is ~15MB
export const MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

// At 128 kbps MP3: 16 KB/sec = ~960 KB/min
// 15 MB = ~15.6 minutes of audio at 128 kbps
export const MAX_AUDIO_DURATION_MINUTES = 15;

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
      `Maximum size is ${MAX_AUDIO_SIZE_BYTES / 1024 / 1024}MB (~${MAX_AUDIO_DURATION_MINUTES} minutes at 128 kbps). ` +
      `Please upload a shorter audio file.`
    );
  }
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = 'Transcribe this audio clearly. Preserve meaning and context. Avoid hallucination. Return only the transcription text.';

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType,
        },
      },
      prompt,
    ]);

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
        `Audio file exceeds Gemini API limits. Maximum size is ${MAX_AUDIO_SIZE_BYTES / 1024 / 1024}MB ` +
        `(~${MAX_AUDIO_DURATION_MINUTES} minutes at 128 kbps). Please use a shorter audio file.`
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
