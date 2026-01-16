/**
 * Audio Sensor - Real-time audio stress analysis
 */

export interface AudioData {
  rms: number; // 0-1
  pitch: number;
  pitchVariance: number; // 0-1
  spikeCount: number;
  stress: number;
}

export class AudioSensor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isActive = false;
  private pitchBuffer: number[] = [];
  private spikeThreshold = 0.7; // Normal threshold
  private spikeCount = 0;
  private presentationMode = false; // Sensitivity only in presentation mode

  async initialize(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.isActive = true;
    } catch (error) {
      console.error('Failed to initialize audio sensor:', error);
      throw error;
    }
  }

  setPresentationMode(enabled: boolean): void {
    this.presentationMode = enabled;
    // Adjust sensitivity based on presentation mode
    this.spikeThreshold = enabled ? 0.35 : 0.7; // More sensitive in presentation mode
  }

  getAudioData(): AudioData {
    if (!this.analyser || !this.isActive) {
      return {
        rms: 0,
        pitch: 0,
        pitchVariance: 0,
        spikeCount: 0,
        stress: 0,
      };
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS (Root Mean Square)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / bufferLength);
    
    // Apply sensitivity multiplier only in presentation mode
    const rmsAdjusted = this.presentationMode 
      ? Math.min(rms * 2.0, 1.0)  // 2x sensitive in presentation mode
      : rms;                        // Normal sensitivity otherwise

    // Detect spikes with threshold (lower threshold when in presentation mode)
    if (rmsAdjusted > this.spikeThreshold) {
      this.spikeCount++;
    } else {
      this.spikeCount = Math.max(0, this.spikeCount - 1);
    }

    // Calculate pitch (simplified - find dominant frequency)
    let maxIndex = 0;
    let maxValue = 0;
    for (let i = 0; i < bufferLength; i++) {
      if (dataArray[i] > maxValue) {
        maxValue = dataArray[i];
        maxIndex = i;
      }
    }
    const pitch = (maxIndex * this.audioContext!.sampleRate) / (2 * bufferLength);

    // Track pitch variance
    this.pitchBuffer.push(pitch);
    if (this.pitchBuffer.length > 50) {
      this.pitchBuffer.shift();
    }

    const pitchVariance = this.calculateVariance(this.pitchBuffer);

    // Calculate stress indicator using adjusted RMS
    const stress = (rmsAdjusted * 0.5) + (pitchVariance * 0.3) + (Math.min(this.spikeCount / 5, 1) * 0.2);

    return {
      rms: rmsAdjusted, // Return the adjusted RMS value
      pitch,
      pitchVariance: Math.min(pitchVariance, 1),
      spikeCount: this.spikeCount,
      stress,
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.min(variance / 10000, 1); // Normalize
  }

  stop(): void {
    this.isActive = false;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
