"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Monitor, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveCall } from "./ChatClient";

interface Props {
  call: ActiveCall;
  currentUserId: Id<"users">;
  currentUserName: string;
  currentUserAvatar?: string;
  onEnd: () => void;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function CallModal({ call, currentUserId, currentUserName, currentUserAvatar, onEnd }: Props) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(call.type === "video");
  const [speakerOn, setSpeakerOn] = useState(true);
  const [callStatus, setCallStatus] = useState<"ringing" | "connecting" | "active" | "ended">("ringing");
  const [duration, setDuration] = useState(0);
  const [peerConnected, setPeerConnected] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const endCallMutation = useMutation(api.chat.endCall);
  const answerCallMutation = useMutation(api.chat.answerCall);
  const updateIceMutation = useMutation(api.chat.updateIceCandidates);
  const callData = useQuery(api.chat.getActiveCall, { conversationId: call.conversationId });

  const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "ac986faa3d8fec75bb7c4aff",
      credential: "WOCnG2giai1RFd3N",
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "ac986faa3d8fec75bb7c4aff",
      credential: "WOCnG2giai1RFd3N",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "ac986faa3d8fec75bb7c4aff",
      credential: "WOCnG2giai1RFd3N",
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "ac986faa3d8fec75bb7c4aff",
      credential: "WOCnG2giai1RFd3N",
    },
  ];

  const [iceServers, setIceServers] = useState<RTCIceServer[]>(FALLBACK_ICE_SERVERS);

  // Fetch TURN credentials from Metered.ca
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const response = await fetch(
          "https://hr-project.metered.live/api/v1/turn/credentials?apiKey=7191ce6de881f9924fda86a5d47a8ee5adc1"
        );
        const servers = await response.json();
        if (Array.isArray(servers) && servers.length > 0) {
          setIceServers(servers);
        }
      } catch {
        // fallback to STUN only
      }
    };
    fetchIceServers();
  }, []);

  // Format duration
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const cleanup = useCallback(() => {
    // Stop ALL tracks — browser immediately releases camera/mic indicator
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      localStreamRef.current = null;
    }
    // Detach srcObject so browser fully releases camera/mic
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    // Remove handlers before closing to avoid stale callbacks
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // Initialize media and WebRTC
  const initMedia = useCallback(async () => {
    try {
      setMediaError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: call.type === "video",
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = async (event) => {
        if (event.candidate && call.callId) {
          const candidates = [JSON.stringify(event.candidate)];
          await updateIceMutation({ callId: call.callId, userId: currentUserId, candidates });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setPeerConnected(true);
          setCallStatus("active");
          // Start duration timer
          durationTimerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallStatus("active");
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          handleEnd();
        }
      };

      if (call.isInitiator) {
        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await answerCallMutation({ callId: call.callId, userId: currentUserId, answer: JSON.stringify(offer) });
        setCallStatus("connecting");
      }
    } catch (err: any) {
      console.error("Media error:", err);
      
      if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        // Device in use - show message and auto-retry
        const message = 
          retryCount >= 3
            ? "Не удалось получить доступ к камере/микрофону после нескольких попыток. Закройте все другие браузеры/приложения и попробуйте снова."
            : `Камера или микрофон уже используются. Закройте другие вкладки браузера (особенно с этим же аккаунтом) и попробуйте ещё раз. Попытка ${retryCount + 1}...`;
        
        setMediaError(message);
        
        // Auto-retry after delay (exponential backoff)
        if (retryCount < 3) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Max 5 seconds
          retryTimerRef.current = setTimeout(() => {
            setRetryCount((c) => c + 1);
            initMedia();
          }, delay);
        }
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setMediaError("Доступ к камере/микрофону запрещён. Разрешите доступ в настройках браузера и перезагрузите страницу.");
      } else if (err.name === "NotFoundError") {
        setMediaError("Камера или микрофон не найдены. Проверьте подключение устройств.");
      } else {
        setMediaError("Не удалось получить доступ к камере/микрофону. Попробуйте снова.");
      }
    }
  }, [call, currentUserId, iceServers, retryCount]);

  useEffect(() => {
    initMedia();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — cleanup is stable (no deps), initMedia runs once

  // Poll for answer from remote peer
  useEffect(() => {
    if (!callData || !peerConnectionRef.current) return;
    const pc = peerConnectionRef.current;

    // Process ICE candidates from remote
    callData.participants?.forEach(async (p) => {
      if (p.userId !== currentUserId && p.iceCandidates) {
        for (const candStr of p.iceCandidates) {
          try {
            const cand = new RTCIceCandidate(JSON.parse(candStr));
            if (pc.remoteDescription) await pc.addIceCandidate(cand);
          } catch {}
        }
      }

      // Process answer (if we're the initiator)
      if (!call.isInitiator && p.userId !== currentUserId && p.offer && !pc.remoteDescription) {
        try {
          const offerSDP = JSON.parse(p.offer);
          await pc.setRemoteDescription(new RTCSessionDescription(offerSDP));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await answerCallMutation({ callId: call.callId, userId: currentUserId, answer: JSON.stringify(answer) });
        } catch {}
      }

      if (call.isInitiator && p.userId !== currentUserId && p.answer && !pc.remoteDescription) {
        try {
          const answerSDP = JSON.parse(p.answer);
          await pc.setRemoteDescription(new RTCSessionDescription(answerSDP));
        } catch {}
      }
    });
  }, [callData]);

  const handleEnd = async () => {
    cleanup();
    setCallStatus("ended");
    try { await endCallMutation({ callId: call.callId, userId: currentUserId }); } catch {}
    onEnd();
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  };

  const statusText = {
    ringing: "Ringing…",
    connecting: "Connecting…",
    active: formatDuration(duration),
    ended: "Call ended",
  }[callStatus];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div
        className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          minHeight: call.type === "video" ? "500px" : "320px",
        }}
      >
        {/* Video area */}
        {call.type === "video" && (
          <div className="relative w-full h-72 bg-black rounded-t-3xl overflow-hidden">
            {/* Remote video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ display: peerConnected ? "block" : "none" }}
            />
            {!peerConnected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Avatar className="w-20 h-20 mx-auto mb-3 ring-4 ring-white/20">
                    <AvatarFallback className="text-2xl font-bold text-white bg-gradient-to-br from-purple-600 to-blue-600">
                      {getInitials(call.remoteUserName ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-white font-semibold">{call.remoteUserName ?? "Connecting…"}</p>
                </div>
              </div>
            )}
            {/* Local video (PiP) */}
            <div className="absolute bottom-3 right-3 w-24 h-16 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!camOn && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <VideoOff className="w-5 h-5 text-gray-400" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio call UI */}
        {call.type === "audio" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className={cn("relative", callStatus === "active" && "animate-pulse")}>
              <Avatar className="w-24 h-24 ring-4 ring-white/20">
                <AvatarFallback className="text-3xl font-bold text-white bg-gradient-to-br from-purple-600 to-blue-600">
                  {getInitials(call.remoteUserName ?? "?")}
                </AvatarFallback>
              </Avatar>
              {callStatus === "active" && (
                <>
                  <span className="absolute inset-0 rounded-full ring-4 ring-green-500/30 animate-ping" />
                  <span className="absolute inset-0 rounded-full ring-4 ring-green-500/20 animate-ping" style={{ animationDelay: "0.5s" }} />
                </>
              )}
            </div>
            <p className="text-white text-xl font-semibold">{call.remoteUserName ?? "Unknown"}</p>
          </div>
        )}

        {/* Media Error */}
        {mediaError && (
          <div className="mx-4 mb-3 px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-center">
            <p className="text-red-300 text-xs leading-relaxed">{mediaError}</p>
            <div className="flex gap-2 mt-2 justify-center">
              {retryCount < 3 && (
                <button
                  onClick={() => {
                    setRetryCount((c) => c + 1);
                    initMedia();
                  }}
                  className="text-xs px-3 py-1 rounded bg-blue-500/30 text-blue-300 hover:bg-blue-500/50 transition"
                >
                  Попробовать снова
                </button>
              )}
              <button
                onClick={handleEnd}
                className="text-xs px-3 py-1 rounded bg-red-500/30 text-red-300 hover:bg-red-500/50 transition"
              >
                Закрыть звонок
              </button>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="text-center pb-3">
          <p className="text-white/70 text-sm font-mono">{statusText}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 pb-8 px-6">
          <ControlBtn
            icon={micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            label={micOn ? "Mute" : "Unmute"}
            onClick={toggleMic}
            active={!micOn}
          />
          {call.type === "video" && (
            <ControlBtn
              icon={camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              label={camOn ? "Camera off" : "Camera on"}
              onClick={toggleCam}
              active={!camOn}
            />
          )}
          <ControlBtn
            icon={speakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            label={speakerOn ? "Mute speaker" : "Unmute"}
            onClick={() => setSpeakerOn(!speakerOn)}
            active={!speakerOn}
          />
          {/* End call */}
          <button
            onClick={handleEnd}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-all hover:scale-110 shadow-lg shadow-red-500/30"
            title="End call"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Caller info */}
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-2">
            <Avatar className="w-7 h-7">
              {currentUserAvatar && <img src={currentUserAvatar} className="w-full h-full object-cover rounded-full" />}
              <AvatarFallback className="text-xs text-white bg-gray-700">
                {getInitials(currentUserName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-white/70 text-xs">{currentUserName}</span>
          </div>
        </div>

        {/* Call type badge */}
        <div className="absolute top-4 right-4">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 text-white/70 text-xs">
            {call.type === "video" ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
            {call.type === "video" ? "Video" : "Audio"} call
          </span>
        </div>
      </div>
    </div>
  );
}

function ControlBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group"
      title={label}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110",
          active ? "bg-white/30" : "bg-white/10 hover:bg-white/20"
        )}
      >
        <span className="text-white">{icon}</span>
      </div>
      <span className="text-[10px] text-white/50 group-hover:text-white/70">{label}</span>
    </button>
  );
}
