import { useEffect, useRef, useState } from 'react';

export function useCamera(enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError('Camera API unavailable'); return; }
      try {
        const preferred = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
        let stream: MediaStream;
        try { stream = await navigator.mediaDevices.getUserMedia(preferred); }
        catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
        setActive(true); setError(null);
      } catch { setActive(false); setError('Unable to access camera. Check browser permission.'); }
    };
    void start();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, [enabled]);
  const capture = () => {
    const video = videoRef.current; if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.88);
  };
  return { videoRef, active, error, capture };
}
