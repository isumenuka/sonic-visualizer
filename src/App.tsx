/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Settings, Play, Pause, Type, Music, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
type VisualizerType = 'bars' | 'wave' | 'circle' | 'particles' | 'spiral';
type CenterMode = 'text' | 'profile' | 'logo';

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
  centerColor: string; // New: Background color of the center circle
  logoScale: number;   // New: Scale for the mini logo
  bgBlur: number;
  bgOpacity: number;
  mirror: boolean;
  rotationSpeed: number;
  pulseEnabled: boolean;
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
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-5 shadow-2xl w-[380px]">
        <h2 className="text-white font-semibold text-lg">Adjust Profile Picture</h2>
        <p className="text-gray-400 text-xs text-center">Drag to reposition · Zoom slider to resize</p>

        {/* Circle crop preview */}
        <div
          className="relative overflow-hidden rounded-full border-2 border-cyan-400 cursor-grab active:cursor-grabbing select-none"
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
          <div className="absolute inset-0 rounded-full ring-2 ring-cyan-400/40 pointer-events-none" />
        </div>

        {/* Zoom */}
        <div className="w-full space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Zoom</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={5}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Apply ✓
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

  // Cached Image objects for canvas drawing (avoids creating new Image every frame)
  const centerImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  const [settings, setSettings] = useState<VisualizerSettings>({
    primaryColor: '#00ffff',
    secondaryColor: '#ff00ff',
    sensitivity: 1.5,
    barWidth: 3,
    radius: 150,
    type: 'bars',
    centerMode: 'text',
    centerText: 'AUDIO VISUALIZER',
    centerTextSize: 24,
    centerColor: '#000000',
    logoScale: 0.5,
    bgBlur: 10,
    bgOpacity: 0.5,
    mirror: true,
    rotationSpeed: 0,
    pulseEnabled: false,
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
      draw();
    }
    setIsPlaying(!isPlaying);
  };

  const draw = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to full screen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let rotation = 0;
    let particles: { x: number, y: number, speed: number, angle: number, life: number, color: string }[] = [];

    const renderFrame = () => {
      animationRef.current = requestAnimationFrame(renderFrame);
      analyserRef.current!.getByteFrequencyData(dataArray);

      // Always read the latest settings from ref (avoids stale closure)
      const s = settingsRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Calculate Bass for Pulse
      let bassTotal = 0;
      for (let i = 0; i < 20; i++) {
        bassTotal += dataArray[i];
      }
      const bassAverage = bassTotal / 20;
      const pulseScale = s.pulseEnabled ? 1 + (bassAverage / 255) * 0.2 : 1;
      const currentRadius = s.radius * pulseScale;

      // Rotation
      rotation += s.rotationSpeed * 0.01;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);

      // Draw Center Circle Background
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
      ctx.fillStyle = s.centerColor;
      ctx.fill();

      // Draw Center Content
      if (s.centerMode === 'profile' && centerImgRef.current) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(centerImgRef.current, centerX - currentRadius, centerY - currentRadius, currentRadius * 2, currentRadius * 2);
        ctx.restore();
      } else if (s.centerMode === 'logo' && logoImgRef.current) {
        // Draw logo centered, scaled, no clipping
        const img = logoImgRef.current;
        const size = (currentRadius * 2) * s.logoScale;
        ctx.drawImage(img, centerX - size / 2, centerY - size / 2, size, size);
      } else {
        // Just Background (already drawn)
      }

      ctx.strokeStyle = s.primaryColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Visualizer
      if (s.type === 'bars') {
        drawCircularBars(ctx, dataArray, centerX, centerY, currentRadius, s);
      } else if (s.type === 'wave') {
        drawCircularWave(ctx, dataArray, centerX, centerY, currentRadius, s);
      } else if (s.type === 'spiral') {
        drawSpiral(ctx, dataArray, centerX, centerY, currentRadius, s);
      } else if (s.type === 'particles') {
        drawParticles(ctx, dataArray, centerX, centerY, currentRadius, particles, s);
      }

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
    };

    renderFrame();
  };

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
      const offset = (percent * 100 * s.sensitivity);
      const r = radius + offset;
      const angle = (i / points) * Math.PI * 2 - Math.PI / 2;

      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const gradient = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 150);
    gradient.addColorStop(0, s.primaryColor);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = s.secondaryColor;
    ctx.lineWidth = 2;
    ctx.stroke();
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
    // Add new particles based on bass
    const bass = data[0]; // Low freq
    if (bass > 200 && Math.random() > 0.5) {
      for (let i = 0; i < 5; i++) {
        particles.push({
          x: cx,
          y: cy,
          angle: Math.random() * Math.PI * 2,
          speed: Math.random() * 5 + 2,
          life: 1,
          color: Math.random() > 0.5 ? s.primaryColor : s.secondaryColor
        });
      }
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.life -= 0.02;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      // Only draw if outside radius
      const dist = Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2));
      if (dist > radius) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Draw base circle wave as well for context
    drawCircularWave(ctx, data, cx, cy, radius, s);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Background Layer */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-500"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : 'none',
          filter: `blur(${settings.bgBlur}px)`,
          opacity: settings.bgOpacity
        }}
      />

      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10"
      />

      {/* Audio Element (Hidden) */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        crossOrigin="anonymous"
      />

      {/* UI Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="absolute left-0 top-0 bottom-0 z-20 w-80 bg-black/80 backdrop-blur-md border-r border-white/10 p-6 overflow-y-auto"
          >
            <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Sonic Visualizer
            </h1>

            {/* File Uploads */}
            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Audio Source</label>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors border border-white/5 hover:border-white/20">
                  <Music className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm truncate flex-1">{audioFile ? audioFile.name : 'Upload Audio'}</span>
                  <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Background Image</label>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors border border-white/5 hover:border-white/20">
                  <ImageIcon className="w-5 h-5 text-green-400" />
                  <span className="text-sm truncate flex-1">{bgFile ? bgFile.name : 'Upload Background'}</span>
                  <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                </label>

                {/* Blur & Opacity — shown once a background is uploaded */}
                {bgImage && (
                  <div className="space-y-3 pt-1">
                    <div className="flex justify-between">
                      <label className="text-xs text-gray-400">Blur</label>
                      <span className="text-xs text-gray-500">{settings.bgBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={settings.bgBlur}
                      onChange={(e) => setSettings(s => ({ ...s, bgBlur: Number(e.target.value) }))}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-400"
                    />
                    <div className="flex justify-between">
                      <label className="text-xs text-gray-400">Opacity</label>
                      <span className="text-xs text-gray-500">{Math.round(settings.bgOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.bgOpacity}
                      onChange={(e) => setSettings(s => ({ ...s, bgOpacity: Number(e.target.value) }))}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-400"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Center Profile (Fills Circle)</label>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors border border-white/5 hover:border-white/20">
                  <ImageIcon className="w-5 h-5 text-pink-400" />
                  <span className="text-sm truncate flex-1">{centerImage ? 'Profile Selected' : 'Upload Profile'}</span>
                  <input type="file" accept="image/*" onChange={handleCenterImageUpload} className="hidden" />
                </label>
              </div>



              <div className="flex gap-2">
                <button
                  onClick={() => setSettings(s => ({ ...s, centerMode: 'text' }))}
                  className={`flex-1 py-2 text-xs rounded-lg border ${settings.centerMode === 'text' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-transparent border-white/10 text-gray-400'}`}
                >
                  Text
                </button>
                <button
                  onClick={() => setSettings(s => ({ ...s, centerMode: 'profile' }))}
                  className={`flex-1 py-2 text-xs rounded-lg border ${settings.centerMode === 'profile' ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-transparent border-white/10 text-gray-400'}`}
                >
                  Profile
                </button>

              </div>
            </div>

            {/* Playback Controls */}
            <div className="mb-8">
              <button
                onClick={togglePlay}
                disabled={!audioFile}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-all ${audioFile
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:scale-[1.02] shadow-lg shadow-purple-500/20'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </button>
            </div>

            {/* Customization */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/90 pb-2 border-b border-white/10">
                <Settings className="w-4 h-4" />
                <span>Visualizer Settings</span>
              </div>

              <div className="space-y-3">
                <label className="text-xs text-gray-400">Style</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setSettings(s => ({ ...s, type: 'bars' }))} className={`p-2 text-xs rounded-lg border ${settings.type === 'bars' ? 'bg-white text-black border-white' : 'bg-transparent border-white/20 text-gray-400'}`}>Bars</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'wave' }))} className={`p-2 text-xs rounded-lg border ${settings.type === 'wave' ? 'bg-white text-black border-white' : 'bg-transparent border-white/20 text-gray-400'}`}>Wave</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'spiral' }))} className={`p-2 text-xs rounded-lg border ${settings.type === 'spiral' ? 'bg-white text-black border-white' : 'bg-transparent border-white/20 text-gray-400'}`}>Spiral</button>
                  <button onClick={() => setSettings(s => ({ ...s, type: 'particles' }))} className={`p-2 text-xs rounded-lg border ${settings.type === 'particles' ? 'bg-white text-black border-white' : 'bg-transparent border-white/20 text-gray-400'}`}>Particles</button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="text-xs text-gray-400">Mirror Spectrum</label>
                  <button
                    onClick={() => setSettings(s => ({ ...s, mirror: !s.mirror }))}
                    className={`w-10 h-5 rounded-full relative transition-colors ${settings.mirror ? 'bg-cyan-500' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.mirror ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="text-xs text-gray-400">Beat Pulse</label>
                  <button
                    onClick={() => setSettings(s => ({ ...s, pulseEnabled: !s.pulseEnabled }))}
                    className={`w-10 h-5 rounded-full relative transition-colors ${settings.pulseEnabled ? 'bg-pink-500' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.pulseEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-xs text-gray-400">Rotation Speed</label>
                  <span className="text-xs text-gray-500">{settings.rotationSpeed}</span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.1"
                  value={settings.rotationSpeed}
                  onChange={(e) => setSettings(s => ({ ...s, rotationSpeed: Number(e.target.value) }))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-400"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs text-gray-400">Colors</label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-gray-500">Primary</label>
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                      className="h-8 w-full rounded cursor-pointer bg-transparent"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-gray-500">Secondary</label>
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings(s => ({ ...s, secondaryColor: e.target.value }))}
                      className="h-8 w-full rounded cursor-pointer bg-transparent"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-gray-500">Center BG</label>
                    <input
                      type="color"
                      value={settings.centerColor}
                      onChange={(e) => setSettings(s => ({ ...s, centerColor: e.target.value }))}
                      className="h-8 w-full rounded cursor-pointer bg-transparent"
                    />
                  </div>
                </div>
              </div>

              {settings.centerMode === 'logo' && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-xs text-gray-400">Logo Scale</label>
                    <span className="text-xs text-gray-500">{Math.round(settings.logoScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.1"
                    value={settings.logoScale}
                    onChange={(e) => setSettings(s => ({ ...s, logoScale: Number(e.target.value) }))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-xs text-gray-400">Radius</label>
                  <span className="text-xs text-gray-500">{settings.radius}px</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={settings.radius}
                  onChange={(e) => setSettings(s => ({ ...s, radius: Number(e.target.value) }))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <label className="text-xs text-gray-400">Sensitivity</label>
                  <span className="text-xs text-gray-500">{settings.sensitivity}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={settings.sensitivity}
                  onChange={(e) => setSettings(s => ({ ...s, sensitivity: Number(e.target.value) }))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs text-gray-400">Center Text</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.centerText}
                    onChange={(e) => setSettings(s => ({ ...s, centerText: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="Enter text..."
                  />
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Controls Button */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="absolute top-6 right-6 z-30 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 transition-all"
      >
        <Settings className={`w-6 h-6 text-white transition-transform ${showControls ? 'rotate-180' : ''}`} />
      </button>

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
