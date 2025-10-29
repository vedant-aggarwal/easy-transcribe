'use client';

import { useState, useRef } from 'react';
import { AudioRecorder, convertToMp3, formatFileSize } from '@/lib/audio';
import { useRouter } from 'next/navigation';

type Status = 'idle' | 'recording' | 'converting' | 'transcribing' | 'processing' | 'error' | 'success';

// Maximum file size limit (2GB - matches server limit)
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_DURATION_HOURS = 35; // ~35 hours at 128 kbps

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [mp3Blob, setMp3Blob] = useState<Blob | null>(null);
  const [rawRecording, setRawRecording] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');

  const recorderRef = useRef<AudioRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Easy Transcribe';

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('converting');
    setMessage('Converting to MP3...');
    setFileName(file.name);
    setTranscript('');
    setRawRecording(null);

    const blob = new Blob([await file.arrayBuffer()], { type: file.type });

    try {
      const mp3 = await convertToMp3(blob);

      // Check file size after conversion
      if (mp3.size > MAX_FILE_SIZE) {
        setStatus('error');
        setMessage(
          `File too large (${formatFileSize(mp3.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)} ` +
          `(~${MAX_DURATION_HOURS} hours). Please upload a shorter audio file.`
        );
        setRawRecording(blob);
        return;
      }

      setMp3Blob(mp3);
      setFileSize(formatFileSize(mp3.size));
      setStatus('success');
      setMessage('Ready to transcribe');
    } catch (error) {
      console.error('Conversion error:', error);
      setStatus('error');
      setMessage('Conversion failed. Try a different file or record audio.');
      setRawRecording(blob);
    }
  }

  async function startRecording() {
    try {
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;
      await recorder.startRecording();
      setStatus('recording');
      setMessage('Recording... Click Stop when done');
      setTranscript('');
      setMp3Blob(null);
      setRawRecording(null);
    } catch (error) {
      console.error('Recording error:', error);
      setStatus('error');
      setMessage('Failed to start recording. Check microphone permissions.');
    }
  }

  async function stopRecording() {
    if (!recorderRef.current) return;

    try {
      const rawBlob = await recorderRef.current.stopRecording();
      setRawRecording(rawBlob);
      setStatus('converting');
      setMessage('Converting to MP3...');

      const mp3 = await convertToMp3(rawBlob);

      // Check file size after conversion
      if (mp3.size > MAX_FILE_SIZE) {
        setStatus('error');
        setMessage(
          `Recording too large (${formatFileSize(mp3.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)} ` +
          `(~${MAX_DURATION_HOURS} hours). Please record a shorter audio.`
        );
        return;
      }

      setMp3Blob(mp3);
      setFileName(`recording-${Date.now()}.mp3`);
      setFileSize(formatFileSize(mp3.size));
      setStatus('success');
      setMessage('Ready to transcribe');
    } catch (error) {
      console.error('Stop recording error:', error);
      setStatus('error');
      setMessage('Processing failed.');
    }
  }

  async function handleTranscribe() {
    if (!mp3Blob) return;

    setStatus('transcribing');
    setMessage('Transcribing with Gemini...');

    try {
      const formData = new FormData();
      formData.append('file', mp3Blob, fileName || 'audio.mp3');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Transcription failed');
      }

      const data = await response.json();
      setTranscript(data.transcript);
      setStatus('success');
      setMessage('Transcription complete');
    } catch (error) {
      console.error('Transcription error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Transcription failed');
    }
  }

  async function handleClean() {
    if (!transcript) return;

    setStatus('processing');
    setMessage('Cleaning transcript...');

    try {
      const response = await fetch('/api/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });

      if (!response.ok) throw new Error('Cleaning failed');

      const data = await response.json();
      setTranscript(data.cleaned);
      setStatus('success');
      setMessage('Transcript cleaned');
    } catch {
      setStatus('error');
      setMessage('Cleaning failed');
    }
  }

  async function handleImprove() {
    if (!transcript) return;

    setStatus('processing');
    setMessage('Improving transcript...');

    try {
      const response = await fetch('/api/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });

      if (!response.ok) throw new Error('Improvement failed');

      const data = await response.json();
      setTranscript(data.improved);
      setStatus('success');
      setMessage('Transcript improved');
    } catch {
      setStatus('error');
      setMessage('Improvement failed');
    }
  }

  function handleCopy() {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setMessage('Copied to clipboard');
  }

  async function handleShare() {
    if (!transcript) return;

    if (navigator.share) {
      try {
        await navigator.share({ text: transcript, title: 'Transcript' });
      } catch (error) {
        console.error('Share error:', error);
      }
    } else {
      handleCopy();
    }
  }

  function handleDownloadMp3() {
    if (!mp3Blob) return;
    const url = URL.createObjectURL(mp3Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'audio.mp3';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadRaw() {
    if (!rawRecording) return;
    const url = URL.createObjectURL(rawRecording);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raw-recording.webm';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRetry() {
    setStatus('idle');
    setMessage('');
    setMp3Blob(null);
    setRawRecording(null);
    setTranscript('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const isProcessing = ['recording', 'converting', 'transcribing', 'processing'].includes(status);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8 pt-4">
          <h1 className="text-2xl font-bold text-gray-900">{appName}</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Logout
          </button>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {/* Info Banner */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Max file size:</span> {formatFileSize(MAX_FILE_SIZE)} (~{MAX_DURATION_HOURS} hours at 128 kbps)
            </p>
          </div>

          <div className="space-y-4">
            {/* Upload Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Audio/Video
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*"
                onChange={handleFileSelect}
                disabled={isProcessing}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            {/* Record Section */}
            <div>
              {status !== 'recording' ? (
                <button
                  onClick={startRecording}
                  disabled={isProcessing && status !== 'idle'}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Record Audio
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Stop Recording
                </button>
              )}
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm ${
              status === 'error' ? 'bg-red-50 text-red-700' :
              status === 'success' ? 'bg-green-50 text-green-700' :
              'bg-blue-50 text-blue-700'
            }`}>
              {message}
              {fileName && fileSize && (
                <div className="mt-1 text-xs">
                  {fileName} ({fileSize})
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {mp3Blob && (
            <div className="mt-4 flex gap-2 flex-wrap">
              {!transcript && (
                <button
                  onClick={handleTranscribe}
                  disabled={isProcessing}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Transcribe
                </button>
              )}
              <button
                onClick={handleDownloadMp3}
                disabled={isProcessing}
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download MP3
              </button>
            </div>
          )}

          {/* Error Recovery Buttons */}
          {status === 'error' && (
            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                onClick={handleRetry}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Retry
              </button>
              {rawRecording && (
                <button
                  onClick={handleDownloadRaw}
                  className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Download Raw Recording
                </button>
              )}
            </div>
          )}
        </div>

        {/* Transcript Display */}
        {transcript && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Transcript</h2>

            <div className="mb-4 p-4 bg-gray-50 rounded-md max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                {transcript}
              </pre>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleCopy}
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Copy
              </button>
              <button
                onClick={handleShare}
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Share
              </button>
              <button
                onClick={handleClean}
                disabled={isProcessing}
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clean Transcript
              </button>
              <button
                onClick={handleImprove}
                disabled={isProcessing}
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Improve
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
