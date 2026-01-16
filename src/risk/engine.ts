/**
 * Frontend Risk Engine - Matches backend calculations
 */

import { AudioData } from '../sensors/audio';
import { MotionData } from '../sensors/motion';

export interface RiskFactors {
  audio: number;
  motion: number;
  time: number;
  location: number;
  total: number;
}

export interface RiskSnapshot {
  audio: {
    stress: number;
    score: number;
  };
  motion: {
    intensity: number;
    score: number;
  };
  time: {
    riskFactor: number;
    score: number;
  };
  location: {
    riskFactor: number;
    score: number;
  };
  total: number;
  level: 'low' | 'medium' | 'high';
}

let lastAutoSOSTimestamp = 0;

export function calculateAudioStress(inputs: { rms: number; pitchVariance: number; spikeCount: number }): number {
  const { rms, pitchVariance, spikeCount } = inputs;
  
  const audioStress = 
    (rms * 0.5) +
    (pitchVariance * 0.3) +
    (Math.min(spikeCount / 5, 1) * 0.2);
  
  const audioScore = audioStress * 35;
  return Math.min(audioScore, 35);
}

export function calculateMotionIntensity(inputs: { accelerationMagnitude: number; jitter: number }): number {
  const { accelerationMagnitude, jitter } = inputs;
  
  const motionIntensity = Math.min(
    (accelerationMagnitude / 30) * 0.6 +
    (jitter / 20) * 0.4,
    1
  );
  
  const motionScore = motionIntensity * 25;
  return Math.min(motionScore, 25);
}

export function calculateTimeRisk(date?: Date): number {
  const now = date || new Date();
  const hour = now.getHours();
  
  let timeRiskFactor: number;
  
  if (hour >= 6 && hour < 20) {
    timeRiskFactor = 0.2;
  } else if (hour >= 20 && hour < 24) {
    timeRiskFactor = 0.6;
  } else if (hour >= 0 && hour < 4) {
    timeRiskFactor = 1.0;
  } else {
    timeRiskFactor = 0.4;
  }
  
  const timeScore = timeRiskFactor * 20;
  return timeScore;
}

export function calculateLocationRisk(location?: any): number {
  // Default: neutral/no zone = 10
  let locationScore = 10;
  
  // If location has zone info from backend, use it
  if (location?.matchedZone) {
    if (location.matchedZone.type === 'high') {
      locationScore = 20; // High-risk zone = 20
    } else {
      locationScore = 12; // Low-risk zone = 12
    }
  } else if (location?.isNormalZone) {
    locationScore = 10; // Neutral/no zone = 10
  }
  
  const presentationMode = (location?.presentationMode as boolean | undefined) === true;
  if (presentationMode) {
    return 20;
  }

  return locationScore;
}

export function calculateTotalRisk(
  audioData: AudioData,
  motionData: MotionData,
  location?: any,
  date?: Date
): RiskSnapshot {
  const audioScore = calculateAudioStress({
    rms: audioData.rms,
    pitchVariance: audioData.pitchVariance,
    spikeCount: audioData.spikeCount,
  });

  const motionScore = calculateMotionIntensity({
    accelerationMagnitude: motionData.accelerationMagnitude,
    jitter: motionData.jitter,
  });

  const timeScore = calculateTimeRisk(date);
  const locationScore = calculateLocationRisk(location);

  const totalRisk = audioScore + motionScore + timeScore + locationScore;

  let level: 'low' | 'medium' | 'high';
  if (totalRisk < 25) {
    level = 'low';
  } else if (totalRisk < 50) {
    level = 'medium';
  } else {
    level = 'high';
  }

  return {
    audio: {
      stress: audioData.stress,
      score: audioScore,
    },
    motion: {
      intensity: motionData.intensity,
      score: motionScore,
    },
    time: {
      riskFactor: (() => {
        const hour = (date || new Date()).getHours();
        if (hour >= 6 && hour < 20) return 0.2;
        if (hour >= 20 && hour < 24) return 0.6;
        if (hour >= 0 && hour < 4) return 1.0;
        return 0.4;
      })(),
      score: timeScore,
    },
    location: {
      riskFactor: 1.0,
      score: locationScore,
    },
    total: totalRisk,
    level,
  };
}

/**
 * Check if auto-SOS should be triggered
 */
export function shouldTriggerAutoSOS(totalRisk: number, _presentationMode?: boolean): boolean {
  const threshold = 50;
  if (totalRisk <= threshold) {
    return false;
  }

  const now = Date.now();
  if (now - lastAutoSOSTimestamp < 10000) {
    return false;
  }

  lastAutoSOSTimestamp = now;
  return true;
}
