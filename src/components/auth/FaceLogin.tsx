'use client';

import { useTranslation } from 'react-i18next';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CheckCircle, XCircle, ScanFace } from 'lucide-react';
import { ShieldLoader } from '@/components/ui/ShieldLoader';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { toast } from 'sonner';
import { detectFace, loadFaceApiModels, findBestMatch, isFaceMatch } from '@/lib/faceApi';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';

export function FaceLogin() {
  const { t } = useTranslation();
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);

  // ===== Refs (чтобы в setInterval всегда были актуальные значения) =====
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const playStartedRef = useRef(false);
  const loopStartedRef = useRef(false);

  const processingRef = useRef(false);
  const autoTriggeredRef = useRef(false);
  const lastAttemptRef = useRef(0);

  const progressRef = useRef(0);
  const qualityRef = useRef<'poor' | 'good' | 'excellent'>('poor');
  const faceDetectedRef = useRef(false);

  const lastDescriptorRef = useRef<Float32Array | null>(null);
  const noFaceFramesRef = useRef(0);
  const detectionInProgressRef = useRef(false);

  // ===== UI State =====
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [matchStatus, setMatchStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>(
    'idle',
  );
  const [matchedUser, setMatchedUser] = useState<string | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  const [scanningProgress, setScanningProgress] = useState(0);
  const [detectionQuality, setDetectionQuality] = useState<'poor' | 'good' | 'excellent'>('poor');

  const [autoLoginTriggered, setAutoLoginTriggered] = useState(false);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);

  // sync a few refs (безопасно, но триггер используем ref’ы)
  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);
  useEffect(() => {
    lastAttemptRef.current = lastAttemptTime;
  }, [lastAttemptTime]);
  useEffect(() => {
    autoTriggeredRef.current = autoLoginTriggered;
  }, [autoLoginTriggered]);

  // ===== Data =====
  const allFaceDescriptors = useQuery(api.faceRecognition.getAllFaceDescriptors);
  const recordFaceIdAttempt = useMutation(api.users.auth.recordFaceIdAttempt);

  // ===== Init once: models + camera list =====
  useEffect(() => {
    loadFaceApiModels().catch((err) => {
      console.error('Failed to load face models:', err);
      toast.error(t('faceLogin.modelsFailed', 'Failed to load face recognition models'));
    });

    (async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setCameras(videoDevices);
        if (videoDevices.length > 0) setSelectedCamera(videoDevices[0]!.deviceId);
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
      }
    })();

    return () => {
      stopDetectionLoop();
      stopStreamTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (allFaceDescriptors !== undefined) {
      console.log(`📊 Face descriptors loaded: ${allFaceDescriptors.length} registered faces`);
      if (allFaceDescriptors.length === 0) console.warn('⚠️ No registered faces in the database');
    }
  }, [allFaceDescriptors]);

  // ===== Helpers =====
  const stopStreamTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const stopDetectionLoop = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    loopStartedRef.current = false;
  };

  const resetRefs = () => {
    progressRef.current = 0;
    qualityRef.current = 'poor';
    faceDetectedRef.current = false;
    lastDescriptorRef.current = null;
    autoTriggeredRef.current = false;
    processingRef.current = false;
    lastAttemptRef.current = 0;
    noFaceFramesRef.current = 0;
    detectionInProgressRef.current = false;
  };

  const hardResetUiState = () => {
    setFaceDetected(false);
    setMatchStatus('idle');
    setMatchedUser(null);

    setScanningProgress(0);
    setDetectionQuality('poor');

    setAutoLoginTriggered(false);
    setIsProcessing(false);

    resetRefs();
  };

  const stopWebcam = () => {
    stopDetectionLoop();
    stopStreamTracks();

    if (videoRef.current) {
      try {
        videoRef.current.onloadedmetadata = null;
        videoRef.current.srcObject = null;
      } catch {}
    }

    setStream(null);
    setIsWebcamActive(false);
    playStartedRef.current = false;

    hardResetUiState();
  };

  const startWebcam = async () => {
    if (isBlocked) {
      toast.error(t('faceLogin.blocked', 'Face ID is blocked. Please use email/password login.'), {
        duration: 5000,
      });
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error(
          'Camera access is not supported in this browser. Please use Chrome, Edge, or Firefox.',
        );
        return;
      }

      if (isWebcamActive || streamRef.current) {
        console.warn('⚠️ Webcam already active, ignoring startWebcam');
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: selectedCamera
          ? { deviceId: { exact: selectedCamera }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsWebcamActive(true);

      // дождаться, когда React нарисует <video/>
      await new Promise((r) => setTimeout(r, 0));

      const waitForVideo = async (maxAttempts = 20) => {
        for (let i = 0; i < maxAttempts; i++) {
          if (videoRef.current) return true;
          await new Promise((r) => setTimeout(r, 50));
        }
        return false;
      };

      const ok = await waitForVideo();
      if (!ok || !videoRef.current) {
        toast.error(t('faceLogin.videoNotFound', 'Video element not found. Please try again.'));
        stopWebcam();
        return;
      }

      videoRef.current.srcObject = mediaStream;

      const playVideoOnce = async () => {
        if (!videoRef.current) return;
        if (playStartedRef.current) return;
        playStartedRef.current = true;

        try {
          await videoRef.current.play();
          startDetectionLoop();
        } catch (err) {
          console.error('❌ Failed to play video:', err);
          toast.error(t('faceLogin.videoPlaybackFailed', 'Failed to start video playback'));
          playStartedRef.current = false;
        }
      };

      videoRef.current.onloadedmetadata = () => {
        playVideoOnce();
      };

      // fallback
      setTimeout(() => {
        if (videoRef.current && streamRef.current && isWebcamActive) playVideoOnce();
      }, 1000);
    } catch (error: any) {
      console.error('❌ Error accessing webcam:', error);
      stopWebcam();

      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        toast.error(
          'Camera permission denied. Please allow camera access in your browser settings.',
          {
            duration: 6000,
            description: 'Click the lock icon in the address bar and allow camera access.',
          },
        );
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        toast.error('No camera found. Please connect a camera and try again.');
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        toast.error(
          'Camera is already in use by another application. Please close other apps using the camera.',
        );
      } else {
        toast.error(`Unable to access camera: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  // ===== Detection loop =====
  const startDetectionLoop = () => {
    if (!videoRef.current) return;
    if (!streamRef.current) return;

    if (loopStartedRef.current) return;
    loopStartedRef.current = true;

    // reset for new session
    hardResetUiState();

    intervalRef.current = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || !streamRef.current) {
        stopDetectionLoop();
        return;
      }

      // пока идёт логин — не гоняем детекцию
      if (processingRef.current) return;

      // предотвращаем overlapping вызовы detectFace
      if (detectionInProgressRef.current) return;

      if (video.readyState < 2) return;

      try {
        detectionInProgressRef.current = true;

        const detection = await detectFace(video);
        const faceFound = !!detection;

        detectionInProgressRef.current = false;

        if (!faceFound) {
          noFaceFramesRef.current += 1;

          if (faceDetectedRef.current) {
            faceDetectedRef.current = false;
            setFaceDetected(false);
          }

          // мягкий сброс после нескольких кадров без лица
          if (noFaceFramesRef.current >= 3) {
            progressRef.current = 0;
            setScanningProgress(0);

            qualityRef.current = 'poor';
            setDetectionQuality('poor');

            lastDescriptorRef.current = null;

            autoTriggeredRef.current = false;
            setAutoLoginTriggered(false);
          }
          return;
        }

        // face found
        noFaceFramesRef.current = 0;

        if (!faceDetectedRef.current) {
          faceDetectedRef.current = true;
          setFaceDetected(true);
        }

        // cache descriptor
        lastDescriptorRef.current = detection!.descriptor;

        // progress via ref (не через prev => prev+..)
        const nextProgress = Math.min(progressRef.current + 20, 100);
        progressRef.current = nextProgress;
        setScanningProgress(nextProgress);

        // quality via ref
        const box = detection!.detection.box;
        const faceSize = box.width * box.height;

        let quality: 'poor' | 'good' | 'excellent' = 'poor';
        if (faceSize > 40000) quality = 'excellent';
        else if (faceSize > 20000) quality = 'good';

        qualityRef.current = quality;
        setDetectionQuality(quality);

        // auto-trigger (только ref)
        const now = Date.now();

        const shouldTrigger =
          (qualityRef.current === 'good' || qualityRef.current === 'excellent') &&
          progressRef.current >= 100 &&
          !autoTriggeredRef.current &&
          !processingRef.current &&
          now - lastAttemptRef.current >= 5000;

        if (shouldTrigger) {
          if (!allFaceDescriptors || allFaceDescriptors.length === 0) {
            toast.error('No registered faces found. Please register your face first.', {
              id: 'no-faces',
            });

            progressRef.current = 0;
            setScanningProgress(0);

            autoTriggeredRef.current = false;
            setAutoLoginTriggered(false);
            return;
          }

          autoTriggeredRef.current = true;
          lastAttemptRef.current = now;
          setAutoLoginTriggered(true);
          setLastAttemptTime(now);

          console.log('🚀 Auto-triggering attemptFaceLogin()');
          attemptFaceLogin();
        }
      } catch (e) {
        console.error('❌ Error in face detection loop:', e);
        detectionInProgressRef.current = false;
      }
    }, 500);
  };

  // ===== Login =====
  const attemptFaceLogin = useCallback(async () => {
    if (isBlocked) return;

    const video = videoRef.current;
    if (!video) return;

    // hard-guard
    if (processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);
    setMatchStatus('searching');

    try {
      if (!allFaceDescriptors || allFaceDescriptors.length === 0) {
        toast.error('No registered faces found in the system. Please register your face first.');
        autoTriggeredRef.current = false;
        setAutoLoginTriggered(false);
        return;
      }

      // prefer cached descriptor
      let descriptor = lastDescriptorRef.current;
      if (!descriptor) {
        const det = await detectFace(video);
        if (!det) {
          throw new Error(
            t(
              'faceLogin.noFaceDetected',
              'No face detected. Please position your face in the frame.',
            ),
          );
        }
        descriptor = det.descriptor;
      }

      const knownFaces = allFaceDescriptors.map((user: any) => ({
        userId: user.userId,
        name: user.name,
        descriptor: user.faceDescriptor,
        email: user.email,
      }));

      const bestMatch = await findBestMatch(
        descriptor,
        knownFaces.map(({ userId, name, descriptor }) => ({ userId, name, descriptor })),
      );

      if (!bestMatch) {
        setMatchStatus('not_found');
        toast.error('No matching face found.');
        autoTriggeredRef.current = false;
        setAutoLoginTriggered(false);
        return;
      }

      if (!isFaceMatch(bestMatch.distance, 0.6)) {
        // record failed attempt (best-effort)
        try {
          const result = await recordFaceIdAttempt({
            userId: bestMatch.userId as any,
            success: false,
          });
          setFailedAttempts(result.attempts);

          if (result.blocked) {
            setIsBlocked(true);
            toast.error(
              'Too many failed attempts. Face ID is now blocked. Please use email/password login.',
            );
            stopWebcam();
            return;
          }

          toast.error(`Face not recognized. Attempt ${result.attempts} of 3.`);
        } catch {
          const newAttempts = failedAttempts + 1;
          setFailedAttempts(newAttempts);
          toast.error(`Face not recognized. Attempt ${newAttempts} of 3.`);

          if (newAttempts >= 3) {
            setIsBlocked(true);
            toast.error('Too many failed attempts. Face ID is now blocked.');
            stopWebcam();
            return;
          }
        }

        setMatchStatus('not_found');
        autoTriggeredRef.current = false;
        setAutoLoginTriggered(false);
        return;
      }

      // success
      try {
        await recordFaceIdAttempt({ userId: bestMatch.userId as any, success: true });
      } catch {}

      setFailedAttempts(0);
      setMatchedUser(bestMatch.name);
      setMatchStatus('found');

      const matchedUserData = allFaceDescriptors.find((u: any) => u.userId === bestMatch.userId);
      if (!matchedUserData) throw new Error('User data not found');

      const response = await fetch('/api/auth/face-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: matchedUserData.email, isFaceLogin: true }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData?.error === 'maintenance') {
          window.location.href = `/login?maintenance=true${errorData.organizationId ? `&org=${errorData.organizationId}` : ''}`;
          return;
        }
        throw new Error(errorData?.error || 'Login failed');
      }

      const data = await response.json();

      if (data?.session) {
        const { login } = useAuthStore.getState();
        login({
          id: data.session.userId,
          name: data.session.name,
          email: data.session.email,
          role: data.session.role,
          organizationId: data.session.organizationId,
          organizationSlug: data.session.organizationSlug,
          organizationName: data.session.organizationName,
          department: data.session.department,
          position: data.session.position,
          employeeType: data.session.employeeType,
          avatar: data.session.avatar,
        });
      }

      // stop before redirect
      stopWebcam();

      const params = new URLSearchParams(window.location.search);
      const nextUrl = params.get('next');
      window.location.href = nextUrl || '/dashboard';
    } catch (error: any) {
      console.error('❌ Error during face login:', error);

      const msg = error?.message?.includes('Failed to fetch')
        ? 'Network error: Cannot connect to server. Please check your connection.'
        : error?.message || 'Failed to login with Face ID. Please try again.';

      toast.error(msg, { id: 'face-login-error', duration: 5000 });

      setMatchStatus('not_found');

      // allow retry
      autoTriggeredRef.current = false;
      setAutoLoginTriggered(false);

      progressRef.current = 0;
      setScanningProgress(0);

      setTimeout(() => setMatchStatus('idle'), 2000);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [isBlocked, allFaceDescriptors, recordFaceIdAttempt, failedAttempts, t]);

  return (
    <Card className="p-6 bg-[var(--surface-base)] border-[var(--border-primary)]">
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 mb-4">
            <ScanFace className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-(--text-primary)">
            {t('faceLogin.title', 'Face ID Login')}
          </h3>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            {t('faceLogin.subtitle', 'Position your face in the camera to login')}
          </p>
        </div>

        {/* Camera Preview */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          {!isWebcamActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
              <Camera className="w-16 h-16 mb-4" />
              <p className="text-sm">{t('faceLogin.cameraNotActive', 'Camera not active')}</p>
            </div>
          )}

          {isWebcamActive && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Face detection indicator */}
              <div className="absolute top-4 right-4 space-y-2">
                {faceDetected ? (
                  <div className="flex items-center gap-2 bg-green-500/90 text-white px-3 py-1.5 rounded-full text-sm animate-pulse">
                    <CheckCircle className="w-4 h-4" />
                    Face Detected
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-red-500/90 text-white px-3 py-1.5 rounded-full text-sm">
                    <XCircle className="w-4 h-4" />
                    No Face
                  </div>
                )}

                {/* Quality indicator */}
                {faceDetected && (
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-white ${
                      detectionQuality === 'excellent'
                        ? 'bg-green-600/90'
                        : detectionQuality === 'good'
                          ? 'bg-yellow-600/90'
                          : 'bg-orange-600/90'
                    }`}
                  >
                    {detectionQuality === 'excellent' && '✓ Excellent'}
                    {detectionQuality === 'good' && '◐ Good'}
                    {detectionQuality === 'poor' && '⚠ Move Closer'}
                  </div>
                )}
              </div>

              {/* Match status */}
              {matchStatus !== 'idle' && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  {matchStatus === 'searching' && (
                    <div className="flex items-center gap-2 bg-blue-500/90 text-white px-4 py-2 rounded-full text-sm">
                      <ShieldLoader size="xs" variant="inline" />
                      Searching for match...
                    </div>
                  )}
                  {matchStatus === 'found' && matchedUser && (
                    <div className="flex items-center gap-2 bg-green-500/90 text-white px-4 py-2 rounded-full text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Welcome, {matchedUser}!
                    </div>
                  )}
                  {matchStatus === 'not_found' && (
                    <div className="flex items-center gap-2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm">
                      <XCircle className="w-4 h-4" />
                      Face not recognized
                    </div>
                  )}
                </div>
              )}

              {/* Face frame guide with animated scanning */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <div
                    className={`w-64 h-80 border-4 rounded-2xl transition-all duration-300 ${
                      faceDetected
                        ? 'border-green-500/70 shadow-[0_0_20px_rgba(34,197,94,0.5)]'
                        : 'border-white/50'
                    }`}
                  >
                    {faceDetected && scanningProgress > 0 && (
                      <>
                        <div
                          className="absolute left-0 right-0 h-1 bg-linear-to-r from-transparent via-green-400 to-transparent animate-pulse"
                          style={{ top: `${scanningProgress}%`, transition: 'top 0.35s ease-out' }}
                        />
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-400 animate-pulse" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-400 animate-pulse" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-400 animate-pulse" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-400 animate-pulse" />
                      </>
                    )}
                  </div>

                  {faceDetected && scanningProgress > 0 && (
                    <div className="absolute -bottom-8 left-0 right-0 text-center">
                      <div className="text-white text-xs bg-black/50 px-2 py-1 rounded">
                        {t('faceLogin.scanning', 'Scanning')}: {scanningProgress}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Camera Selection */}
        {!isWebcamActive && cameras.length > 1 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-(--text-secondary)">Select Camera:</label>
            <CustomSelect
              value={selectedCamera}
              onChange={setSelectedCamera}
              fullWidth
              options={cameras.map((camera) => ({
                value: camera.deviceId,
                label: camera.label || `Camera ${cameras.indexOf(camera) + 1}`,
              }))}
              triggerClassName="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-base)] text-(--text-primary)"
              dropdownClassName="bg-[var(--surface-base)] border border-[var(--border-primary)] text-[var(--text-primary)]"
            />
          </div>
        )}

        {/* Attempts counter */}
        {failedAttempts > 0 && !isBlocked && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
            <p className="text-sm text-orange-600 dark:text-orange-400 text-center">
              ⚠️ Failed attempts: {failedAttempts} of 3
            </p>
          </div>
        )}

        {/* Blocked warning */}
        {isBlocked && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium">
              🚫 Face ID Blocked
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 text-center mt-1">
              Too many failed attempts. Please use email/password login.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {!isWebcamActive && !isBlocked && (
            <Button onClick={startWebcam} className="flex-1">
              <Camera className="w-4 h-4 mr-2" />
              {t('faceLogin.start', 'Start Face Login')}
            </Button>
          )}

          {isWebcamActive && !isBlocked && (
            <>
              {isProcessing ? (
                <div className="flex-1 flex items-center justify-center gap-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-4 py-3 rounded-lg border border-blue-500/20">
                  <ShieldLoader size="xs" variant="inline" />
                  <span className="text-sm font-medium">
                    {t('faceLogin.authenticating', 'Authenticating...')}
                  </span>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg border border-green-500/20">
                  <ScanFace className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {scanningProgress >= 100
                      ? t('faceLogin.ready', 'Ready to login...')
                      : `${t('faceLogin.scanning', 'Scanning')}... ${scanningProgress}%`}
                  </span>
                </div>
              )}
              <Button onClick={stopWebcam} variant="outline">
                {t('common.cancel', 'Cancel')}
              </Button>
            </>
          )}

          {isBlocked && (
            <Button onClick={() => router.push('/login')} className="flex-1" variant="default">
              {t('faceLogin.useEmailPassword', 'Use Email/Password Login')}
            </Button>
          )}
        </div>

        {/* No faces registered warning */}
        {allFaceDescriptors !== undefined && allFaceDescriptors.length === 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
            <p className="text-sm text-orange-600 dark:text-orange-400 text-center font-medium">
              {t('faceLogin.noRegisteredFacesTitle', '⚠️ No Registered Faces')}
            </p>
            <p className="text-xs text-orange-600/80 dark:text-orange-400/80 text-center mt-1">
              {t('faceLogin.noUsersRegistered', 'No users have registered their face yet')}.{' '}
              {t(
                'faceLogin.registerFaceFirst',
                'Please register your face in your profile settings first',
              )}
              .
            </p>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-xs text-(--text-secondary)">
            {t(
              'faceLogin.autoLoginInfo',
              '🚀 Automatic Login: Position your face in the camera frame. The system will automatically authenticate you when your face is detected and scanned (100%).',
            )}
            {allFaceDescriptors !== undefined && (
              <span className="block mt-1 text-[var(--text-tertiary)]">
                📊 {allFaceDescriptors.length} {t('faceLogin.registeredFace', 'registered face')}
                {allFaceDescriptors.length !== 1 ? 's' : ''}{' '}
                {t('faceLogin.inSystem', 'in the system')}
              </span>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}
