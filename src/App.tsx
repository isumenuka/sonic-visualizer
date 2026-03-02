/**
 * Sonic Visualizer
 * Tech: C/C++ → WebAssembly (FFmpeg), TypeScript, HTML/CSS
 *
 * Deployment: GitHub → Vercel (frontend) + Render.com (FFmpeg WASM server)
 *
 * Export engines:
 *   - WebCodecs (primary): GPU-accelerated, fast, outputs MP4/WebM natively
 *   - FFmpeg WASM (fallback): CPU-based, universally compatible, uses Render.com CDN
 */

import React, { useRef, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { VisualizerSettings } from './types';
import { extractColors } from './utils/color';
import {
  drawCircularBars, drawCircularWave, drawSpiral, drawParticles,
  drawRing, drawStrings, drawOrbit, drawSpikes, drawLaser,
  drawNebula, drawAura, drawPeaks
} from './visualizers/drawings';
import { exportWithFFmpeg } from './utils/ffmpegExportEngine';
import { exportWithWebCodecs } from './utils/exportEngine';
import { exportWithServer } from './utils/serverExportEngine';

import { CropModal } from './components/ui/CropModal';
import { BottomDock } from './components/ui/BottomDock';
import { SettingsPanel } from './components/ui/SettingsPanel';
import { ExportModal } from './components/ui/ExportModal';

type AspectRatio = '16:9' | '9:16';
export type ExportEngine = 'webcodecs' | 'ffmpeg' | 'server';

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

  // ── Export ───────────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSpeed, setExportSpeed] = useState(0);
  const [recordingQuality, setRecordingQuality] = useState<'1080p' | '2k' | '4k'>('1080p');

  // Dual export engine: WebCodecs (GPU) is primary; FFmpeg WASM is the fallback.
  const [exportEngine, setExportEngine] = useState<ExportEngine>(() => {
    // If WebCodecs VideoEncoder is unavailable (old browser), default to FFmpeg.
    return typeof VideoEncoder !== 'undefined' ? 'webcodecs' : 'ffmpeg';
  });

  const exportAbortRef = useRef<AbortController | null>(null);
  const isExportingRef = useRef(false);
  const wasPlayingRef = useRef(false);  // remember playback state so we can resume after export

  // ── Visualizer settings ──────────────────────────────────────────────────
  const [settings, setSettings] = useState<VisualizerSettings>({
    primaryColor: '#00ff88',
    secondaryColor: '#00aaff',
    sensitivity: 1.5,
    barWidth: 3,
    radius: 150,
    type: 'bars',
    centerMode: 'text',
    centerText: 'SONIC',
    centerTextSize: 20,
    centerColor: '#000000',
    logoScale: 0.5,
    bgBlur: 10,
    bgOpacity: 0.5,
    mirror: true,
    rotationSpeed: 0,
    pulseEnabled: false,
    glowEnabled: true,
    trailEnabled: false,
    colorCycle: false,
    shakeEnabled: false,
    echoEnabled: false,
    invertColors: false,
    bgParticlesEnabled: false,
    performanceMode: false,
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
  // Callback ref so we can restart the rAF loop after export finishes
  const renderFrameRef = useRef<((ts: number) => void) | null>(null);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Resolution map ───────────────────────────────────────────────────────
  const resolutionMap = { '1080p': [1920, 1080], '2k': [2560, 1440], '4k': [3840, 2160] };

  // ── Export ───────────────────────────────────────────────────────────────
  const exportVideo = async () => {
    if (!audioFile) return;
    const abortController = new AbortController();
    exportAbortRef.current = abortController;
    setIsExporting(true);
    setExportError(null);
    isExportingRef.current = true;
    setExportProgress(0);
    setExportSpeed(0);

    // ── Stop everything to give the encoder full CPU/GPU/memory ──────────────
    // 1. Pause audio playback
    wasPlayingRef.current = isPlaying;
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    // 2. Suspend Web Audio graph (stops analyser, frees audio thread CPU)
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.suspend();
    }
    // 3. Stop the canvas animation loop
    cancelAnimationFrame(animationRef.current);
    animationRef.current = 0;

    let [w, h] = resolutionMap[recordingQuality];
    if (aspectRatio === '9:16') [w, h] = [h, w];

    const engineFn = exportEngine === 'webcodecs' ? exportWithWebCodecs : exportWithFFmpeg;

    // resumeApp must be declared before any early-return paths
    const resumeApp = () => {
      if (animationRef.current === 0 && renderFrameRef.current) {
        animationRef.current = requestAnimationFrame(renderFrameRef.current);
      }
      audioContextRef.current?.resume();
    };

    if (exportEngine === 'server') {
      // ── Cloud render: send audio + settings to Render.com server ────────────
      try {
        await exportWithServer({
          audioFile,
          quality: recordingQuality,
          aspectRatio,
          settings: settingsRef.current,
          onProgress: (pct, stage) => {
            setExportProgress(pct);
            // Reuse exportSpeed as a stage label indicator (0 = uploading, 1 = rendering)
            setExportSpeed(stage.startsWith('Server') ? 1 : 0);
          },
          signal: abortController.signal,
        });
        setIsExporting(false);
        isExportingRef.current = false;
        exportAbortRef.current = null;
        resumeApp();
      } catch (err: any) {
        setIsExporting(false);
        isExportingRef.current = false;
        exportAbortRef.current = null;
        resumeApp();
        if (!abortController.signal.aborted) {
          setExportError(err?.message || String(err));
        }
      }
      return;  // server path handled above, skip local encoder below
    }

    try {
      await engineFn({
        audioFile, width: w, height: h, quality: recordingQuality,
        settings: settingsRef.current,
        bgImg: bgImgRef.current, centerImg: centerImgRef.current, logoImg: logoImgRef.current,
        onProgress: (pct, speedX) => { setExportProgress(pct); setExportSpeed(speedX); },
        signal: abortController.signal,
      });
      setIsExporting(false);
      isExportingRef.current = false;
      exportAbortRef.current = null;
      resumeApp();
    } catch (err: any) {
      if (!abortController.signal.aborted) {
        setExportError(err?.message || String(err));
        console.error('[Export Error]', err);
        resumeApp();
      } else {
        setIsExporting(false);
        isExportingRef.current = false;
        exportAbortRef.current = null;
        resumeApp();
      }
    }
  };

  const cancelExport = () => {
    exportAbortRef.current?.abort();
    setIsExporting(false);
    isExportingRef.current = false;
    setExportError(null);
    // resumeApp() is called inside the catch block above when abort fires
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
      const isExportingNow = isExportingRef.current;
      const targetFps = (s.performanceMode && !isExportingNow) ? 30 : 60;
      if (timestamp - lastFrameTime < 1000 / targetFps) return;
      lastFrameTime = timestamp;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const scale = (s.performanceMode && !isExportingNow) ? 0.5 : 1;

      if (!isExportingNow) {
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
        if (s.performanceMode && !isExportingNow && analyserRef.current.fftSize !== 512) analyserRef.current.fftSize = 512;
        else if ((!s.performanceMode || isExportingNow) && analyserRef.current.fftSize !== 2048) analyserRef.current.fftSize = 2048;
        analyserRef.current.getByteFrequencyData(dataArray);
      } else { dataArray.fill(0); }

      if (s.colorCycle) colorCycleHue = (colorCycleHue + 0.5) % 360;

      const box = previewBoxRef.current;
      const virtualWidth = isExportingNow ? canvas.width : (box ? box.clientWidth : window.innerWidth);
      const virtualHeight = isExportingNow ? canvas.height : (box ? box.clientHeight : window.innerHeight);

      ctx.save();
      if (!isExportingNow) ctx.scale(scale, scale);

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
      const currentRadius = s.radius * pulseScale;

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

      ctx.save();
      if (s.invertColors) ctx.filter = 'invert(1) hue-rotate(180deg)';
      ctx.translate(centerX, centerY); ctx.rotate(rotation); ctx.translate(-centerX, -centerY);
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
        ctx.restore();
      };

      renderViz(1, 1);
      if (s.echoEnabled) { renderViz(1.2, .3); renderViz(1.5, .1); }
      ctx.shadowBlur = 0;

      ctx.beginPath(); ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI);
      ctx.fillStyle = s.centerColor; ctx.fill();

      if (s.centerMode === 'profile' && centerImgRef.current) {
        ctx.save(); ctx.beginPath(); ctx.arc(centerX, centerY, currentRadius - 5, 0, 2 * Math.PI); ctx.clip();
        ctx.drawImage(centerImgRef.current, centerX - currentRadius, centerY - currentRadius, currentRadius * 2, currentRadius * 2);
        ctx.restore();
      } else if (s.centerMode === 'logo' && logoImgRef.current) {
        const img = logoImgRef.current;
        const size = (currentRadius * 2) * s.logoScale;
        ctx.drawImage(img, centerX - size / 2, centerY - size / 2, size, size);
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
        } else { ctx.fillText(s.centerText, centerX, centerY); }
        ctx.restore();
      }
      ctx.restore();
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
      <header className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-2.5 h-12 sm:h-14
                         border-b border-white/8 bg-black/60 backdrop-blur-xl relative z-10">

        {/* Brand */}
        <span className="text-sm font-semibold text-white tracking-tight">Sonic Visualizer</span>

        {/* Aspect ratio */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-0.5 border border-white/10">
          {(['16:9', '9:16'] as AspectRatio[]).map(r => (
            <button
              key={r}
              onClick={() => setAspectRatio(r)}
              className={`px-3 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${aspectRatio === r
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white'
                }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Performance toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-400 hidden sm:block">Perf Mode</span>
          <button
            onClick={handleTogglePerformance}
            className={`w-9 h-5 rounded-full relative transition-colors ${performanceMode ? 'bg-white' : 'bg-neutral-700'
              }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${performanceMode ? 'bg-black translate-x-4' : 'bg-neutral-400 translate-x-0'
              }`} />
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT: preview + sidebar ── */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0">

        {/* ── LEFT: canvas preview ── */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-5 overflow-hidden relative min-w-0 bg-[#080808]">
          {/* Preview box */}
          <div
            ref={previewBoxRef}
            className="relative bg-black rounded-xl overflow-hidden border border-white/6"
            style={
              aspectRatio === '16:9'
                ? { aspectRatio: '16/9', width: '100%', maxWidth: '100%', maxHeight: '100%' }
                : { aspectRatio: '9/16', height: '100%', maxHeight: '100%', width: 'auto', maxWidth: '100%' }
            }
          >
            {/* Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ transform: `translate(${shakeOffset.x}px,${shakeOffset.y}px)` }}
            />
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
          isExporting={isExporting}
          recordingQuality={recordingQuality}
          exportEngine={exportEngine}
          togglePlay={togglePlay}
          onAudioUpload={handleAudioUpload}
          onBgUpload={handleBgUpload}
          onCenterImageUpload={handleCenterImageUpload}
          onToggleSettings={() => setShowControls(v => !v)}
          onQualityChange={setRecordingQuality}
          onEngineChange={setExportEngine}
          onExport={exportVideo}
        />
      </div>

      {/* ── Hidden audio ── */}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} crossOrigin="anonymous" />

      {/* ── Crop modal ── */}
      {cropSrc && <CropModal src={cropSrc} onConfirm={handleCropConfirm} onCancel={() => setCropSrc(null)} />}

      {/* ── Export modal ── */}
      <ExportModal
        isOpen={isExporting}
        progress={exportProgress}
        speed={exportSpeed}
        error={exportError}
        engine={exportEngine}
        onCancel={cancelExport}
      />
    </div>
  );
}
