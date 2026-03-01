/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Settings, Play, Pause, Type, Music, Download, X, User, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
type VisualizerType = 'bars' | 'wave' | 'spiral' | 'particles' | 'ring' | 'strings' | 'orbit' | 'spikes' | 'laser' | 'nebula' | 'aura';
type CenterMode = 'logo' | 'profile' | 'text' | 'none';

interface VisualizerSettings {
  primaryColor: string;
  secondaryColor: string;
  sensitivity: number;
  barWidth: number;
  radius: number;
  type: VisualizerType;
  centerMode: CenterMode;
  centerText: string;
  centerTextSize: number;
  centerColor: string;
  logoScale: number;
  bgBlur: number;
  bgOpacity: number;
  mirror: boolean;
  rotationSpeed: number;
  pulseEnabled: boolean;
  glowEnabled: boolean;
  trailEnabled: boolean;
  colorCycle: boolean;
  shakeEnabled: boolean;
  echoEnabled: boolean;
  invertColors: boolean;
  bgParticlesEnabled: boolean;
  performanceMode: boolean;
}

// Helper to extract colors from an image
const extractColors = (imgSrc: string): Promise<[string, string]> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(['#00ffff', '#ff00ff']);

      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);

      const imageData = ctx.getImageData(0, 0, 100, 100).data;
      let r = 0, g = 0, b = 0;
      let count = 0;

      // Simple average for primary
      for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
        count++;
      }

      const toHex = (c: number) => {
        const hex = Math.round(c).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };

      const avgR = r / count;
      const avgG = g / count;
      const avgB = b / count;

      const primary = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;

      // Generate a complementary/secondary color (simple shift)
      // Shift hue by 180 degrees roughly by inverting or shifting RGB
      const secR = (avgR + 128) % 255;
      const secG = (avgG + 80) % 255;
      const secB = (avgB + 200) % 255;

      const secondary = `#${toHex(secR)}${toHex(secG)}${toHex(secB)}`;

      resolve([primary, secondary]);
    };
    img.onerror = () => resolve(['#00ffff', '#ff00ff']);
  });
};

// ─── Circle Crop Modal ───────────────────────────────────────────────────────
interface CropModalProps {
  src: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

function CropModal({ src, onConfirm, onCancel }: CropModalProps) {
  const SIZE = 300; // diameter of crop circle in px
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
      // default zoom: fit the shorter side to the circle
      const minSide = Math.min(img.naturalWidth, img.naturalHeight);
      setZoom(SIZE / minSide);
      setOffset({ x: 0, y: 0 });
    };
  }, [src]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.mx),
      y: dragStart.current.oy + (e.clientY - dragStart.current.my),
    });
  };
  const onMouseUp = () => setDragging(false);

  // Touch support
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragStart.current = { mx: t.clientX, my: t.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    setOffset({
      x: dragStart.current.ox + (t.clientX - dragStart.current.mx),
      y: dragStart.current.oy + (t.clientY - dragStart.current.my),
    });
  };

  const handleConfirm = () => {
    if (!imgRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    // clip to circle
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const img = imgRef.current;
    // Match the CSS transform: translate to center + offset, then scale, draw at natural size
    ctx.translate(SIZE / 2 + offset.x, SIZE / 2 + offset.y);
    ctx.scale(zoom, zoom);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    onConfirm(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-6 shadow-2xl w-[380px]">
        <div className="text-center space-y-1">
          <h2 className="text-white font-semibold text-lg tracking-tight">Adjust Profile</h2>
          <p className="text-neutral-400 text-xs">Drag to reposition · Zoom to resize</p>
        </div>

        {/* Circle crop preview */}
        <div
          className="relative overflow-hidden rounded-full cursor-grab active:cursor-grabbing select-none shadow-inner bg-black"
          style={{ width: SIZE, height: SIZE }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
        >
          {imgLoaded && (
            <img
              src={src}
              alt="crop"
              draggable={false}
              style={{
                position: 'absolute',
                // Keep natural size — zoom via CSS transform only (no stretching)
                width: 'auto',
                height: 'auto',
                maxWidth: 'none',
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          )}
          {/* Circular guide ring */}
          <div className="absolute inset-0 rounded-full ring-2 ring-white/20 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />
        </div>

        {/* Zoom */}
        <div className="w-full space-y-3">
          <div className="flex justify-between text-xs font-medium text-neutral-400">
            <span>Zoom</span>
            <span className="text-white">{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-neutral-300 text-sm font-medium hover:bg-white/5 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors shadow-lg"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [centerImage, setCenterImage] = useState<string | null>(null); // Used for Profile mode
  const [logoImage, setLogoImage] = useState<string | null>(null);     // Used for Logo mode
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [recordingQuality, setRecordingQuality] = useState<'1080p' | '2k' | '4k'>('1080p');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Cached Image objects for canvas drawing (avoids creating new Image every frame)
  const centerImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  const [settings, setSettings] = useState<VisualizerSettings>({
    primaryColor: '#ffffff',
    secondaryColor: '#666666',
    sensitivity: 1.5,
    barWidth: 3,
    radius: 150,
    type: 'bars',
    centerMode: 'text',
    centerText: 'AUDIO',
    centerTextSize: 24,
    centerColor: '#000000',
    logoScale: 0.5,
    bgBlur: 10,
    bgOpacity: 0.5,
    mirror: true,
    rotationSpeed: 0,
    pulseEnabled: false,
    glowEnabled: false,
    trailEnabled: false,
    colorCycle: false,
    shakeEnabled: false,
    echoEnabled: false,
    invertColors: false,
    bgParticlesEnabled: false,
    performanceMode: false,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>(0);
  // Always-current settings ref so the animation loop never reads stale state
  const settingsRef = useRef<VisualizerSettings>(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const resolutionMap = { '1080p': [1920, 1080], '2k': [2560, 1440], '4k': [3840, 2160] };

  const exportVideo = async () => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !audioFile) return;

    setIsExporting(true);
    recordedChunksRef.current = [];

    // Ensure AudioContext is ready
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      sourceRef.current = audioContextRef.current.createMediaElementSource(audio);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const [w, h] = resolutionMap[recordingQuality];
    canvas.width = w;
    canvas.height = h;

    const stream = canvas.captureStream(60);

    // Mix audio into the recording stream
    if (audioContextRef.current) {
      const dest = audioContextRef.current.createMediaStreamDestination();
      if (analyserRef.current) analyserRef.current.connect(dest);
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 40_000_000 });
    mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sonic-visualizer-${recordingQuality}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
      setIsExporting(false);
      setIsPlaying(false);
    };

    // Start from beginning and auto-stop when audio ends
    audio.currentTime = 0;
    audio.onended = () => { mr.stop(); audio.onended = () => setIsPlaying(false); };
    mr.start();
    audio.play();
    setIsPlaying(true);
    mediaRecorderRef.current = mr;
  };

  // Initialize Audio Context
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
        setIsPlaying(false);
      }
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgImage(url);
      setBgFile(file);
    }
  };

  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Used to physically shake the entire screen DOM
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });

  const handleCenterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      // Open crop modal instead of directly applying
      setCropSrc(url);
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleCropConfirm = async (croppedDataUrl: string) => {
    setCropSrc(null);
    setCenterImage(croppedDataUrl);
    setSettings(s => ({ ...s, centerMode: 'profile' }));

    // Preload and cache the cropped image
    const img = new Image();
    img.src = croppedDataUrl;
    img.onload = () => { centerImgRef.current = img; };

    // Auto-detect colors from the cropped image
    const [primary, secondary] = await extractColors(croppedDataUrl);
    setSettings(s => ({ ...s, primaryColor: primary, secondaryColor: secondary }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoImage(url);
      setSettings(s => ({ ...s, centerMode: 'logo' }));

      // Preload and cache the logo image
      const img = new Image();
      img.src = url;
      img.onload = () => { logoImgRef.current = img; };
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current || !audioFile) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048; // Higher resolution

      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    let rotation = 0;
    let particles: { x: number, y: number, speed: number, angle: number, life: number, color: string, wobbleOffset?: number }[] = [];
    let nebParticles: { x: number, y: number, vx: number, vy: number, life: number, size: number, color: string }[] = [];
    let bgParticles: { x: number, y: number, vx: number, vy: number, life: number, size: number, color: string }[] = [];
    const dataArray = new Uint8Array(1024);
    let colorCycleHue = 0;
    let lastFrameTime = 0;

    const renderFrame = (timestamp: number) => {
      animationRef.current = requestAnimationFrame(renderFrame);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const s = settingsRef.current;

      // Performance mode: throttle to 30fps
      const targetFps = s.performanceMode ? 30 : 60;
      if (timestamp - lastFrameTime < 1000 / targetFps) return;
      lastFrameTime = timestamp;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Performance mode: render at 50% resolution using CSS scale
      const scale = s.performanceMode ? 0.5 : 1;
      const targetW = Math.floor(window.innerWidth * scale);
      const targetH = Math.floor(window.innerHeight * scale);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        canvas.style.imageRendering = 'auto'; // Smooth quality drop, no retro blocking
      }

      if (analyserRef.current) {
        // Performance mode: use smaller FFT window
        if (s.performanceMode && analyserRef.current.fftSize !== 512) {
          analyserRef.current.fftSize = 512;
        } else if (!s.performanceMode && analyserRef.current.fftSize !== 2048) {
          analyserRef.current.fftSize = 2048;
        }
        analyserRef.current.getByteFrequencyData(dataArray);
      } else {
        dataArray.fill(0);
      }

      // Color cycle: auto-shift primary hue each frame
      if (s.colorCycle) {
        colorCycleHue = (colorCycleHue + 0.5) % 360;
        // We apply this via a CSS filter on the canvas ctx after saving
      }

      // logical coordinates
      const virtualWidth = window.innerWidth;
      const virtualHeight = window.innerHeight;

      ctx.save(); // Top level scale matching
      ctx.scale(scale, scale);

      // Trail: instead of solid clear, use destination-out to fade alpha so BG images show through
      if (s.trailEnabled) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'; // Color doesn't matter, only alpha does
        ctx.fillRect(0, 0, virtualWidth, virtualHeight);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.clearRect(0, 0, virtualWidth, virtualHeight);
      }

      const centerX = virtualWidth / 2;
      const centerY = virtualHeight / 2;

      // Draw background particles (behind everything else)
      if (s.bgParticlesEnabled) {
        let bassEnergy = 0;
        for (let i = 0; i < 10; i++) bassEnergy += dataArray[i];
        bassEnergy = bassEnergy / 10 / 255;

        // Spawn new background particles
        if (bgParticles.length < 150 && Math.random() < 0.3) {
          bgParticles.push({
            x: Math.random() * virtualWidth,
            y: Math.random() * virtualHeight,
            vx: (Math.random() - 0.5) * 0.5 * (1 + bassEnergy * 2),
            vy: (Math.random() - 0.5) * 0.5 * (1 + bassEnergy * 2) - 0.5, // Drift slightly up
            life: Math.random() * 0.5 + 0.5,
            size: Math.random() * 2 + 0.5,
            color: Math.random() > 0.5 ? s.primaryColor : s.secondaryColor
          });
        }

        ctx.save();
        for (let i = bgParticles.length - 1; i >= 0; i--) {
          const p = bgParticles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.002;

          if (p.x < 0) p.x = virtualWidth;
          if (p.x > virtualWidth) p.x = 0;
          if (p.y < 0) p.y = virtualHeight;
          if (p.y > virtualHeight) p.y = 0;

          if (p.life <= 0) {
            bgParticles.splice(i, 1);
            continue;
          }

          ctx.globalAlpha = p.life * 0.4 * (1 + bassEnergy); // Reacts to bass slightly
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        ctx.restore();
      }

      // Calculate Bass for Pulse and Shake
      let bassTotal = 0;
      let maxBass = 0;
      for (let i = 0; i < 20; i++) {
        bassTotal += dataArray[i];
        if (dataArray[i] > maxBass) maxBass = dataArray[i];
      }
      const bassAverage = bassTotal / 20;
      const pulseScale = s.pulseEnabled ? 1 + (bassAverage / 255) * 0.2 : 1;
      const currentRadius = s.radius * pulseScale;

      let shakeX = 0;
      let shakeY = 0;
      if (s.shakeEnabled && maxBass > 220) {
        const intensity = (maxBass - 220) / 35; // 0 to 1 scaling based on peak
        shakeX = (Math.random() - 0.5) * 30 * intensity;
        shakeY = (Math.random() - 0.5) * 30 * intensity;
      }

      // We apply shake to React state so DOM nodes (Canvas + BG Image) both shake. 
      // Only trigger React re-render if we are actively shaking OR if we need to reset back to 0.
      setShakeOffset(prev => {
        if (shakeX === 0 && shakeY === 0 && prev.x === 0 && prev.y === 0) return prev;
        return { x: shakeX, y: shakeY };
      });

      // Rotation
      rotation += s.rotationSpeed * 0.01;

      ctx.save();
      if (s.invertColors) ctx.filter = 'invert(1) hue-rotate(180deg)';

      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);

      // Glow effect: add canvas-wide blur shadow
      if (s.glowEnabled) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = s.colorCycle ? `hsl(${colorCycleHue},100%,60%)` : s.primaryColor;
      }

      const vizPrimaryColor = s.colorCycle ? `hsl(${colorCycleHue},100%,60%)` : s.primaryColor;
      const vizSecondaryColor = s.colorCycle ? `hsl(${(colorCycleHue + 120) % 360},100%,60%)` : s.secondaryColor;
      const vizSettings = s.colorCycle ? { ...s, primaryColor: vizPrimaryColor, secondaryColor: vizSecondaryColor } : s;

      // Helper to render the selected visualizer so we can easily duplicate it for Echo
      const renderSelectedVisualizer = (scaleMult: number, alpha: number) => {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scaleMult, scaleMult);
        ctx.translate(-centerX, -centerY);
        ctx.globalAlpha = alpha;

        if (s.type === 'bars') drawCircularBars(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'wave') drawCircularWave(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'spiral') drawSpiral(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'particles') drawParticles(ctx, dataArray, centerX, centerY, currentRadius, particles, vizSettings);
        else if (s.type === 'ring') drawRing(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'strings') drawStrings(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'orbit') drawOrbit(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'spikes') drawSpikes(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'laser') drawLaser(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);
        else if (s.type === 'nebula') drawNebula(ctx, dataArray, centerX, centerY, currentRadius, nebParticles, vizSettings);
        else if (s.type === 'aura') drawAura(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);

        ctx.restore();
      };

      // ── 1. Draw Visualizer FIRST (behind center circle) ─────────────────
      renderSelectedVisualizer(1, 1);

      if (s.echoEnabled) {
        renderSelectedVisualizer(1.2, 0.3);
        renderSelectedVisualizer(1.5, 0.1);
      }

      // Reset glow after visualizer
      ctx.shadowBlur = 0;

      // ── 2. Draw Center Circle ON TOP of the visualizer ──────────────────
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
      ctx.fillStyle = s.centerColor;
      ctx.fill();

      // ── 3. Draw Center Content (profile / logo) ──────────────────────────
      if (s.centerMode === 'profile' && centerImgRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(centerImgRef.current, centerX - currentRadius, centerY - currentRadius, currentRadius * 2, currentRadius * 2);
        ctx.restore();
      } else if (s.centerMode === 'logo' && logoImgRef.current) {
        const img = logoImgRef.current;
        const size = (currentRadius * 2) * s.logoScale;
        ctx.drawImage(img, centerX - size / 2, centerY - size / 2, size, size);
      }

      // Outline ring
      ctx.strokeStyle = s.primaryColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.restore(); // Restore rotation context

      // Draw Text (Static, not rotated unless we want it to)
      // If we want text to NOT rotate, we draw it after restore. 
      // If we want it to rotate, draw before. Let's keep text static for readability.
      if (s.centerMode === 'text' && s.centerText) {
        ctx.save();
        ctx.font = `300 ${s.centerTextSize * pulseScale}px "Inter", sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10;
        ctx.shadowColor = s.primaryColor;

        const words = s.centerText.split(' ');
        if (words.length > 1 && s.centerText.length > 10) {
          ctx.fillText(words.slice(0, Math.ceil(words.length / 2)).join(' '), centerX, centerY - (s.centerTextSize * pulseScale) / 1.5);
          ctx.fillText(words.slice(Math.ceil(words.length / 2)).join(' '), centerX, centerY + (s.centerTextSize * pulseScale) / 1.5);
        } else {
          ctx.fillText(s.centerText, centerX, centerY);
        }
        ctx.restore();
      }

      ctx.restore(); // Restore the top level scale matching
    };

    renderFrame(0);
  }, []);

  const drawCircularBars = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const bars = 180;
    const effectiveBars = s.mirror ? bars / 2 : bars;
    const step = Math.floor(data.length / effectiveBars);

    for (let i = 0; i < bars; i++) {
      let dataIndex;
      if (s.mirror) {
        if (i < bars / 2) dataIndex = i * step;
        else dataIndex = (bars - 1 - i) * step;
      } else {
        dataIndex = i * step;
      }

      const value = data[dataIndex] || 0;
      const percent = value / 255;
      const height = (percent * 150 * s.sensitivity) + 10;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;

      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + height);
      const y2 = cy + Math.sin(angle) * (radius + height);

      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, s.primaryColor);
      gradient.addColorStop(1, s.secondaryColor);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = s.barWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  };

  const drawCircularWave = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 360;
    const effectivePoints = s.mirror ? points / 2 : points;
    const step = Math.floor(data.length / effectivePoints);

    // Draw a thin glowing stroke wave — no fill, no overlap with center
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      let dataIndex;
      if (s.mirror) {
        if (i < points / 2) dataIndex = i * step;
        else dataIndex = (points - i) * step;
      } else {
        dataIndex = i * step;
      }

      const value = data[dataIndex] || 0;
      const percent = value / 255;
      const offset = percent * 100 * s.sensitivity;
      const r = radius + offset;
      const angle = (i / points) * Math.PI * 2 - Math.PI / 2;

      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Second subtle inner wave ring
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      let dataIndex;
      if (s.mirror) {
        if (i < points / 2) dataIndex = i * step;
        else dataIndex = (points - i) * step;
      } else {
        dataIndex = (i * step + 40) % data.length;
      }
      const value = data[dataIndex] || 0;
      const percent = value / 255;
      const offset = percent * 50 * s.sensitivity;
      const r = radius + offset;
      const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawSpiral = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 180;
    const step = Math.floor(data.length / points);

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) { // 2 loops
      const dataIndex = (i % points) * step;
      const value = data[dataIndex] || 0;
      const percent = value / 255;

      const angle = (i / points) * Math.PI * 2;
      const spiralOffset = (i * 2); // Spiraling out
      const audioOffset = percent * 100 * s.sensitivity;

      const r = radius + spiralOffset + audioOffset;

      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = s.barWidth;
    ctx.stroke();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, particles: any[], s: VisualizerSettings) => {
    const bass = data[0];
    if (bass > 180 && Math.random() > 0.3) {
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: cx,
          y: cy,
          angle: Math.random() * Math.PI * 2,
          speed: (Math.random() * 6 + 3) * (bass / 255),
          life: 1,
          color: Math.random() > 0.5 ? s.primaryColor : s.secondaryColor
        });
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.speed *= 0.97; // slow down
      p.life -= 0.018;

      if (p.life <= 0) { particles.splice(i, 1); continue; }

      const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      if (dist > radius) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + (1 - p.life) * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Draw a minimal pulse ring so there's always something to see
    let avgFreq = 0;
    for (let i = 0; i < 80; i++) avgFreq += data[i];
    avgFreq = avgFreq / 80;
    const pulseR = radius + (avgFreq / 255) * 60 * s.sensitivity;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawRing = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    let bassTotal = 0;
    for (let i = 0; i < 20; i++) bassTotal += data[i];
    const bassAverage = bassTotal / 20;
    const pulseOffset = (bassAverage / 255) * 100 * s.sensitivity;

    ctx.beginPath();
    ctx.arc(cx, cy, radius + pulseOffset, 0, Math.PI * 2);
    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = s.barWidth * 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + pulseOffset + 15, 0, Math.PI * 2);
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = s.barWidth;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawStrings = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 60;
    const step = Math.floor(data.length / points);
    const coords: { x: number, y: number }[] = [];

    for (let i = 0; i < points; i++) {
      const value = data[i * step] || 0;
      const percent = value / 255;
      const offset = percent * 80 * s.sensitivity;
      const r = radius + offset;
      const angle = (i / points) * Math.PI * 2;
      coords.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r
      });
    }

    ctx.strokeStyle = s.primaryColor;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Connect every point to several other points across the circle
    for (let i = 0; i < points; i++) {
      for (let j = i + 1; j < points; j += 7) {
        if (Math.abs(i - j) > 3) {
          const p1 = coords[i];
          const p2 = coords[j];
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
        }
      }
    }
    ctx.stroke();

    // Outline
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const p = coords[i % points];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  };

  const drawOrbit = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const orbs = 24;
    const step = Math.floor(data.length / orbs);
    const time = Date.now() * 0.001;

    for (let i = 0; i < orbs; i++) {
      const value = data[i * step] || 0;
      const percent = value / 255;
      const dist = radius + 20 + (percent * 150 * s.sensitivity);
      const angle = (i / orbs) * Math.PI * 2 + (time * (i % 2 === 0 ? 1 : -1) * 0.5);

      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;

      ctx.beginPath();
      ctx.arc(x, y, 4 + percent * 10, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? s.primaryColor : s.secondaryColor;
      ctx.fill();

      if (percent > 0.5) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = s.primaryColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Base ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawFireflies = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, fireflies: any[], s: VisualizerSettings) => {
    const bass = data[0];
    if (bass > 150 && fireflies.length < 120 && Math.random() > 0.4) {
      for (let i = 0; i < 4; i++) {
        fireflies.push({
          x: cx + (Math.random() - 0.5) * radius * 2,
          y: cy + (Math.random() - 0.5) * radius * 2,
          angle: Math.random() * Math.PI * 2,
          speed: Math.random() * 1.2 + 0.3,
          life: 3 + Math.random() * 2,
          color: Math.random() > 0.3 ? s.primaryColor : '#ffffff',
          wobbleOffset: Math.random() * Math.PI * 2
        });
      }
    }

    const time = Date.now() * 0.004;

    for (let i = fireflies.length - 1; i >= 0; i--) {
      const p = fireflies[i];
      p.angle += Math.sin(time + p.wobbleOffset) * 0.04;
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.life -= 0.008;

      if (p.life <= 0) { fireflies.splice(i, 1); continue; }

      const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      // Push away from center
      if (dist < radius + 10) {
        const pushAngle = Math.atan2(p.y - cy, p.x - cx);
        p.x += Math.cos(pushAngle) * 3;
        p.y += Math.sin(pushAngle) * 3;
      }

      const alpha = Math.min(p.life / 3, 1) * Math.min((dist - radius) / 30, 1);
      if (alpha <= 0) continue;

      ctx.globalAlpha = Math.max(alpha, 0);
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5 + Math.abs(Math.sin(time * 2 + p.wobbleOffset)) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };

  // ─── Spikes ───────────────────────────────────────────────────────────────
  const drawSpikes = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const count = s.mirror ? 90 : 180;
    const step = Math.floor(data.length / count);

    for (let i = 0; i < (s.mirror ? count / 2 : count) * (s.mirror ? 2 : 1); i++) {
      let dataIndex;
      if (s.mirror) {
        if (i < count) dataIndex = i * step;
        else dataIndex = (count * 2 - 1 - i) * step;
      } else {
        dataIndex = i * step;
      }
      const value = data[dataIndex] || 0;
      const percent = value / 255;
      const h = percent * 180 * s.sensitivity;
      if (h < 2) continue;
      const angle = (i / (s.mirror ? count * 2 : count)) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const tipX = cx + Math.cos(angle) * (radius + h);
      const tipY = cy + Math.sin(angle) * (radius + h);
      // Triangle spike: tip + two base points rotated ±1 degree
      const w = 0.012; // spike width
      const lAngle = angle - w;
      const rAngle = angle + w;
      const lx = cx + Math.cos(lAngle) * (radius + 2);
      const ly = cy + Math.sin(lAngle) * (radius + 2);
      const rx = cx + Math.cos(rAngle) * (radius + 2);
      const ry = cy + Math.sin(rAngle) * (radius + 2);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      const grad = ctx.createLinearGradient(x1, y1, tipX, tipY);
      grad.addColorStop(0, s.secondaryColor);
      grad.addColorStop(1, s.primaryColor);
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.5 + percent * 0.5;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // ─── Laser ────────────────────────────────────────────────────────────────
  const drawLaser = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const rays = 36;
    const step = Math.floor(data.length / rays);
    for (let i = 0; i < rays; i++) {
      const value = data[i * step] || 0;
      const percent = value / 255;
      if (percent < 0.05) continue;
      const len = radius + percent * 300 * s.sensitivity;
      const angle = (i / rays) * Math.PI * 2 - Math.PI / 2;

      // Outer glowing line
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      ctx.strokeStyle = s.primaryColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = percent * 0.9;
      ctx.shadowBlur = 15;
      ctx.shadowColor = s.primaryColor;
      ctx.stroke();

      // Mirror
      if (s.mirror) {
        const mAngle = Math.PI - angle + Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(mAngle) * radius, cy + Math.sin(mAngle) * radius);
        ctx.lineTo(cx + Math.cos(mAngle) * len, cy + Math.sin(mAngle) * len);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };

  // ─── Nebula ───────────────────────────────────────────────────────────────
  const drawNebula = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, nebParticles: any[], s: VisualizerSettings) => {
    let energy = 0;
    for (let i = 0; i < 60; i++) energy += data[i];
    energy = energy / 60 / 255;

    if (nebParticles.length < 200 && Math.random() < energy * 0.6) {
      const angle = Math.random() * Math.PI * 2;
      const spawnR = radius + Math.random() * 20;
      nebParticles.push({
        x: cx + Math.cos(angle) * spawnR,
        y: cy + Math.sin(angle) * spawnR,
        vx: Math.cos(angle) * (1 + energy * 4 * s.sensitivity) + (Math.random() - 0.5),
        vy: Math.sin(angle) * (1 + energy * 4 * s.sensitivity) + (Math.random() - 0.5),
        life: 1,
        size: 1.5 + Math.random() * 3,
        color: Math.random() > 0.5 ? s.primaryColor : s.secondaryColor
      });
    }

    for (let i = nebParticles.length - 1; i >= 0; i--) {
      const p = nebParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= 0.006;
      if (p.life <= 0) { nebParticles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life * 0.8;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };

  // ─── Aura ─────────────────────────────────────────────────────────────────
  const drawAura = (ctx: CanvasRenderingContext2D, data: Uint8Array, cx: number, cy: number, radius: number, s: VisualizerSettings) => {
    const points = 180;
    const effectivePoints = s.mirror ? points / 2 : points;
    const step = Math.floor(data.length / effectivePoints);

    ctx.beginPath();

    // Draw outer peaks
    for (let i = 0; i <= points; i++) {
      let dataIndex;
      if (s.mirror) {
        if (i <= points / 2) dataIndex = i * step;
        else dataIndex = (points - i) * step;
      } else {
        dataIndex = i * step;
      }

      const value = data[dataIndex] || 0;
      // Exponential scaling for flatter valleys and sharper peaks (Trap style)
      const percent = Math.pow(value / 255, 2.5);
      const height = percent * 200 * s.sensitivity;

      // Start at bottom (+ PI/2) so the main bass energy splits symmetrically downwards
      const angle = (i / points) * Math.PI * 2 + Math.PI / 2;
      const r = radius + height;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // Connect back along the inner radius to form a continuous filled polygon
    ctx.arc(cx, cy, radius, Math.PI * 2 + Math.PI / 2, Math.PI / 2, true);
    ctx.closePath();

    // Create Gradient for fill
    const gradient = ctx.createLinearGradient(cx, cy - radius - 200, cx, cy + radius + 200);
    gradient.addColorStop(0, s.primaryColor);
    gradient.addColorStop(1, s.secondaryColor);

    ctx.fillStyle = gradient;
    ctx.fill();

    // White/Bright border on the outside
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Background Layer */}
      <div
        className="absolute inset-[-50px] z-0 bg-cover bg-center"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : 'none',
          filter: `blur(${settings.bgBlur}px)`,
          opacity: settings.bgOpacity,
          transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`,
          willChange: 'transform' // Hardware acceleration for fast shaking
        }}
      />

      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-[-50px] z-10"
        style={{
          transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`,
          willChange: 'transform'
        }}
      />

      {/* Audio Element (Hidden) */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        crossOrigin="anonymous"
      />

      {/* Top Left Performance Toggle */}
      <div className="fixed top-6 left-6 z-50 flex items-center gap-3 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2 hover:bg-[#0a0a0a]/90 transition-colors shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${settings.performanceMode ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-neutral-600'}`} />
            <label className="text-sm font-semibold text-white tracking-wide">Low-End PC Mode</label>
          </div>
          <p className="text-[10px] text-neutral-400 mt-0.5 ml-4">Lower quality, better performance</p>
        </div>
        <button
          onClick={() => setSettings(s => ({ ...s, performanceMode: !s.performanceMode }))}
          className={`ml-2 shrink-0 w-11 h-6 rounded-full relative transition-colors ${settings.performanceMode ? 'bg-orange-500' : 'bg-neutral-800 border border-neutral-600'}`}
        >
          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${settings.performanceMode ? 'bg-white translate-x-5' : 'bg-neutral-400 translate-x-0'}`} />
        </button>
      </div>

      {/* Floating Bottom Dock */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/10 rounded-full p-2.5 flex items-center gap-2 shadow-2xl">
        {/* Play/Pause (Primary) */}
        <button
          onClick={togglePlay}
          disabled={!audioFile}
          className={`p-4 rounded-full flex items-center justify-center transition-all ${audioFile
            ? 'bg-white text-black hover:bg-neutral-200 shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95'
            : 'bg-white/5 text-neutral-600 cursor-not-allowed'
            }`}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
        </button>

        <div className="w-px h-8 bg-white/10 mx-2" />

        {/* Upload Audio */}
        <label className="p-3 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors relative group">
          <Music className="w-5 h-5" />
          <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
            {audioFile ? 'Change Audio' : 'Upload Audio'}
          </div>
        </label>

        {/* Upload Background */}
        <label className="p-3 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors relative group">
          <ImageIcon className="w-5 h-5" />
          <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
            {bgFile ? 'Change Background' : 'Upload Background'}
          </div>
        </label>

        {/* Upload Profile */}
        <label className="p-3 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors relative group">
          <User className="w-5 h-5" />
          <input type="file" accept="image/*" onChange={handleCenterImageUpload} className="hidden" />
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
            {centerImage ? 'Change Profile' : 'Upload Profile Picture'}
          </div>
        </label>

        <div className="w-px h-8 bg-white/10 mx-2" />

        {/* Settings Toggle */}
        <button
          onClick={() => setShowControls(!showControls)}
          className={`p-3 rounded-full transition-colors relative group ${showControls ? 'bg-white text-black' : 'hover:bg-white/10 text-neutral-300 hover:text-white'}`}
        >
          <Settings className="w-5 h-5" />
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
            Settings
          </div>
        </button>

        <div className="w-px h-8 bg-white/10 mx-2" />

        {/* Resolution Selector */}
        <div className="flex items-center gap-1 bg-white/5 rounded-full px-1 py-1 border border-white/10">
          {(['1080p', '2k', '4k'] as const).map(q => (
            <button
              key={q}
              onClick={() => setRecordingQuality(q)}
              disabled={isExporting}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${recordingQuality === q ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Export Button */}
        <button
          onClick={exportVideo}
          disabled={!audioFile || isExporting}
          className={`relative p-3 rounded-full transition-all group flex items-center gap-1.5 pr-4 pl-3 ${isExporting
            ? 'bg-white/10 text-neutral-400 cursor-not-allowed'
            : audioFile
              ? 'hover:bg-white text-neutral-300 hover:text-black border border-white/20'
              : 'text-neutral-600 cursor-not-allowed'
            }`}
        >
          {isExporting ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="text-[11px] font-semibold tracking-wide">
            {isExporting ? 'Exporting…' : 'Export'}
          </span>
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
            {isExporting ? 'Playing & capturing…' : `Export as ${recordingQuality.toUpperCase()} video`}
          </div>
        </button>
      </div>

      {/* Floating Settings Panel */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-8 bottom-32 max-h-[calc(100vh-160px)] z-30 w-[360px] bg-[#0a0a0a]/85 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 overflow-y-auto custom-scrollbar shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col"
          >
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5 shrink-0">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Appearance
              </h2>
              <button onClick={() => setShowControls(false)} className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Background Adjustments - Only show if BG exists */}
              {bgImage && (
                <div className="space-y-4 pt-1 pb-4 border-b border-white/5 px-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                    <ImageIcon className="w-4 h-4 text-neutral-400" />
                    <span>Background</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <label className="text-neutral-400">Blur</label>
                      <span className="text-white">{settings.bgBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={settings.bgBlur}
                      onChange={(e) => setSettings(s => ({ ...s, bgBlur: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <label className="text-neutral-400">Opacity</label>
                      <span className="text-white">{Math.round(settings.bgOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.bgOpacity}
                      onChange={(e) => setSettings(s => ({ ...s, bgOpacity: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                    />
                  </div>
                </div>
              )}

              {/* Center Element Adjustments */}
              <div className="space-y-4 px-1 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <User className="w-4 h-4 text-neutral-400" />
                  <span>Center Element</span>
                </div>
                <div className="flex gap-2 bg-neutral-900/50 p-1 rounded-2xl border border-white/5 shadow-inner">
                  <button
                    onClick={() => setSettings(s => ({ ...s, centerMode: 'text' }))}
                    className={`flex-1 py-2 text-sm rounded-xl font-medium transition-all ${settings.centerMode === 'text' ? 'bg-white text-black shadow-sm' : 'bg-transparent text-neutral-400 hover:text-white'}`}
                  >
                    Text
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, centerMode: 'profile' }))}
                    className={`flex-1 py-2 text-sm rounded-xl font-medium transition-all ${settings.centerMode === 'profile' ? 'bg-white text-black shadow-sm' : 'bg-transparent text-neutral-400 hover:text-white'}`}
                  >
                    Profile
                  </button>
                </div>
                {settings.centerMode === 'text' && (
                  <input
                    type="text"
                    value={settings.centerText}
                    onChange={(e) => setSettings(s => ({ ...s, centerText: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all shadow-inner placeholder:text-neutral-600 mt-2"
                    placeholder="Enter center text..."
                  />
                )}
              </div>

              {/* Visualizer Adjustments */}
              <div className="space-y-4 px-1 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                  <Settings className="w-4 h-4 text-neutral-400" />
                  <span>Visualizer</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setSettings(s => ({ ...s, type: 'bars' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'bars' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Bars</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'wave' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'wave' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Wave</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'spiral' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'spiral' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Spiral</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'particles' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'particles' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Particles</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'ring' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'ring' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Ring</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'strings' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'strings' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Strings</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'orbit' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'orbit' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Orbit</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'spikes' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'spikes' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Spikes</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'laser' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'laser' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Laser</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'nebula' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'nebula' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Nebula</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'aura' }))} className={`p-3 text-sm rounded-2xl font-medium transition-all border ${settings.type === 'aura' ? 'bg-white text-black border-transparent shadow-sm' : 'bg-transparent text-neutral-300 border-white/10 hover:bg-white/5 hover:border-white/20'}`}>Aura</button>
                </div>

                <div className="flex items-center justify-between pt-1 pb-2 border-b border-white/5">
                  <div>
                    <label className="text-sm font-medium text-neutral-300">Particles Overlay</label>
                    <p className="text-[10px] text-neutral-600 mt-0.5">Floating background dust</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, bgParticlesEnabled: !s.bgParticlesEnabled }))}
                    className={`shrink-0 w-12 h-7 rounded-full relative transition-colors ${settings.bgParticlesEnabled ? 'bg-white' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${settings.bgParticlesEnabled ? 'bg-black translate-x-5' : 'bg-white translate-x-0 shadow-sm'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 pb-2">
                  <label className="text-sm font-medium text-neutral-300">Mirror Spectrum</label>
                  <button
                    onClick={() => setSettings(s => ({ ...s, mirror: !s.mirror }))}
                    className={`w-12 h-7 rounded-full relative transition-colors ${settings.mirror ? 'bg-white' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${settings.mirror ? 'bg-black translate-x-5' : 'bg-white translate-x-0 shadow-sm'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 pb-2">
                  <label className="text-sm font-medium text-neutral-300">Beat Pulse</label>
                  <button
                    onClick={() => setSettings(s => ({ ...s, pulseEnabled: !s.pulseEnabled }))}
                    className={`w-12 h-7 rounded-full relative transition-colors ${settings.pulseEnabled ? 'bg-white' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${settings.pulseEnabled ? 'bg-black translate-x-5' : 'bg-white translate-x-0 shadow-sm'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <label className="text-sm font-medium text-neutral-300">Glow</label>
                    <p className="text-[10px] text-neutral-600 mt-0.5">Adds bloom light to visualizer</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, glowEnabled: !s.glowEnabled }))}
                    className={`w-12 h-7 rounded-full relative transition-colors ${settings.glowEnabled ? 'bg-white' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${settings.glowEnabled ? 'bg-black translate-x-5' : 'bg-white translate-x-0 shadow-sm'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <label className="text-sm font-medium text-neutral-300">Trail</label>
                    <p className="text-[10px] text-neutral-600 mt-0.5">Leaves fading ghost traces</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, trailEnabled: !s.trailEnabled }))}
                    className={`w-12 h-7 rounded-full relative transition-colors ${settings.trailEnabled ? 'bg-white' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${settings.trailEnabled ? 'bg-black translate-x-5' : 'bg-white translate-x-0 shadow-sm'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 pb-2">
                  <div>
                    <label className="text-sm font-medium text-neutral-300">Color Cycle</label>
                    <p className="text-[10px] text-neutral-600 mt-0.5">Auto-cycles hue over time</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, colorCycle: !s.colorCycle }))}
                    className={`shrink-0 w-12 h-7 rounded-full relative transition-colors ${settings.colorCycle ? 'bg-white' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${settings.colorCycle ? 'bg-black translate-x-5' : 'bg-white translate-x-0 shadow-sm'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 pb-2">
                  <div>
                    <label className="text-sm font-medium text-neutral-300">Camera Shake</label>
                    <p className="text-[10px] text-neutral-600 mt-0.5">Screen trembles on heavy bass drops</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, shakeEnabled: !s.shakeEnabled }))}
                    className={`shrink-0 w-12 h-7 rounded-full relative transition-colors ${settings.shakeEnabled ? 'bg-white' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${settings.shakeEnabled ? 'bg-black translate-x-5' : 'bg-white translate-x-0 shadow-sm'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 pb-2">
                  <div>
                    <label className="text-sm font-medium text-neutral-300">Ghost Echo</label>
                    <p className="text-[10px] text-neutral-600 mt-0.5">Draws expanding translucent layers</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, echoEnabled: !s.echoEnabled }))}
                    className={`shrink-0 w-12 h-7 rounded-full relative transition-colors ${settings.echoEnabled ? 'bg-white' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${settings.echoEnabled ? 'bg-black translate-x-5' : 'bg-white translate-x-0 shadow-sm'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 pb-2">
                  <div>
                    <label className="text-sm font-medium text-neutral-300 text-rose-300">Invert Colors</label>
                    <p className="text-[10px] text-neutral-600 mt-0.5">Flips canvas colors to negative mode</p>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, invertColors: !s.invertColors }))}
                    className={`shrink-0 w-12 h-7 rounded-full relative transition-colors ${settings.invertColors ? 'bg-rose-500' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${settings.invertColors ? 'bg-white translate-x-5' : 'bg-white translate-x-0 shadow-sm'}`} />
                  </button>
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-4 px-1 pb-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <label className="text-neutral-400">Rotation Speed</label>
                    <div className="flex items-center gap-2">
                      <span className="text-white">{settings.rotationSpeed}</span>
                      <button
                        onClick={() => setSettings(s => ({ ...s, rotationSpeed: 0 }))}
                        className="text-neutral-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                        title="Reset to default (0)"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.1"
                    value={settings.rotationSpeed}
                    onChange={(e) => setSettings(s => ({ ...s, rotationSpeed: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <label className="text-neutral-400">Visualize Radius</label>
                    <div className="flex items-center gap-2">
                      <span className="text-white">{settings.radius}px</span>
                      <button
                        onClick={() => setSettings(s => ({ ...s, radius: 150 }))}
                        className="text-neutral-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                        title="Reset to default (150)"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="300"
                    value={settings.radius}
                    onChange={(e) => setSettings(s => ({ ...s, radius: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <label className="text-neutral-400">Audio Sensitivity</label>
                    <div className="flex items-center gap-2">
                      <span className="text-white">{settings.sensitivity}x</span>
                      <button
                        onClick={() => setSettings(s => ({ ...s, sensitivity: 1.5 }))}
                        className="text-neutral-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                        title="Reset to default (1.5x)"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={settings.sensitivity}
                    onChange={(e) => setSettings(s => ({ ...s, sensitivity: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                  />
                </div>
              </div>

              {/* Color Palette */}
              <div className="space-y-3 px-1 pt-2">
                <label className="text-xs font-medium text-neutral-400">Color Palette</label>
                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1.5">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                      className="h-10 w-full rounded-[10px] cursor-pointer bg-transparent border border-white/10 p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-md"
                    />
                    <label className="text-[10px] text-center text-neutral-400 font-medium">Primary</label>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings(s => ({ ...s, secondaryColor: e.target.value }))}
                      className="h-10 w-full rounded-[10px] cursor-pointer bg-transparent border border-white/10 p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-md"
                    />
                    <label className="text-[10px] text-center text-neutral-400 font-medium">Secondary</label>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State / Prompt */}
      {!audioFile && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
          <div className="text-center space-y-4 opacity-30">
            <Music className="w-24 h-24 mx-auto" />
            <p className="text-xl font-light tracking-widest uppercase">Upload audio to begin</p>
          </div>
        </div>
      )}

      {/* Profile Image Crop Modal */}
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}
