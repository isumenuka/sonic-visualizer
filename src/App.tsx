/**
 * Sonic Visualizer
 * Tech: TypeScript, React, Canvas API
 *
 * Live Record: real-time MediaRecorder capture (canvas + audio)
 */

import React, { useRef, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { VisualizerSettings } from './types';
import { extractColors } from './utils/color';
import {
  drawCircularBars, drawCircularWave, drawSpiral, drawParticles,
  drawRing, drawStrings, drawOrbit, drawSpikes, drawLaser,
  drawNebula, drawAura, drawPeaks,
  drawDiamond, drawTunnel, drawFrequency, drawFractal,
  drawHelix, drawConstellation, drawLightning, drawWaveform, drawPrism
} from './visualizers/drawings';
import { LiveRecorder, downloadRecording } from './utils/liveRecorder';

import { CropModal } from './components/ui/CropModal';
import { BottomDock, ExportResolution } from './components/ui/BottomDock';
import { SettingsPanel } from './components/ui/SettingsPanel';

type AspectRatio = '16:9' | '9:16';

export default function App() {
  // ── Media state ──────────────────────────────────────────────────────────
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [centerImage, setCenterImage] = useState<string | null>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // ── Playback ─────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [showControls, setShowControls] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [performanceMode, setPerformanceMode] = useState(false);
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });

  // ── Export resolution ────────────────────────────────────────────────────
  const [exportResolution, setExportResolution] = useState<ExportResolution>('1080p');

  // ── Live Record ──────────────────────────────────────────────────────────
  const [isLiveRecording, setIsLiveRecording] = useState(false);
  const liveRecorderRef = useRef<LiveRecorder | null>(null);
  const isLiveRecordingRef = useRef(false); // mirrors state, accessible in rAF loop

  // ── Visualizer settings ──────────────────────────────────────────────────
  const [settings, setSettings] = useState<VisualizerSettings>({
    primaryColor: '#ff2a5f',
    secondaryColor: '#ff8a8a',
    sensitivity: 1.4,
    barWidth: 3,
    radius: 170,
    type: 'strings',
    centerMode: 'profile',
    centerText: '',
    centerTextSize: 20,
    centerColor: '#000000',
    logoScale: 0.5,
    bgBlur: 8,
    bgOpacity: 0.65,
    mirror: true,
    rotationSpeed: 0.5,
    pulseEnabled: true,
    glowEnabled: true,
    trailEnabled: true,
    colorCycle: true,
    shakeEnabled: true,
    echoEnabled: false,
    invertColors: false,
    bgParticlesEnabled: true,
    performanceMode: false,
    starburstEnabled: false,
    kaleidoscopeEnabled: false,
    scanlineEnabled: true,
    chromaticEnabled: false,
    vignetteEnabled: false,
    pixelateEnabled: false,
    strobeEnabled: false,
    rippleEnabled: true,
  });

  // ── Refs ─────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>(0);
  const settingsRef = useRef<VisualizerSettings>(settings);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const centerImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const renderFrameRef = useRef<((ts: number) => void) | null>(null);
  const liveProgressRef = useRef<HTMLSpanElement>(null);
  const liveProgressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Auto-load Demo Assets ────────────────────────────────────────────────
  useEffect(() => {
    const loadDemo = async () => {
      try {
        // Load demo background and profile image
        setBgImage('/demo-bg.png');
        setCenterImage('/demo-profile.png');

        const img = new Image();
        img.onload = () => {
          centerImgRef.current = img;
          setSettings(s => ({ ...s, centerMode: 'profile' }));
        };
        img.src = '/demo-profile.png';

        // Fetch demo audio and convert to File object
        const response = await fetch('/demo-audio.mp3');
        const blob = await response.blob();
        const file = new File([blob], 'DemonSlayer-Theme.mp3', { type: 'audio/mpeg' });

        setAudioFile(file);

        // Setup audio element for immediate playback
        if (audioRef.current) {
          const url = URL.createObjectURL(file);
          audioRef.current.src = url;
          audioRef.current.load();
        }
      } catch (err) {
        console.error('Failed to load demo assets:', err);
      }
    };

    loadDemo();
  }, []);

  // ── Resolution map ───────────────────────────────────────────────────────
  const EXPORT_SIZES: Record<ExportResolution, { w: number; h: number }> = {
    '1080p': { w: 1920, h: 1080 },
    '2K': { w: 2560, h: 1440 },
    '4K': { w: 3840, h: 2160 },
  };

  // ── Live Record ─────────────────────────────────────────────────────────
  const startLiveRecord = () => {
    if (!audioFile || !canvasRef.current || !audioRef.current || !audioContextRef.current) return;
    if (isLiveRecording) return;

    const canvas = canvasRef.current;

    // ── Resize canvas to target export resolution ─────────────────────────
    const { w: expW, h: expH } = EXPORT_SIZES[exportResolution];
    // Swap for portrait mode
    const targetW = aspectRatio === '9:16' ? expH : expW;
    const targetH = aspectRatio === '9:16' ? expW : expH;

    // Save previous CSS sizing
    const prevStyleWidth = canvas.style.width;
    const prevStyleHeight = canvas.style.height;

    canvas.width = targetW;
    canvas.height = targetH;
    // Scale the canvas element DOWN so it still fits the preview box
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';

    // Lock the render loop so it stops auto-resizing canvas during recording
    isLiveRecordingRef.current = true;

    // ── Mute speaker output so the user isn't disturbed ──────────────────
    audioRef.current.volume = 0;

    // Always seek to start and play from the beginning for a complete export
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(console.error);
    setIsPlaying(true);

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const rec = new LiveRecorder({
      canvas,
      audioElement: audioRef.current,
      audioContext: audioContextRef.current,
      audioSourceNode: sourceRef.current || undefined,
      fps: 30,
      onStop: (blob) => {
        isLiveRecordingRef.current = false;
        // Restore canvas CSS to preview sizing
        canvas.style.width = prevStyleWidth;
        canvas.style.height = prevStyleHeight;
        canvas.style.objectFit = '';
        // Restore audio and trigger download
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.volume = 1;
        }
        const baseName = audioFile.name.replace(/\.[^.]+$/, '') || 'sonic-visualizer-live';
        downloadRecording(blob, `${baseName}-${exportResolution}`);
        setIsLiveRecording(false);
        setIsPlaying(false);
      },
    });
    rec.start();
    liveRecorderRef.current = rec;
    setIsLiveRecording(true);

    // Auto-stop when song finishes
    const handleEnded = () => {
      rec.stop();
      audioRef.current!.removeEventListener('ended', handleEnded);
    };
    audioRef.current.addEventListener('ended', handleEnded);
  };

  const stopLiveRecord = () => {
    // Just call stop() — the onStop callback handles all cleanup:
    // restoring volume, resetting isLiveRecording, and triggering the download.
    liveRecorderRef.current?.stop();
  };

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioContextRef.current) audioContextRef.current.close();
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // ── Media handlers ───────────────────────────────────────────────────────
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
    if (file) { const url = URL.createObjectURL(file); setBgImage(url); setBgFile(file); }
  };

  useEffect(() => {
    if (!bgImage) { bgImgRef.current = null; return; }
    const img = new Image(); img.src = bgImage;
    img.onload = () => { bgImgRef.current = img; };
  }, [bgImage]);

  const handleCenterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const url = URL.createObjectURL(file); setCropSrc(url); }
    e.target.value = '';
  };

  const handleCropConfirm = async (croppedDataUrl: string) => {
    setCropSrc(null);
    setCenterImage(croppedDataUrl);
    setSettings(s => ({ ...s, centerMode: 'profile' }));
    const img = new Image(); img.src = croppedDataUrl;
    img.onload = () => { centerImgRef.current = img; };
    const [primary, secondary] = await extractColors(croppedDataUrl);
    setSettings(s => ({ ...s, primaryColor: primary, secondaryColor: secondary }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoImage(url);
      setSettings(s => ({ ...s, centerMode: 'logo' }));
      const img = new Image(); img.src = url;
      img.onload = () => { logoImgRef.current = img; };
    }
  };

  // ── Playback ─────────────────────────────────────────────────────────────
  const togglePlay = async () => {
    if (!audioRef.current || !audioFile) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setIsPlaying(!isPlaying);
  };

  // ── Render loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let rotation = 0;
    let particles: any[] = [];
    let nebParticles: any[] = [];
    let bgParticles: any[] = [];
    const dataArray = new Uint8Array(1024);
    let colorCycleHue = 0;
    let lastFrameTime = 0;

    const renderFrame = (timestamp: number) => {
      animationRef.current = requestAnimationFrame(renderFrame);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const s = settingsRef.current;
      const targetFps = s.performanceMode ? 30 : 60;
      if (timestamp - lastFrameTime < 1000 / targetFps) return;
      lastFrameTime = timestamp;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scale = s.performanceMode ? 0.5 : 1;

      const isLiveRecordingNow = isLiveRecordingRef.current;

      if (isLiveRecordingNow && audioRef.current && liveProgressRef.current && liveProgressBarRef.current) {
        const duration = audioRef.current.duration;
        if (duration > 0) {
          const p = Math.min(100, Math.max(0, (audioRef.current.currentTime / duration) * 100));
          liveProgressRef.current.innerText = `${Math.round(p)}%`;
          liveProgressBarRef.current.style.width = `${p}%`;
        }
      }

      if (!isLiveRecordingNow) {
        const box = previewBoxRef.current;
        const boxW = box ? box.clientWidth : window.innerWidth;
        const boxH = box ? box.clientHeight : window.innerHeight;
        const targetW = Math.floor(boxW * scale);
        const targetH = Math.floor(boxH * scale);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW; canvas.height = targetH;
          canvas.style.width = boxW + 'px'; canvas.style.height = boxH + 'px';
          canvas.style.imageRendering = 'auto';
        }
      }

      if (analyserRef.current) {
        if (s.performanceMode && analyserRef.current.fftSize !== 512) analyserRef.current.fftSize = 512;
        else if (!s.performanceMode && analyserRef.current.fftSize !== 2048) analyserRef.current.fftSize = 2048;
        analyserRef.current.getByteFrequencyData(dataArray);
      } else { dataArray.fill(0); }

      if (s.colorCycle) colorCycleHue = (colorCycleHue + 0.5) % 360;

      const box = previewBoxRef.current;
      const virtualWidth = isLiveRecordingNow ? canvas.width : (box ? box.clientWidth : window.innerWidth);
      const virtualHeight = isLiveRecordingNow ? canvas.height : (box ? box.clientHeight : window.innerHeight);

      ctx.save();
      if (!isLiveRecordingNow) ctx.scale(scale, scale);

      if (s.trailEnabled) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, 0, virtualWidth, virtualHeight);
        ctx.globalCompositeOperation = 'source-over';
      } else { ctx.clearRect(0, 0, virtualWidth, virtualHeight); }

      // Background image
      if (bgImgRef.current) {
        ctx.save();
        const img = bgImgRef.current;
        const pad = s.bgBlur * 2;
        const sc = Math.max((virtualWidth + pad * 2) / img.naturalWidth, (virtualHeight + pad * 2) / img.naturalHeight);
        const sw = img.naturalWidth * sc, sh = img.naturalHeight * sc;
        if (s.bgBlur > 0) ctx.filter = `blur(${s.bgBlur}px)`;
        ctx.globalAlpha = s.bgOpacity;
        ctx.drawImage(img, (virtualWidth - sw) / 2, (virtualHeight - sh) / 2, sw, sh);
        ctx.filter = 'none'; ctx.globalAlpha = 1;
        ctx.restore();
      }

      const centerX = virtualWidth / 2, centerY = virtualHeight / 2;

      // BG particles
      if (s.bgParticlesEnabled) {
        let bass = 0;
        for (let i = 0; i < 10; i++) bass += dataArray[i];
        bass = bass / 10 / 255;
        if (bgParticles.length < 150 && Math.random() < 0.3) {
          bgParticles.push({
            x: Math.random() * virtualWidth, y: Math.random() * virtualHeight,
            vx: (Math.random() - .5) * .5 * (1 + bass * 2), vy: (Math.random() - .5) * .5 * (1 + bass * 2) - .5,
            life: Math.random() * .5 + .5, size: Math.random() * 2 + .5,
            color: Math.random() > .5 ? s.primaryColor : s.secondaryColor
          });
        }
        ctx.save();
        for (let i = bgParticles.length - 1; i >= 0; i--) {
          const p = bgParticles[i];
          p.x += p.vx; p.y += p.vy; p.life -= .002;
          if (p.x < 0) p.x = virtualWidth; if (p.x > virtualWidth) p.x = 0;
          if (p.y < 0) p.y = virtualHeight; if (p.y > virtualHeight) p.y = 0;
          if (p.life <= 0) { bgParticles.splice(i, 1); continue; }
          ctx.globalAlpha = p.life * .4 * (1 + bass);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color; ctx.fill();
        }
        ctx.restore();
      }

      // Bass analysis
      let bassTotal = 0, maxBass = 0;
      for (let i = 0; i < 20; i++) { bassTotal += dataArray[i]; if (dataArray[i] > maxBass) maxBass = dataArray[i]; }
      const bassAverage = bassTotal / 20;
      const pulseScale = s.pulseEnabled ? 1 + (bassAverage / 255) * .2 : 1;
      // Clamp radius so the circle always fits inside the canvas (critical for 9:16)
      const maxRadius = Math.min(virtualWidth, virtualHeight) / 2 - 30;
      const clampedRadius = Math.min(s.radius, maxRadius);
      const currentRadius = clampedRadius * pulseScale;

      // Shake
      let shakeX = 0, shakeY = 0;
      if (s.shakeEnabled && maxBass > 220) {
        const intensity = (maxBass - 220) / 35;
        shakeX = (Math.random() - .5) * 30 * intensity;
        shakeY = (Math.random() - .5) * 30 * intensity;
      }
      setShakeOffset(prev => {
        if (shakeX === 0 && shakeY === 0 && prev.x === 0 && prev.y === 0) return prev;
        return { x: shakeX, y: shakeY };
      });

      rotation += s.rotationSpeed * .01;

      if (s.invertColors) ctx.filter = 'invert(1) hue-rotate(180deg)';
      if (s.glowEnabled) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = s.colorCycle ? `hsl(${colorCycleHue},100%,60%)` : s.primaryColor;
      }

      const vizPC = s.colorCycle ? `hsl(${colorCycleHue},100%,60%)` : s.primaryColor;
      const vizSC = s.colorCycle ? `hsl(${(colorCycleHue + 120) % 360},100%,60%)` : s.secondaryColor;
      const vizS = s.colorCycle ? { ...s, primaryColor: vizPC, secondaryColor: vizSC } : s;

      const renderViz = (sm: number, a: number) => {
        ctx.save();
        ctx.translate(centerX, centerY); ctx.scale(sm, sm); ctx.translate(-centerX, -centerY);
        ctx.globalAlpha = a;
        if (s.type === 'bars') drawCircularBars(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'wave') drawCircularWave(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'spiral') drawSpiral(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'particles') drawParticles(ctx, dataArray, centerX, centerY, currentRadius, particles, vizS);
        else if (s.type === 'ring') drawRing(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'strings') drawStrings(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'orbit') drawOrbit(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'spikes') drawSpikes(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'laser') drawLaser(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'nebula') drawNebula(ctx, dataArray, centerX, centerY, currentRadius, nebParticles, vizS);
        else if (s.type === 'aura') drawAura(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'peaks') drawPeaks(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'diamond') drawDiamond(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'tunnel') drawTunnel(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'frequency') drawFrequency(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'fractal') drawFractal(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'helix') drawHelix(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'constellation') drawConstellation(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'lightning') drawLightning(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'waveform') drawWaveform(ctx, dataArray, centerX, centerY, currentRadius, vizS);
        else if (s.type === 'prism') drawPrism(ctx, dataArray, centerX, centerY, currentRadius, vizS);
      };

      renderViz(1, 1);
      if (s.echoEnabled) { renderViz(1.2, .3); renderViz(1.5, .1); }
      ctx.shadowBlur = 0;
      ctx.filter = 'none';

      // ── Starburst overlay ──────────────────────────────────────────────────
      if (s.starburstEnabled) {
        let avgHigh = 0;
        for (let i = 80; i < 200; i++) avgHigh += dataArray[i];
        avgHigh = avgHigh / 120 / 255;
        const rays = 16;
        for (let i = 0; i < rays; i++) {
          const angle = (i / rays) * Math.PI * 2;
          const len = currentRadius * (0.3 + avgHigh * 1.2 * s.sensitivity);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + Math.cos(angle) * len, centerY + Math.sin(angle) * len);
          ctx.strokeStyle = i % 2 === 0 ? vizPC : vizSC;
          ctx.lineWidth = 1;
          ctx.globalAlpha = avgHigh * 0.6;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // ── Scanline overlay ───────────────────────────────────────────────────
      if (s.scanlineEnabled) {
        const lineSpacing = 4;
        ctx.save();
        for (let y = 0; y < virtualHeight; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(virtualWidth, y);
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── Kaleidoscope overlay ───────────────────────────────────────────────
      if (s.kaleidoscopeEnabled) {
        const slices = 8;
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.globalCompositeOperation = 'screen';
        for (let k = 1; k < slices; k++) {
          const kAngle = (k / slices) * Math.PI * 2;
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(kAngle);
          ctx.scale(1, -1);
          ctx.translate(-centerX, -centerY);
          ctx.drawImage(ctx.canvas, 0, 0);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }

      // ── Vignette overlay ───────────────────────────────────────────────────
      if (s.vignetteEnabled) {
        let b = 0; for (let i = 0; i < 20; i++) b += dataArray[i]; b = b / 20 / 255;
        const vigGrad = ctx.createRadialGradient(centerX, centerY, currentRadius * 0.4, centerX, centerY, Math.max(virtualWidth, virtualHeight) * 0.8);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, `rgba(0,0,0,${0.5 + b * 0.5})`);
        ctx.save(); ctx.fillStyle = vigGrad; ctx.fillRect(0, 0, virtualWidth, virtualHeight); ctx.restore();
      }

      // ── Chromatic Aberration ───────────────────────────────────────────────
      if (s.chromaticEnabled) {
        let avgMid = 0; for (let i = 40; i < 80; i++) avgMid += dataArray[i]; avgMid = avgMid / 40 / 255;
        const shift = avgMid * 8 * s.sensitivity;
        if (shift > 0.5) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.25;
          ctx.drawImage(ctx.canvas, shift, 0);
          ctx.globalAlpha = 0.15;
          ctx.drawImage(ctx.canvas, -shift, 0);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
        }
      }

      // ── Strobe flash ──────────────────────────────────────────────────────
      if (s.strobeEnabled) {
        let maxB = 0; for (let i = 0; i < 10; i++) if (dataArray[i] > maxB) maxB = dataArray[i];
        if (maxB > 240) {
          ctx.save();
          ctx.fillStyle = `rgba(255,255,255,${(maxB - 240) / 15 * 0.4})`;
          ctx.fillRect(0, 0, virtualWidth, virtualHeight);
          ctx.restore();
        }
      }

      // ── Ripple rings ──────────────────────────────────────────────────────
      if (s.rippleEnabled) {
        let bassR = 0; for (let i = 0; i < 15; i++) bassR += dataArray[i]; bassR = bassR / 15 / 255;
        if (bassR > 0.3) {
          for (let r = 1; r <= 3; r++) {
            const ripR = currentRadius + bassR * 120 * s.sensitivity * r * 0.4;
            ctx.beginPath();
            ctx.arc(centerX, centerY, ripR, 0, Math.PI * 2);
            ctx.strokeStyle = r % 2 === 0 ? vizPC : vizSC;
            ctx.lineWidth = 1;
            ctx.globalAlpha = (1 - (r / 4)) * bassR * 0.7;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Pixelate ──────────────────────────────────────────────────────────
      if (s.pixelateEnabled) {
        let avgAll = 0; for (let i = 0; i < 60; i++) avgAll += dataArray[i]; avgAll = avgAll / 60 / 255;
        const blockSize = Math.max(4, Math.round(20 - avgAll * 14 * s.sensitivity));
        ctx.save();
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = Math.ceil(canvas.width / blockSize);
        tmpCanvas.height = Math.ceil(canvas.height / blockSize);
        const tmpCtx = tmpCanvas.getContext('2d')!;
        tmpCtx.drawImage(canvas, 0, 0, tmpCanvas.width, tmpCanvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmpCanvas, 0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.restore();
        void imgData;
      }

      ctx.beginPath(); ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
      ctx.fillStyle = s.centerColor; ctx.fill();

      if (s.centerMode === 'profile' && centerImgRef.current) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);
        ctx.beginPath(); ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI); ctx.clip();
        ctx.drawImage(centerImgRef.current, centerX - currentRadius, centerY - currentRadius, currentRadius * 2, currentRadius * 2);
        ctx.restore();
      } else if (s.centerMode === 'logo' && logoImgRef.current) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);
        const img = logoImgRef.current;
        const size = (currentRadius * 2) * s.logoScale;
        ctx.drawImage(img, centerX - size / 2, centerY - size / 2, size, size);
        ctx.restore();
      }

      ctx.strokeStyle = s.primaryColor; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI); ctx.stroke();
      ctx.restore();

      if (s.centerMode === 'text' && s.centerText) {
        ctx.save();
        ctx.font = `600 ${s.centerTextSize * pulseScale}px "Inter", sans-serif`;
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 12; ctx.shadowColor = s.primaryColor;
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

    renderFrameRef.current = renderFrame;
    renderFrame(0);
  }, []);

  // ── Performance mode sync ────────────────────────────────────────────────
  const handleTogglePerformance = () => {
    setPerformanceMode(p => {
      const next = !p;
      setSettings(s => ({ ...s, performanceMode: next }));
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-screen flex flex-col overflow-hidden select-none bg-black">

      {/* ── HEADER ── */}
      <header className="shrink-0 flex items-center px-4 sm:px-6 h-12 sm:h-14
                         border-b border-white/8 bg-black backdrop-blur-xl relative z-10">

        {/* Left spacer — matches right side for centering */}
        <div className="flex-1" />

        {/* Logo — centered */}
        <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
          <div className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)',
              animation: 'logoPulse 2.4s ease-in-out infinite',
            }} />
          <img
            src="/favicon.ico"
            alt="Sonic Visualizer"
            className="relative z-10 rounded-md"
            style={{ width: 36, height: 36, imageRendering: 'auto' }}
          />
        </div>

        {/* Right — aspect ratio toggle */}
        <div className="flex-1 flex justify-end">
          <div className="flex items-center gap-px bg-white/5 rounded-lg p-0.5 border border-white/10">
            {(['16:9', '9:16'] as AspectRatio[]).map(r => (
              <button
                key={r}
                onClick={() => setAspectRatio(r)}
                className={`px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${aspectRatio === r
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
                  }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Keyframe styles */}
      <style>{`
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.7); opacity: 0.9; }
        }
      `}</style>

      {/* ── MAIN CONTENT: preview + sidebar ── */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0">

        {/* ── LEFT: canvas preview ── */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-5 overflow-hidden relative min-w-0 bg-[#080808]">
          {/* Preview box — sized to exactly fill the container at the correct ratio */}
          <div
            ref={previewBoxRef}
            className="relative bg-black rounded-xl overflow-hidden border border-white/6"
            style={
              aspectRatio === '16:9'
                ? {
                  aspectRatio: '16/9',
                  width: '100%',
                  maxHeight: '100%',
                  /* if the width-derived height would overflow, shrink via max-height */
                  height: 'auto',
                }
                : {
                  aspectRatio: '9/16',
                  height: '100%',
                  maxWidth: '100%',
                  width: 'auto',
                }
            }
          >
            {/* Canvas fills the box */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ transform: `translate(${shakeOffset.x}px,${shakeOffset.y}px)` }}
            />

            {/* ── Background-export overlay ── shown while recording */}
            {isLiveRecording && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center
                              bg-black/85 backdrop-blur-md">
                <div className="relative mb-5 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative z-10 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                    {/* Spinning dotted ring */}
                    <svg className="absolute inset-0 w-full h-full animate-[spin_4s_linear_infinite]" viewBox="0 0 56 56" fill="none">
                      <circle cx="28" cy="28" r="26" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="4 4" />
                    </svg>
                    {/* Progress Text */}
                    <span ref={liveProgressRef} className="text-sm font-bold text-white tabular-nums tracking-tighter">0%</span>
                  </div>
                  {/* Pulsing glow */}
                  <span className="absolute inset-0 rounded-full bg-white/5 blur-xl animate-pulse" />
                </div>

                <p className="text-white font-bold text-lg tracking-tight mb-1">Recording MP4 Video</p>
                <p className="text-neutral-400 text-[11px] text-center max-w-[200px] leading-relaxed mb-6 uppercase tracking-wider font-semibold">
                  Recording visualizer silently in real-time.
                </p>

                {/* Rich Progress Bar */}
                <div className="w-64 max-w-[80vw] mb-6">
                  <div className="h-2.5 w-full bg-black/40 border border-white/10 rounded-full overflow-hidden shadow-inner relative">
                    <div
                      ref={liveProgressBarRef}
                      className="h-full bg-white rounded-full transition-shadow relative"
                      style={{ width: '0%', boxShadow: '0 0 10px rgba(255,255,255,0.5), inset 0 0 5px rgba(255,255,255,0.8)' }}
                    >
                      {/* Shimmer sweep effect */}
                      <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden rounded-full z-10">
                        <div className="w-[40%] h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] animate-[shimmer_2s_infinite]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stop button */}
                <button
                  onClick={stopLiveRecord}
                  className="px-5 py-2.5 rounded-full border border-white/10 bg-white/5
                             text-neutral-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10
                             text-xs font-bold tracking-widest uppercase transition-all"
                >
                  ✕ Stop & Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Settings sidebar ── */}
        <AnimatePresence>
          {showControls && (
            <div
              className="shrink-0 overflow-hidden border-l border-white/8"
              style={{ width: '272px' }}
            >
              <div className="w-full h-full">
                <SettingsPanel
                  showControls={true}
                  onClose={() => setShowControls(false)}
                  bgImage={bgImage}
                  settings={settings}
                  setSettings={setSettings}
                />
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM DOCK ── */}
      <div className="shrink-0 flex items-center justify-center py-3 sm:py-4 bg-black/60 backdrop-blur-xl border-t border-white/8">
        <BottomDock
          audioFile={audioFile}
          bgFile={bgFile}
          centerImage={centerImage}
          isPlaying={isPlaying}
          showControls={showControls}
          isLiveRecording={isLiveRecording}
          exportResolution={exportResolution}
          togglePlay={togglePlay}
          onAudioUpload={handleAudioUpload}
          onBgUpload={handleBgUpload}
          onCenterImageUpload={handleCenterImageUpload}
          onToggleSettings={() => setShowControls(v => !v)}
          onLiveRecord={isLiveRecording ? stopLiveRecord : startLiveRecord}
          onExportResolutionChange={setExportResolution}
        />
      </div>

      {/* ── Hidden audio ── */}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} crossOrigin="anonymous" />

      {/* ── Crop modal ── */}
      {cropSrc && <CropModal src={cropSrc} onConfirm={handleCropConfirm} onCancel={() => setCropSrc(null)} />}
    </div>
  );
}
