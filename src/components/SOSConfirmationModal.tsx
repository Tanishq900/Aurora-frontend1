import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SOSConfirmationModalProps {
  isOpen: boolean;
  countdown: number;
  triggerType: 'manual' | 'ai';
  onSendNow: () => void;
  onCancel: () => void;
}

export default function SOSConfirmationModal({
  isOpen,
  countdown,
  triggerType,
  onSendNow,
  onCancel,
}: SOSConfirmationModalProps) {
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const alarmSoundRef = useRef<AudioContext | null>(null);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmAudioIndexRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      // Stop alarm when modal closes
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }

      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0;
        alarmAudioRef.current = null;
      }

      if (alarmSoundRef.current) {
        alarmSoundRef.current.close().catch(() => {});
        alarmSoundRef.current = null;
      }
      return;
    }

    const base = (import.meta as any)?.env?.BASE_URL || '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    const alarmCandidates = [
      `${prefix}sos-alarm.mp3`,
      `${prefix}sos-alarm.wav`,
      `${prefix}sos-alarm.ogg`,
      `${prefix}no-test.mp3`,
    ];

    const stopBeep = () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      if (alarmSoundRef.current) {
        alarmSoundRef.current.close().catch(() => {});
        alarmSoundRef.current = null;
      }
    };

    const startCustomAlarmAudio = () => {
      const tryNext = () => {
        const idx = alarmAudioIndexRef.current;
        if (idx >= alarmCandidates.length) {
          return;
        }

        const audio = new Audio(alarmCandidates[idx]);
        audio.loop = true;
        audio.volume = 0.8;
        audio.onerror = () => {
          alarmAudioIndexRef.current += 1;
          tryNext();
        };

        alarmAudioRef.current = audio;

        audio
          .play()
          .then(() => {
            stopBeep();
          })
          .catch(() => {
            // Keep fallback beep running
          });
      };

      alarmAudioIndexRef.current = 0;
      tryNext();
    };

    // Play continuous alarm sound during countdown (fallback beep)
    const playAlarmBeep = () => {
      try {
        const audioContext =
          alarmSoundRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
        alarmSoundRef.current = audioContext;

        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(() => {});
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (error) {
        console.error('Failed to play alarm:', error);
      }
    };

    playAlarmBeep();
    alarmIntervalRef.current = setInterval(playAlarmBeep, 500);
    startCustomAlarmAudio();

    // Flash screen effect (CSS animation)
    document.body.style.animation = 'flash 0.5s ease-in-out infinite';

    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }

      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0;
        alarmAudioRef.current = null;
      }

      if (alarmSoundRef.current) {
        alarmSoundRef.current.close().catch(() => {});
        alarmSoundRef.current = null;
      }
      document.body.style.animation = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes flash {
          0%, 100% { background-color: rgba(239, 68, 68, 0.1); }
          50% { background-color: rgba(239, 68, 68, 0.3); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[99999]">
        <div className="glass-panel-critical rounded-2xl p-8 max-w-md w-full mx-4 pulse-critical">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4 animate-pulse">🚨</div>
            <h2 className="text-3xl font-bold text-danger mb-2">
              {triggerType === 'ai' ? 'AUTO SOS TRIGGERED' : 'EMERGENCY SOS'}
            </h2>
            <p className="text-muted-foreground">
              {triggerType === 'ai'
                ? 'High risk detected! Emergency alert will be sent automatically.'
                : 'Emergency alert will be sent automatically.'}
            </p>
          </div>

          <div className="text-center mb-8">
            <div className="text-8xl font-bold text-danger mb-4 animate-pulse">
              {countdown}
            </div>
            <p className="text-muted-foreground text-lg">{countdown > 1 ? 'seconds remaining' : 'second remaining'}</p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-4 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg font-semibold text-lg transition-colors border border-border/50"
            >
              Cancel
            </button>
            <button
              onClick={onSendNow}
              className="flex-1 px-6 py-4 bg-danger hover:bg-red-600 text-white rounded-lg font-semibold text-lg transition-colors shadow-lg"
            >
              Send Now
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
