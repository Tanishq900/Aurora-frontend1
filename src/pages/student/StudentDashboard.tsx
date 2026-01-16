import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../state/auth.store';
import { usePresentationStore } from '../../state/presentation.store';
import { sosService, SOSEvent, SOSChatMessage } from '../../services/sos.service';
import SOSButton from '../../components/SOSButton';
import { AudioSensor, AudioData } from '../../sensors/audio';
import { MotionSensor, MotionData } from '../../sensors/motion';
import { calculateTotalRisk, shouldTriggerAutoSOS } from '../../risk/engine';
import { connectSocket, getSocket } from '../../ws/client';
import AuroraMap from '../../components/AuroraMap';
import EventTimeline from '../../components/EventTimeline';
import { generateExplanation } from '../../risk/explain';
import { riskZonesService, RiskZone } from '../../services/risk-zones.service';
import { appEnv } from '../../lib/env';
import { supabase } from '../../lib/supabaseClient';
import SOSConfirmationModal from '../../components/SOSConfirmationModal';

export default function StudentDashboard() {
  const { user, logout } = useAuthStore();
  const { enabled: presentationMode, fetchStatus, toggle: togglePresentation } = usePresentationStore();
  const [sosEvents, setSosEvents] = useState<SOSEvent[]>([]);
  const [audioData, setAudioData] = useState<AudioData>({
    rms: 0,
    pitch: 0,
    pitchVariance: 0,
    spikeCount: 0,
    stress: 0,
  });
  const [motionData, setMotionData] = useState<MotionData>({
    acceleration: 0,
    accelerationMagnitude: 0,
    jitter: 0,
    shake: 0,
    intensity: 0,
  });
  const [riskSnapshot, setRiskSnapshot] = useState(calculateTotalRisk(audioData, motionData));
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [presentationPassword, setPresentationPassword] = useState('');
  const [autoSOSTriggered, setAutoSOSTriggered] = useState(false);
  const [audioSensorInstance, setAudioSensorInstance] = useState<AudioSensor | null>(null);
  const [lastAutoSOSTime, setLastAutoSOSTime] = useState<number>(0); // Track last auto-SOS trigger time
  const [userLocation, setUserLocation] = useState<
    ({
      lat: number;
      lng: number;
      matchedZone?: { id?: string; name?: string; type: 'high' | 'low' };
      isNormalZone?: boolean;
    } | null)
  >(null);
  const [riskZones, setRiskZones] = useState<RiskZone[]>([]);
  const [explanation, setExplanation] = useState<string[]>([]);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<string[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video' | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaCountdown, setMediaCountdown] = useState<number | null>(null);
  const mediaCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMediaCountdownRunningRef = useRef<boolean>(false);
  const isMediaSOSSentRef = useRef<boolean>(false);
  const uploadAndSendMediaSOSRef = useRef<() => void>(() => {});
  const latestAudioRef = useRef<AudioData>(audioData);
  const latestMotionRef = useRef<MotionData>(motionData);
  const latestRiskTotalRef = useRef<number>(riskSnapshot.total);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatSosId, setChatSosId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<SOSChatMessage[]>([]);
  const [chatReadOnly, setChatReadOnly] = useState(false);
  const [chatSecurityEmail, setChatSecurityEmail] = useState<string | undefined>(undefined);
  const [chatDraft, setChatDraft] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      mediaPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaPreviewUrls]);

  const resetMediaDraft = () => {
    mediaPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setMediaFiles([]);
    setMediaPreviewUrls([]);
    setActiveMediaIndex(0);
    setMediaError(null);
  };

  const openMediaModal = () => {
    setMediaModalOpen(true);
    setMediaError(null);
  };

  const closeMediaModal = () => {
    setMediaModalOpen(false);
    resetMediaDraft();
  };

  const hideMediaModal = () => {
    setMediaModalOpen(false);
  };

  const cancelMediaCountdown = () => {
    if (mediaCountdownRef.current) {
      clearInterval(mediaCountdownRef.current);
      mediaCountdownRef.current = null;
    }
    isMediaCountdownRunningRef.current = false;
    setMediaCountdown(null);
    setMediaError(null);
    setMediaModalOpen(true);
  };

  const handlePickedFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setMediaError(null);

    const nextFiles = Array.from(files).slice(0, 5);
    const nextUrls = nextFiles.map((f) => URL.createObjectURL(f));
    setMediaFiles(nextFiles);
    setMediaPreviewUrls(nextUrls);
    setActiveMediaIndex(0);
  };

  const addMediaFile = (file: File) => {
    setMediaError(null);
    const url = URL.createObjectURL(file);
    setMediaFiles((prev) => {
      const next = [...prev, file].slice(0, 5);
      return next;
    });
    setMediaPreviewUrls((prev) => {
      const next = [...prev, url].slice(0, 5);
      return next;
    });
    setActiveMediaIndex((prev) => {
      const nextIndex = Math.min(prev + 1, 4);
      return nextIndex;
    });
  };

  const stopCameraStream = () => {
    try {
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      setIsRecording(false);

      const stream = mediaStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      mediaStreamRef.current = null;

      if (cameraVideoRef.current) {
        (cameraVideoRef.current as any).srcObject = null;
      }
    } catch {
      // ignore
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setCameraOpen(false);
    setCameraMode(null);
    setCameraError(null);
  };

  const openCamera = async (mode: 'photo' | 'video') => {
    setCameraError(null);
    setCameraMode(mode);
    setCameraOpen(true);

    if (!window.isSecureContext) {
      setCameraError('Camera requires HTTPS (or localhost).');
      return;
    }

    const getUserMedia = navigator.mediaDevices?.getUserMedia;
    if (!getUserMedia) {
      setCameraError('Camera not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: mode === 'video',
      });

      mediaStreamRef.current = stream;
      if (cameraVideoRef.current) {
        (cameraVideoRef.current as any).srcObject = stream;
        cameraVideoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setCameraError(err?.message || 'Failed to access camera.');
    }
  };

  const capturePhoto = async () => {
    const video = cameraVideoRef.current;
    if (!video) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        addMediaFile(file);
        closeCamera();
      },
      'image/jpeg',
      0.92
    );
  };

  const startVideoRecording = () => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    if (isRecording) return;

    const preferredTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = preferredTypes.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t));

    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const file = new File([blob], `video_${Date.now()}.webm`, { type: blob.type || 'video/webm' });
        addMediaFile(file);
        closeCamera();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setCameraError(err?.message || 'Failed to start recording.');
    }
  };

  const stopVideoRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'inactive') return;
    try {
      recorder.stop();
    } catch {
      // ignore
    }
  };

  const sanitizeFilename = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');

  const uploadAndSendMediaSOS = async () => {
    if (!user?.id) {
      setMediaError('You must be logged in to send media.');
      return;
    }
    if (mediaFiles.length === 0) {
      setMediaError('Please attach a photo or video first.');
      return;
    }

    if (isMediaSOSSentRef.current) {
      return;
    }
    isMediaSOSSentRef.current = true;

    setIsSendingMedia(true);
    setMediaError(null);

    try {
      const envBucket = appEnv.supabaseStorageBucket();
      const bucketCandidates = Array.from(
        new Set([
          envBucket,
          'sos-attachment',
          'sos-attachments',
        ].filter(Boolean))
      ) as string[];

      const preferredBucket = bucketCandidates[0] || 'sos-attachment';
      const uploadedPaths: string[] = [];

      for (const file of mediaFiles) {
        const safeName = sanitizeFilename(file.name || 'upload');
        const basePath = `${user.id}/${Date.now()}_${safeName}`;

        let usedBucket = preferredBucket;
        let pathToUse = basePath;

        const tryUpload = async (bucketName: string) =>
          supabase.storage.from(bucketName).upload(pathToUse, file, {
            contentType: file.type || undefined,
            upsert: false,
          });

        let upload = await tryUpload(usedBucket);

        if (upload.error) {
          const msg = (upload.error as any)?.message || '';
          if (/bucket.*not.*found/i.test(msg)) {
            const nextBucket = bucketCandidates.find((b) => b !== usedBucket);
            if (nextBucket) {
              usedBucket = nextBucket;
              upload = await tryUpload(usedBucket);
            }
          }
          pathToUse = `${user.id}/${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
          upload = await supabase.storage.from(usedBucket).upload(pathToUse, file, {
            contentType: file.type || undefined,
            upsert: false,
          });
        }

        if (upload.error) {
          const msg = (upload.error as any)?.message || '';
          if (/bucket.*not.*found/i.test(msg)) {
            throw new Error(
              `Supabase Storage bucket not found. Tried: ${bucketCandidates.map((b) => `"${b}"`).join(', ')}. Set SUPABASE_STORAGE_BUCKET (VITE_SUPABASE_STORAGE_BUCKET or NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET) to your existing bucket name (e.g. "sos-attachment"), then restart the frontend dev server.`
            );
          }
          throw new Error(upload.error.message || 'Upload failed');
        }

        uploadedPaths.push(pathToUse);
      }

      await sosService.createSOS({
        risk_score: riskSnapshot.total,
        factors: {
          audio: riskSnapshot.audio.score,
          motion: riskSnapshot.motion.score,
          time: riskSnapshot.time.score,
          location: riskSnapshot.location.score,
        },
        location: userLocation || undefined,
        trigger_type: 'manual',
        attachments: uploadedPaths,
      });

      setMediaCountdown(null);
      if (mediaCountdownRef.current) {
        clearInterval(mediaCountdownRef.current);
        mediaCountdownRef.current = null;
      }
      isMediaCountdownRunningRef.current = false;
      setMediaModalOpen(false);
      resetMediaDraft();
      loadSOSHistory();
    } catch (err: any) {
      setMediaError(err?.message || 'Failed to send media.');
      isMediaSOSSentRef.current = false;
      setMediaCountdown(null);
      if (mediaCountdownRef.current) {
        clearInterval(mediaCountdownRef.current);
        mediaCountdownRef.current = null;
      }
      isMediaCountdownRunningRef.current = false;
      setMediaModalOpen(true);
    } finally {
      setIsSendingMedia(false);
    }
  };

  uploadAndSendMediaSOSRef.current = uploadAndSendMediaSOS;

  const startMediaSOSCountdown = () => {
    if (!user?.id) {
      setMediaError('You must be logged in to send media.');
      return;
    }
    if (mediaFiles.length === 0) {
      setMediaError('Please attach a photo or video first.');
      return;
    }

    isMediaSOSSentRef.current = false;
    setMediaError(null);
    setMediaCountdown(10);
    hideMediaModal();
  };

  const handleMediaSendNow = () => {
    if (mediaCountdownRef.current) {
      clearInterval(mediaCountdownRef.current);
      mediaCountdownRef.current = null;
    }
    isMediaCountdownRunningRef.current = false;
    setMediaCountdown(null);
    uploadAndSendMediaSOS();
  };

  useEffect(() => {
    if (mediaCountdown === null) {
      if (mediaCountdownRef.current) {
        clearInterval(mediaCountdownRef.current);
        mediaCountdownRef.current = null;
      }
      isMediaCountdownRunningRef.current = false;
      return;
    }

    if (mediaCountdown <= 0) {
      if (mediaCountdownRef.current) {
        clearInterval(mediaCountdownRef.current);
        mediaCountdownRef.current = null;
      }
      isMediaCountdownRunningRef.current = false;
      setMediaCountdown(null);
      uploadAndSendMediaSOSRef.current();
      return;
    }

    if (!isMediaCountdownRunningRef.current && mediaCountdown > 0) {
      isMediaCountdownRunningRef.current = true;
      mediaCountdownRef.current = setInterval(() => {
        setMediaCountdown((prev) => {
          if (prev === null || prev <= 0) {
            isMediaCountdownRunningRef.current = false;
            if (mediaCountdownRef.current) {
              clearInterval(mediaCountdownRef.current);
              mediaCountdownRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (mediaCountdown === null && mediaCountdownRef.current) {
        clearInterval(mediaCountdownRef.current);
        mediaCountdownRef.current = null;
        isMediaCountdownRunningRef.current = false;
      }
    };
  }, [mediaCountdown]);

  useEffect(() => {
    if (user?.role === 'security') {
      navigate('/security');
    }
  }, [user, navigate]);

  const loadSOSHistory = useCallback(async () => {
    try {
      const events = await sosService.getSOSEvents({ limit: 7 });
      setSosEvents(events);
    } catch (error) {
      console.error('Failed to load SOS history:', error);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    loadSOSHistory();
    
    // Connect WebSocket
    const token = localStorage.getItem('accessToken');
    if (token) {
      connectSocket(token);
    }

    return () => {
      const socket = getSocket();
      if (socket) socket.disconnect();
    };
  }, [fetchStatus, loadSOSHistory]);

  useEffect(() => {
    riskZonesService
      .getRiskZones()
      .then((zones) => {
        setRiskZones(zones);
      })
      .catch(() => {
        setRiskZones([]);
      });
  }, []);

  useEffect(() => {
    if (!userLocation || !Number.isFinite(userLocation.lat) || !Number.isFinite(userLocation.lng)) return;
    if (riskZones.length === 0) return;

    const matched = matchZoneForLocation({ lat: userLocation.lat, lng: userLocation.lng });
    const nextMatchedId = matched?.id || null;
    const prevMatchedId = userLocation.matchedZone?.id || null;

    if (nextMatchedId === prevMatchedId) return;

    setUserLocation({
      lat: userLocation.lat,
      lng: userLocation.lng,
      matchedZone: matched ? { id: matched.id, name: matched.name, type: matched.type } : undefined,
      isNormalZone: !matched,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskZones]);

  const isPointInRing = (point: { lat: number; lng: number }, ring: number[][]) => {
    const x = point.lng;
    const y = point.lat;

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];

      const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  };

  const matchZoneForLocation = (loc: { lat: number; lng: number }) => {
    const candidates = riskZones.filter((z) => {
      const ring = z?.polygon?.coordinates?.[0];
      if (!ring || ring.length < 3) return false;
      return isPointInRing(loc, ring);
    });

    const high = candidates.find((z) => z.type === 'high');
    return high || candidates[0] || null;
  };

  const handleLocationUpdate = (loc: { lat: number; lng: number }) => {
    const matched = matchZoneForLocation(loc);
    setUserLocation({
      ...loc,
      matchedZone: matched ? { id: matched.id, name: matched.name, type: matched.type } : undefined,
      isNormalZone: !matched,
    });
  };

  useEffect(() => {
    latestAudioRef.current = audioData;
  }, [audioData]);

  useEffect(() => {
    latestMotionRef.current = motionData;
  }, [motionData]);

  useEffect(() => {
    latestRiskTotalRef.current = riskSnapshot.total;
  }, [riskSnapshot.total]);

  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      const socket = getSocket();
      if (!socket || !socket.connected) return;

      socket.emit('live_feed', {
        userId: user.id,
        audio: {
          rms: latestAudioRef.current.rms,
          pitch: latestAudioRef.current.pitch,
          stress: latestAudioRef.current.stress,
        },
        motion: {
          acceleration: latestMotionRef.current.acceleration,
          shake: latestMotionRef.current.shake,
        },
        totalRisk: latestRiskTotalRef.current,
      });
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!chatOpen || !chatSosId) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = connectSocket(token);
    socket.emit('join_sos', chatSosId);
    socket.emit('join_sos_chat', chatSosId);

    const handleChatMessage = (msg: any) => {
      if (!msg || msg.sos_id !== chatSosId) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg as SOSChatMessage];
      });
    };

    const handleChatError = (payload: any) => {
      if (!payload || payload.sosId !== chatSosId) return;
      setChatError(payload.error || 'Failed to send message');
    };

    const handleSosUpdated = async (event: any) => {
      if (!event || String(event.id) !== String(chatSosId)) return;
      if (event.status === 'resolved') {
        setChatReadOnly(true);
      }
      if (event.status === 'acknowledged' && !chatSecurityEmail) {
        try {
          const bundle = await sosService.getSOSChatById(chatSosId);
          setChatSecurityEmail(bundle?.chat?.security_name || bundle?.chat?.security_email);
        } catch {
          // ignore
        }
      }
    };

    socket.on('chat:message', handleChatMessage);
    socket.on('chat:error', handleChatError);
    socket.on('sos-updated', handleSosUpdated);
    socket.on('sos_status_update', handleSosUpdated);

    return () => {
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:error', handleChatError);
      socket.off('sos-updated', handleSosUpdated);
      socket.off('sos_status_update', handleSosUpdated);
      socket.emit('leave_sos', chatSosId);
      socket.emit('leave_sos_chat', chatSosId);
    };
  }, [chatOpen, chatSosId, chatSecurityEmail]);

  useEffect(() => {
    // Initialize sensors
    const initSensors = async () => {
      try {
        const audio = new AudioSensor();
        await audio.initialize();
        // Explicitly set to normal sensitivity (presentation mode off)
        audio.setPresentationMode(false);
        setAudioSensorInstance(audio);

        const motion = new MotionSensor();
        if (motion.isSupported()) {
          await motion.initialize();

          const handleMotion = (event: DeviceMotionEvent) => {
            const data = motion.handleMotionEvent(event);
            setMotionData(data);
          };

          window.addEventListener('devicemotion', handleMotion as any);

          // Update audio data
          const audioInterval = setInterval(() => {
            const data = audio.getAudioData();
            setAudioData(data);
          }, 200);

          return () => {
            audio.stop();
            motion.stop();
            window.removeEventListener('devicemotion', handleMotion as any);
            clearInterval(audioInterval);
          };
        } else {
          audio.stop();
        }
      } catch (error) {
        console.error('Failed to initialize sensors:', error);
      }
    };

    initSensors();
  }, []);

  // Update audio sensor sensitivity when presentation mode changes
  useEffect(() => {
    if (audioSensorInstance) {
      audioSensorInstance.setPresentationMode(presentationMode);
    }
  }, [presentationMode, audioSensorInstance]);

  useEffect(() => {
    // Recalculate risk when sensor data changes
    const snapshot = calculateTotalRisk(
      audioData,
      motionData,
      {
        ...(userLocation || {}),
        presentationMode,
      }
    );
    setRiskSnapshot(snapshot);

    setExplanation(
      generateExplanation({
        snapshot,
        audioInputs: {
          rms: audioData.rms,
          pitchVariance: audioData.pitchVariance,
          spikeCount: audioData.spikeCount,
        },
        motionInputs: {
          accelerationMagnitude: motionData.accelerationMagnitude,
          jitter: motionData.jitter,
        },
        location: userLocation
          ? {
              lat: userLocation.lat,
              lng: userLocation.lng,
              zoneName: userLocation.matchedZone?.name,
              isNormalZone: userLocation.isNormalZone,
            }
          : undefined,
        time: new Date(),
      })
    );

  }, [audioData, motionData, userLocation, presentationMode]);

  // Monitor for auto-SOS trigger - ONLY when risk level is "high" with 3-second cooldown
  useEffect(() => {
    if (!riskSnapshot || !riskSnapshot.total) return;
    if (autoSOSTriggered) return;

    const now = Date.now();
    const timeSinceLastTrigger = now - lastAutoSOSTime;
    const cooldownMs = 10000; // strict 10-second cooldown

    if (timeSinceLastTrigger < cooldownMs) return;

    if (riskSnapshot.level === 'high') {
      const shouldTrigger = shouldTriggerAutoSOS(riskSnapshot.total, presentationMode);

      if (shouldTrigger) {
        setAutoSOSTriggered(true);
        setLastAutoSOSTime(now);
      }
    }
  }, [riskSnapshot, presentationMode, autoSOSTriggered, lastAutoSOSTime]);

  const openChat = async () => {
    setChatOpen(true);
    setChatLoading(true);
    setChatError(null);
    setChatMessages([]);
    setChatSosId(null);
    setChatReadOnly(false);
    setChatSecurityEmail(undefined);

    try {
      const bundle = await sosService.getRecentSOSChat();
      const sosId = String((bundle as any)?.sos?.id || '');
      setChatSosId(sosId || null);
      setChatMessages(Array.isArray((bundle as any)?.messages) ? ((bundle as any).messages as SOSChatMessage[]) : []);
      setChatReadOnly(Boolean((bundle as any)?.read_only));
      setChatSecurityEmail((bundle as any)?.chat?.security_name || (bundle as any)?.chat?.security_email);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to load chat';
      setChatError(msg);
    } finally {
      setChatLoading(false);
    }
  };

  const closeChat = () => {
    setChatOpen(false);
    setChatError(null);
    setChatDraft('');
  };

  const sendChatMessage = async () => {
    if (!chatSosId) return;
    const trimmed = chatDraft.trim();
    if (!trimmed) return;
    if (chatReadOnly) return;
    setChatError(null);

    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('chat:send', { sosId: chatSosId, message: trimmed });
      setChatDraft('');
      return;
    }

    try {
      const sent = await sosService.sendSOSChatMessage(chatSosId, trimmed);
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setChatDraft('');
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to send message';
      setChatError(msg);
    }
  };

  const handlePresentationToggle = async () => {
    try {
      await togglePresentation(!presentationMode, presentationPassword);
      setShowPresentationModal(false);
      setPresentationPassword('');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const riskData = [
    { name: 'Audio', value: riskSnapshot.audio.score, max: 35, color: riskSnapshot.audio.score > 20 ? 'danger' : 'safe' },
    { name: 'Motion', value: riskSnapshot.motion.score, max: 25, color: riskSnapshot.motion.score > 15 ? 'danger' : 'safe' },
    { name: 'Time', value: riskSnapshot.time.score, max: 20, color: riskSnapshot.time.score > 12 ? 'warning' : 'safe' },
    { name: 'Location', value: riskSnapshot.location.score, max: 20, color: riskSnapshot.location.score > 15 ? 'warning' : 'safe' },
    { name: 'Total', value: riskSnapshot.total, max: 100, color: riskSnapshot.level === 'high' ? 'danger' : riskSnapshot.level === 'medium' ? 'warning' : 'safe' },
  ];

  return (
    <div className="min-h-screen bg-black p-6 relative">
      <div className="aurora-bg" />
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Header */}
        <div className="glass-panel px-6 py-4 flex justify-between items-center border border-border/60">
          <div>
            <h1 className="text-2xl font-bold aurora-text">Student Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user?.name || user?.email}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowPresentationModal(true)}
              className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              {presentationMode ? '⚙️ Settings' : '⚙️ Settings'}
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SOS Button Section */}
          <div className="lg:col-span-1 glass-panel-critical p-6 flex flex-col items-center justify-center border border-destructive/40">
            <div className="w-full pb-3 mb-4 border-b border-destructive/30">
              <h2 className="text-xl font-semibold text-foreground text-center">Emergency SOS</h2>
            </div>
            <SOSButton 
              location={userLocation}
              onSOSTriggered={() => {
                loadSOSHistory();
                setAutoSOSTriggered(false); // Reset after SOS is sent
                setLastAutoSOSTime(Date.now()); // Update cooldown timer
              }}
              triggerType={autoSOSTriggered ? 'ai' : undefined}
              onCancelAuto={() => {
                setAutoSOSTriggered(false); // Reset if user cancels
                setLastAutoSOSTime(Date.now()); // Update cooldown timer
              }}
            />
            <button
              type="button"
              onClick={openMediaModal}
              className="mt-5 w-full px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              Send Photo / Video
            </button>
          </div>

          {/* Risk Display */}
          <div className="lg:col-span-2 glass-panel p-6 border border-border/60">
            <div className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-border/40">
              <h2 className="text-xl font-semibold text-foreground">Live Risk Assessment</h2>
            </div>
            <div className="space-y-4">
              {riskData.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className={`font-semibold ${
                      item.color === 'danger' ? 'text-danger' :
                      item.color === 'warning' ? 'text-warning' : 'text-safe'
                    }`}>
                      {item.value.toFixed(1)} / {item.max}
                    </span>
                  </div>
                  <div className="w-full bg-secondary/60 rounded-full h-3 overflow-hidden border border-border/50">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        item.color === 'danger'
                          ? 'bg-danger shadow-[inset_0_0_14px_rgba(239,68,68,0.65)]'
                          : item.color === 'warning'
                            ? 'bg-warning shadow-[inset_0_0_14px_rgba(245,158,11,0.6)]'
                            : 'bg-safe shadow-[inset_0_0_14px_rgba(34,197,94,0.6)]'
                      }`}
                      style={{ width: `${(item.value / item.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="mt-4 p-4 bg-secondary/50 border border-border/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Risk Level</span>
                  <span className={`text-xl font-bold ${
                    riskSnapshot.level === 'high' ? 'text-danger' :
                    riskSnapshot.level === 'medium' ? 'text-warning' : 'text-safe'
                  }`}>
                    {riskSnapshot.level.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map and Timeline Section */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Map */}
          <div className="glass-panel p-6 border border-border/60">
            <div className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-border/40">
              <h2 className="text-xl font-semibold text-foreground">Live Location & Risk Zones</h2>
            </div>
            <AuroraMap
              userLocation={userLocation}
              height="400px"
              onLocationUpdate={handleLocationUpdate}
            />
          </div>

          {/* Timeline */}
          <div className="glass-panel p-6 border border-border/60">
            <div className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-border/40">
              <h2 className="text-xl font-semibold text-foreground">Event Timeline</h2>
              <button
                type="button"
                onClick={openChat}
                disabled={sosEvents.length === 0}
                className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Chat
              </button>
            </div>
            {sosEvents.length > 0 && sosEvents[0]?.id ? (
              <EventTimeline sosId={String(sosEvents[0].id)} sosEvent={sosEvents[0]} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">No events to display</div>
            )}
          </div>
        </div>

        {/* AI Explanation */}
        {explanation.length > 0 && (
          <div className="mt-6 glass-panel p-6 border border-border/60">
            <div className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-border/40">
              <h2 className="text-xl font-semibold text-foreground">AI Risk Explanation</h2>
            </div>
            <div className="space-y-2">
              {explanation.map((bullet, index) => (
                <div
                  key={index}
                  className={`text-muted-foreground ${
                    bullet.startsWith('→') ? 'font-bold text-foreground text-lg mt-2' : ''
                  }`}
                >
                  {bullet}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SOS History */}
        <div className="mt-6 glass-panel p-6 border border-border/60">
          <div className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-border/40">
            <h2 className="text-xl font-semibold text-foreground">Last 7 Days History</h2>
          </div>
          {sosEvents.length === 0 ? (
            <p className="text-muted-foreground">No SOS events in the last 7 days</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="pb-2 text-muted-foreground">Date</th>
                    <th className="pb-2 text-muted-foreground">Risk Score</th>
                    <th className="pb-2 text-muted-foreground">Trigger</th>
                    <th className="pb-2 text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sosEvents.map((event) => (
                    <tr key={event.id} className="border-b border-border/40">
                      <td className="py-2 text-muted-foreground">{new Date(event.created_at).toLocaleString()}</td>
                      <td className="py-2 text-foreground font-semibold">{event.risk_score.toFixed(1)}</td>
                      <td className="py-2 text-muted-foreground">{event.trigger_type.charAt(0).toUpperCase() + event.trigger_type.slice(1)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          event.status === 'resolved' ? 'bg-safe/20 text-safe' :
                          event.status === 'acknowledged' ? 'bg-warning/20 text-warning' :
                          'bg-danger/20 text-danger'
                        }`}>
                          {event.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Presentation Mode Modal */}
      {showPresentationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-panel p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-foreground mb-4">Presentation Mode</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={presentationPassword}
                  onChange={(e) => setPresentationPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-secondary/60 border border-border/50 rounded-lg text-foreground"
                  placeholder="Enter password"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowPresentationModal(false)}
                  className="flex-1 px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg border border-border/50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePresentationToggle}
                  className="flex-1 px-4 py-2 bg-primary/80 hover:bg-primary text-primary-foreground rounded-lg border border-primary/30"
                >
                  {presentationMode ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mediaModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-panel p-6 max-w-2xl w-full mx-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-foreground">Send Media</h3>
                <p className="text-sm text-muted-foreground mt-1">Attach or record a photo/video, then send it to Security.</p>
              </div>
              <button
                type="button"
                onClick={closeMediaModal}
                className="px-3 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg border border-border/50"
                disabled={isSendingMedia}
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 space-y-3">
                <button
                  type="button"
                  className="w-full px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg border border-border/50"
                  onClick={() => attachInputRef.current?.click()}
                  disabled={isSendingMedia}
                >
                  Attach File
                </button>
                <button
                  type="button"
                  className="w-full px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg border border-border/50"
                  onClick={() => openCamera('photo')}
                  disabled={isSendingMedia}
                >
                  Take Photo
                </button>
                <button
                  type="button"
                  className="w-full px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg border border-border/50"
                  onClick={() => openCamera('video')}
                  disabled={isSendingMedia}
                >
                  Record Video
                </button>

                <input
                  ref={attachInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => handlePickedFiles(e.target.files)}
                />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => handlePickedFiles(e.target.files)}
                />

                {mediaFiles.length > 0 ? (
                  <div className="rounded-lg border border-border/40 bg-secondary/40 p-3">
                    <div className="text-sm text-muted-foreground">Selected</div>
                    <div className="mt-2 space-y-2">
                      {mediaFiles.map((f, idx) => (
                        <button
                          key={`${f.name}-${idx}`}
                          type="button"
                          className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                            idx === activeMediaIndex
                              ? 'bg-secondary/70 border-border/70'
                              : 'bg-secondary/40 border-border/40 hover:bg-secondary/60'
                          }`}
                          onClick={() => setActiveMediaIndex(idx)}
                          disabled={isSendingMedia}
                        >
                          <div className="text-foreground text-sm truncate">{f.name}</div>
                          <div className="text-muted-foreground text-xs">{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No file selected.</div>
                )}
              </div>

              <div className="md:col-span-3">
                <div className="rounded-xl border border-border/40 bg-secondary/30 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40">
                    <div className="text-sm font-semibold text-foreground">Preview</div>
                  </div>
                  <div className="p-4">
                    {mediaPreviewUrls[activeMediaIndex] ? (
                      mediaFiles[activeMediaIndex]?.type?.startsWith('video/') ? (
                        <video
                          src={mediaPreviewUrls[activeMediaIndex]}
                          controls
                          className="w-full max-h-[360px] rounded-lg bg-black"
                        />
                      ) : (
                        <img
                          src={mediaPreviewUrls[activeMediaIndex]}
                          alt="Preview"
                          className="w-full max-h-[360px] object-contain rounded-lg bg-black/20"
                        />
                      )
                    ) : (
                      <div className="text-sm text-muted-foreground">Select a photo or video to preview it here.</div>
                    )}
                  </div>
                </div>

                {mediaError ? (
                  <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/15 px-4 py-3 text-sm text-destructive-foreground">
                    {mediaError}
                  </div>
                ) : null}

                <div className="mt-5 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={closeMediaModal}
                    className="px-5 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg border border-border/50"
                    disabled={isSendingMedia}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={startMediaSOSCountdown}
                    className="px-5 py-2 bg-primary/80 hover:bg-primary text-primary-foreground rounded-lg border border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSendingMedia || mediaFiles.length === 0}
                  >
                    {isSendingMedia ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SOSConfirmationModal
        isOpen={mediaCountdown !== null}
        countdown={mediaCountdown !== null ? mediaCountdown : 0}
        triggerType="manual"
        onSendNow={handleMediaSendNow}
        onCancel={cancelMediaCountdown}
      />

      {chatOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-panel p-6 max-w-2xl w-full mx-4">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/40">
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-foreground">SOS Chat</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {chatSecurityEmail ? `Connected to: ${chatSecurityEmail}` : 'Waiting for Security to acknowledge…'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground px-2 py-1 rounded-md border border-border/40 bg-black/30">
                  {chatReadOnly ? 'Read-only' : 'Live'}
                </div>
                <button
                  type="button"
                  onClick={closeChat}
                  className="px-3 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg border border-border/50"
                >
                  Close
                </button>
              </div>
            </div>

            {chatLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading chat…</div>
            ) : chatError ? (
              <div className="mt-4 text-sm text-danger">{chatError}</div>
            ) : null}

            <div className="mt-4 rounded-lg border border-border/50 bg-black/35 h-[360px] overflow-y-auto p-4">
              {chatMessages.length === 0 ? (
                <div className="text-muted-foreground text-sm">No messages yet.</div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((m) => {
                    const isMine = Boolean(user?.id && m.sender_id === user.id);
                    return (
                      <div key={m.id} className={isMine ? 'flex justify-end' : 'flex justify-start'}>
                        <div
                          className={
                            isMine
                              ? 'max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/20 border border-primary/25 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]'
                              : 'max-w-[85%] rounded-2xl rounded-tl-sm bg-secondary/35 border border-border/50 px-4 py-3'
                          }
                        >
                          <div className="text-xs text-muted-foreground">
                            {isMine ? 'You' : m.sender_name || m.sender_email || m.sender_id} • {new Date(m.created_at).toLocaleString()}
                          </div>
                          <div className="text-foreground mt-1 whitespace-pre-wrap">{m.message}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <input
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder={chatReadOnly ? 'Chat is read-only (resolved)' : 'Type a message…'}
                disabled={chatReadOnly || chatLoading || !chatSosId}
                className="flex-1 px-4 py-3 rounded-xl border border-border/60 bg-black/30 text-foreground backdrop-blur-sm focus:outline-none focus:border-primary/60 disabled:opacity-60"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
              />
              <button
                type="button"
                onClick={sendChatMessage}
                disabled={chatReadOnly || chatLoading || !chatSosId || !chatDraft.trim()}
                className="px-5 py-3 bg-primary/80 hover:bg-primary text-primary-foreground rounded-xl border border-primary/30 shadow-[0_0_24px_rgba(37,246,228,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {cameraOpen ? (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[99998]">
          <div className="glass-panel p-5 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {cameraMode === 'video' ? 'Record Video' : 'Take Photo'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Allow camera permission when prompted.</p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="px-3 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg border border-border/50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-xl overflow-hidden border border-border/40 bg-black">
              <video ref={cameraVideoRef} playsInline muted className="w-full max-h-[420px] object-contain" />
            </div>

            {cameraError ? (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/15 px-4 py-3 text-sm text-destructive-foreground">
                {cameraError}
              </div>
            ) : null}

            <div className="mt-5 flex gap-3 justify-end">
              {cameraMode === 'photo' ? (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-5 py-2 bg-primary/80 hover:bg-primary text-primary-foreground rounded-lg border border-primary/30"
                >
                  Capture
                </button>
              ) : (
                <>
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startVideoRecording}
                      className="px-5 py-2 bg-primary/80 hover:bg-primary text-primary-foreground rounded-lg border border-primary/30"
                    >
                      Start Recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopVideoRecording}
                      className="px-5 py-2 bg-danger hover:bg-red-600 text-white rounded-lg border border-danger/30"
                    >
                      Stop
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isSendingMedia ? (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999]">
          <div className="glass-panel p-6 w-[92%] max-w-sm text-center">
            <div className="text-lg font-semibold text-foreground">Uploading…</div>
            <div className="mt-2 text-sm text-muted-foreground">Please wait while we send your media to Security.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
