/**
 * Motion Sensor - Real-time motion intensity analysis
 */

export interface MotionData {
  acceleration: number;
  accelerationMagnitude: number;
  jitter: number;
  shake: number;
  intensity: number;
}

export class MotionSensor {
  private isActive = false;
  private lastAcceleration: { x: number; y: number; z: number } | null = null;
  private accelerationBuffer: number[] = [];

  async initialize(): Promise<void> {
    if (typeof DeviceMotionEvent === 'undefined') {
      throw new Error('Device motion not supported');
    }

    // Request permission (iOS 13+)
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      const permission = await (DeviceMotionEvent as any).requestPermission();
      if (permission !== 'granted') {
        throw new Error('Motion sensor permission denied');
      }
    }

    this.isActive = true;
  }

  handleMotionEvent(event: DeviceMotionEvent): MotionData {
    const accel = event.acceleration || (event as any).accelerationIncludingGravity;
    if (!this.isActive || !accel) {
      return {
        acceleration: 0,
        accelerationMagnitude: 0,
        jitter: 0,
        shake: 0,
        intensity: 0,
      };
    }

    const x = accel.x ?? 0;
    const y = accel.y ?? 0;
    const z = accel.z ?? 0;
    const magnitude = Math.sqrt(x * x + y * y + z * z);

    // Calculate jitter (variance in acceleration)
    this.accelerationBuffer.push(magnitude);
    if (this.accelerationBuffer.length > 20) {
      this.accelerationBuffer.shift();
    }

    const jitter = this.calculateJitter(this.accelerationBuffer);

    // Calculate shake (rapid changes)
    let shake = 0;
    if (this.lastAcceleration) {
      const deltaX = Math.abs(x - this.lastAcceleration.x);
      const deltaY = Math.abs(y - this.lastAcceleration.y);
      const deltaZ = Math.abs(z - this.lastAcceleration.z);
      shake = (deltaX + deltaY + deltaZ) / 3;
    }

    this.lastAcceleration = { x, y, z };

    // Calculate intensity
    const intensity = Math.min(
      (magnitude / 30) * 0.6 +
      (jitter / 20) * 0.4,
      1
    );

    return {
      acceleration: magnitude,
      accelerationMagnitude: magnitude,
      jitter,
      shake,
      intensity,
    };
  }

  private calculateJitter(values: number[]): number {
    if (values.length < 2) return 0;

    let sum = 0;
    for (let i = 1; i < values.length; i++) {
      sum += Math.abs(values[i] - values[i - 1]);
    }

    return sum / (values.length - 1);
  }

  stop(): void {
    this.isActive = false;
    this.lastAcceleration = null;
    this.accelerationBuffer = [];
  }

  isSupported(): boolean {
    return typeof DeviceMotionEvent !== 'undefined';
  }
}
