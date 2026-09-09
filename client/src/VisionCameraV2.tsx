import { useEffect, useRef, useState } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
type Obj = { name: string; confidence: number };
type Result = { description: string; objects: Obj[]; environment: string; insights: string; confidence: string };

export function VisionCameraV2() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(localStorage.getItem('nexa-camera') || 'environment');
  const [ratio, setRatio] = useState(localStorage.getItem('nexa-ratio') || '16:9');
  const [rotation, setRotation] = useState(Number(localStorage.getItem('nexa-rotation') || '0'));
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    localStorage.setItem('nexa-camera', camera); localStorage.setItem('nexa-ratio', ratio); localStorage.setItem('nexa-rotation', String(rotation));
    let cancelled = false;
    const start = async () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camera }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach(t => t.stop());
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setActive(true); setError('');
      } catch { setActive(false); setError('Camera permission or camera mode is unavailable.'); }
    };
    void start();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [camera]);

  const capture = () => {
    const v = videoRef.current; if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    c.toBlob(blob => { if (!blob) return; const f = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' }); setFile(f); setImage(URL.createObjectURL(f)); setResult(null); }, 'image/jpeg', 0.92);
  };
  const chooseFile = (f: File) => { if (!['image/jpeg','image/png','image/webp'].includes(f.type) || f.size > 10 * 1024 * 1024) return setError('Use JPG, PNG or WEBP up to 10 MB.'); setFile(f); setImage(URL.createObjectURL(f)); setResult(null); setError(''); };
  const analyze = async () => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const form = new FormData(); form.append('image', file);
      const r = await fetch(`${API}/api/vision/analyze`, { method: 'POST', body: form, credentials: 'include' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message || 'Vision analysis failed');
      setResult(body); 
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to analyze image.'); }
    finally { setBusy(false); }
  };
  const ratioStyle = ratio === '19:9' ? '19 / 9' : '16 / 9';
  return <div>
    <div className="page-head"><div><div className="eyebrow">AI VISION · OBJECT DETECTION</div><h2>Vision Camera</h2><p>DETECTION ENGINE · <span className="live">{active ? 'ACTIVE' : 'READY'}</span></p></div><div className="status"><i/> {busy ? 'ANALYZING...' : 'SYSTEM ONLINE'}</div></div>
    <div className="vision-grid">
      <div className="camera-card" style={{ aspectRatio: ratioStyle, overflow: 'hidden' }}>
        {image ? <img src={image} alt="Captured frame" style={{ width:'100%',height:'100%',objectFit:'cover',transform:`rotate(${rotation}deg) scale(${rotation % 180 ? 1.35 : 1})` }} /> : <video ref={videoRef} playsInline muted style={{ width:'100%',height:'100%',objectFit:'cover',transform:`rotate(${rotation}deg)` }} />}
        <div className="hud"><span>NEXA VISION</span><span>{ratio}</span><b>OBJECT DETECTION<br/>{active ? 'READY' : 'WAITING'}</b></div>
      </div>
      <div className="controls">
        <button className="shutter" onClick={capture}>●</button><button className="btn" onClick={()=>fileRef.current?.click()}>UPLOAD IMAGE</button><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)chooseFile(f)}}/>
        <button className="btn" onClick={()=>setCamera(camera === 'environment' ? 'user' : 'environment')}>CAMERA: {camera === 'environment' ? 'REAR' : 'FRONT'}</button>
        <button className="btn" onClick={()=>{const n=(rotation+90)%360;setRotation(n)}}>ROTATE {rotation}°</button>
        <button className="btn" onClick={()=>setRatio(ratio === '16:9' ? '19:9' : '16:9')}>RATIO {ratio}</button>
        <button className="btn primary" disabled={!file||busy} onClick={()=>void analyze()}>{busy ? 'SCANNING...' : 'ANALYZE OBJECTS'}</button>
        {error && <p className="error">{error}</p>}
      </div>
      {result && <div className="result-card"><div className="eyebrow">OBJECT DETECTION COMPLETE</div><h3>{result.objects.length} OBJECT(S) DETECTED</h3><p>{result.description}</p><div className="result-pills">{result.objects.map((o,i)=><span key={`${o.name}-${i}`}>{o.name.toUpperCase()} · {Math.round(o.confidence)}%</span>)}</div><p><b>Environment:</b> {result.environment}</p><p><b>Insights:</b> {result.insights}</p></div>}
    </div>
  </div>;
}
