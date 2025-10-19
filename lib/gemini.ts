import { GoogleGenerativeAI } from '@google/generative-ai';

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string) {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = 'Transcribe this audio clearly. Preserve meaning and context. Avoid hallucination. Return only the transcription text.';

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
