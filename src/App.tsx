/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

import { VisualizerType, CenterMode, VisualizerSettings } from './types';
import { extractColors } from './utils/color';
import {
  drawCircularBars, drawCircularWave, drawSpiral, drawParticles,
  drawRing, drawStrings, drawOrbit, drawSpikes, drawLaser,
  drawNebula, drawAura, drawPeaks
} from './visualizers/drawings';
import { exportWithWebCodecs } from './utils/exportEngine';

import { CropModal } from './components/ui/CropModal';
import { TopBar } from './components/ui/TopBar';
import { BottomDock } from './components/ui/BottomDock';
import { SettingsPanel } from './components/ui/SettingsPanel';
import { ExportModal } from './components/ui/ExportModal';

export default function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [centerImage, setCenterImage] = useState<string | null>(null); // Used for Profile mode
  const [logoImage, setLogoImage] = useState<string | null>(null);     // Used for Logo mode
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSpeed, setExportSpeed] = useState(0); // multiplier vs realtime
  const [recordingQuality, setRecordingQuality] = useState<'1080p' | '2k' | '4k'>('1080p');
  const exportAbortRef = useRef<AbortController | null>(null);
  const isExportingRef = useRef(false);

  // Cached Image objects for canvas drawing (avoids creating new Image every frame)
  const centerImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);

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
    if (!audioFile) return;

    const abortController = new AbortController();
    exportAbortRef.current = abortController;
    setIsExporting(true);
    isExportingRef.current = true;
    setExportProgress(0);
    setExportSpeed(0);

    const [w, h] = resolutionMap[recordingQuality];

    try {
      await exportWithWebCodecs({
        audioFile,
        width: w,
        height: h,
        quality: recordingQuality,
        settings: settingsRef.current,
        bgImg: bgImgRef.current,
        centerImg: centerImgRef.current,
        logoImg: logoImgRef.current,
        onProgress: (pct, speedX) => {
          setExportProgress(pct);
          setExportSpeed(speedX);
        },
        signal: abortController.signal,
      });
    } catch (err: any) {
      if (!abortController.signal.aborted) {
        alert(`Export failed: ${err?.message ?? err}`);
      }
    } finally {
      setIsExporting(false);
      isExportingRef.current = false;
      exportAbortRef.current = null;
    }
  };

  const cancelExport = () => {
    exportAbortRef.current?.abort();
    setIsExporting(false);
    isExportingRef.current = false;
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

  // Preload bg image into a ref so the render loop can draw it on canvas during export
  useEffect(() => {
    if (!bgImage) { bgImgRef.current = null; return; }
    const img = new Image();
    img.src = bgImage;
    img.onload = () => { bgImgRef.current = img; };
  }, [bgImage]);

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
      const isExportingNow = isExportingRef.current;

      // Performance mode: throttle to 30fps
      const targetFps = (s.performanceMode && !isExportingNow) ? 30 : 60;
      if (timestamp - lastFrameTime < 1000 / targetFps) return;
      lastFrameTime = timestamp;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Performance mode: render at 50% resolution using CSS scale
      const scale = (s.performanceMode && !isExportingNow) ? 0.5 : 1;

      if (!isExportingNow) {
        const targetW = Math.floor(window.innerWidth * scale);
        const targetH = Math.floor(window.innerHeight * scale);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
          canvas.style.width = window.innerWidth + 'px';
          canvas.style.height = window.innerHeight + 'px';
          canvas.style.imageRendering = 'auto'; // Smooth quality drop, no retro blocking
        }
      }

      if (analyserRef.current) {
        // Performance mode: use smaller FFT window
        if (s.performanceMode && !isExportingNow && analyserRef.current.fftSize !== 512) {
          analyserRef.current.fftSize = 512;
        } else if ((!s.performanceMode || isExportingNow) && analyserRef.current.fftSize !== 2048) {
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
      const virtualWidth = isExportingNow ? canvas.width : window.innerWidth;
      const virtualHeight = isExportingNow ? canvas.height : window.innerHeight;

      ctx.save(); // Top level scale matching
      if (!isExportingNow) {
        ctx.scale(scale, scale);
      }

      // Trail: instead of solid clear, use destination-out to fade alpha so BG images show through
      if (s.trailEnabled) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'; // Color doesn't matter, only alpha does
        ctx.fillRect(0, 0, virtualWidth, virtualHeight);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.clearRect(0, 0, virtualWidth, virtualHeight);
      }

      // During export: draw background image directly on canvas (CSS bg div is not captured by captureStream)
      if (isExportingNow && bgImgRef.current) {
        ctx.save();
        const img = bgImgRef.current;
        // Compute cover-fill scale, also add blur padding to prevent transparent halo at edges
        const blurPad = s.bgBlur * 2;
        const imgScale = Math.max(
          (virtualWidth + blurPad * 2) / img.naturalWidth,
          (virtualHeight + blurPad * 2) / img.naturalHeight
        );
        const sw = img.naturalWidth * imgScale;
        const sh = img.naturalHeight * imgScale;
        if (s.bgBlur > 0) ctx.filter = `blur(${s.bgBlur}px)`;
        ctx.globalAlpha = s.bgOpacity;
        ctx.drawImage(img, (virtualWidth - sw) / 2, (virtualHeight - sh) / 2, sw, sh);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.restore();
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
        else if (s.type === 'peaks') drawPeaks(ctx, dataArray, centerX, centerY, currentRadius, vizSettings);

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



  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Background Layer — hidden during export since canvas draws it instead */}
      {!isExporting && (
        <div
          className="absolute inset-[-50px] z-0 bg-cover bg-center"
          style={{
            backgroundImage: bgImage ? `url(${bgImage})` : 'none',
            filter: `blur(${settings.bgBlur}px)`,
            opacity: settings.bgOpacity,
            transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`,
            willChange: 'transform'
          }}
        />
      )}

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
      <TopBar
        performanceMode={settings.performanceMode}
        onToggle={() => setSettings(s => ({ ...s, performanceMode: !s.performanceMode }))}
      />

      {/* Floating Bottom Dock */}
      <BottomDock
        audioFile={audioFile}
        bgFile={bgFile}
        centerImage={centerImage}
        isPlaying={isPlaying}
        showControls={showControls}
        isExporting={isExporting}
        recordingQuality={recordingQuality}
        togglePlay={togglePlay}
        onAudioUpload={handleAudioUpload}
        onBgUpload={handleBgUpload}
        onCenterImageUpload={handleCenterImageUpload}
        onToggleSettings={() => setShowControls(!showControls)}
        onQualityChange={setRecordingQuality}
        onExport={exportVideo}
      />

      {/* Floating Settings Panel */}
      {/* Floating Settings Panel */}
      <SettingsPanel
        showControls={showControls}
        onClose={() => setShowControls(false)}
        bgImage={bgImage}
        settings={settings}
        setSettings={setSettings}
      />

      {/* Profile Image Crop Modal */}
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Export Progress Modal */}
      <ExportModal
        isOpen={isExporting}
        progress={exportProgress}
        speed={exportSpeed}
        onCancel={cancelExport}
      />
    </div>
  );
}
