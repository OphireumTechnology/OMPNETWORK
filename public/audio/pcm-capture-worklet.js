/**
 * OPHIREUM Real-Time Voice Capture AudioWorkletProcessor
 * Downsamples browser microphone Float32 frames to 16kHz 16-bit PCM (little-endian),
 * computes RMS energy for voice activity detection (VAD), and emits 100ms chunks.
 * Raw audio is streamed transiently to the backend gateway and never persisted.
 */
class OphireumPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetSampleRate = (options && options.processorOptions && options.processorOptions.targetSampleRate) || 16000;
    this.chunkSamples = Math.floor(this.targetSampleRate * 0.1); // 100ms = 1600 samples at 16kHz
    this.buffer = new Int16Array(this.chunkSamples);
    this.writeOffset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channel = input[0];
    const ratio = sampleRate / this.targetSampleRate;
    const outputLength = Math.max(1, Math.floor(channel.length / ratio));

    let sumSq = 0;
    for (let i = 0; i < outputLength; i += 1) {
      const srcIdx = Math.min(channel.length - 1, Math.floor(i * ratio));
      const clamped = Math.max(-1, Math.min(1, channel[srcIdx]));
      sumSq += clamped * clamped;
      this.buffer[this.writeOffset] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      this.writeOffset += 1;

      if (this.writeOffset >= this.chunkSamples) {
        const rms = Math.sqrt(sumSq / Math.max(1, i + 1));
        const pcmCopy = this.buffer.slice(0);
        this.port.postMessage({ type: 'pcm16', buffer: pcmCopy.buffer, rms }, [pcmCopy.buffer]);
        this.writeOffset = 0;
        sumSq = 0;
      }
    }

    return true;
  }
}

registerProcessor('ophireum-pcm-capture', OphireumPcmCaptureProcessor);
