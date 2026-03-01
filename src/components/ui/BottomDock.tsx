import React from 'react';
import { Play, Pause, Music, Image as ImageIcon, User, Settings, Download } from 'lucide-react';

export interface BottomDockProps {
    audioFile: File | null;
    bgFile: File | null;
    centerImage: string | null;
    isPlaying: boolean;
    showControls: boolean;
    isExporting: boolean;
    recordingQuality: '1080p' | '2k' | '4k';
    togglePlay: () => void;
    onAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBgUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCenterImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onToggleSettings: () => void;
    onQualityChange: (quality: '1080p' | '2k' | '4k') => void;
    onExport: () => void;
}

export function BottomDock({
    audioFile, bgFile, centerImage, isPlaying, showControls, isExporting,
    recordingQuality, togglePlay, onAudioUpload, onBgUpload, onCenterImageUpload,
    onToggleSettings, onQualityChange, onExport
}: BottomDockProps) {
    return (
        <div className="flex items-center justify-center w-full"
            style={{ maxWidth: 'calc(100vw - 16px)' }}>

            {/* ── Single unified dock row ── */}
            <div className="flex items-center gap-1 sm:gap-1.5
                bg-[#0a0a0a]/90 backdrop-blur-3xl
                border border-white/10
                rounded-2xl sm:rounded-full
                px-2 py-1.5 sm:px-3 sm:py-2
                shadow-2xl
                flex-wrap sm:flex-nowrap
                justify-center"
            >
                {/* ── Play / Pause ── */}
                <button
                    onClick={togglePlay}
                    disabled={!audioFile}
                    className={`p-2.5 sm:p-3 rounded-full flex items-center justify-center transition-all shrink-0 ${audioFile
                        ? 'bg-white text-black hover:bg-neutral-200 active:scale-95'
                        : 'bg-white/5 text-neutral-600 cursor-not-allowed'}`}
                >
                    {isPlaying
                        ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                        : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
                </button>

                <div className="w-px h-6 bg-white/10 mx-0.5 sm:mx-1 shrink-0" />

                {/* ── Upload Audio ── */}
                <label className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors relative group shrink-0">
                    <Music className="w-4 h-4 sm:w-5 sm:h-5" />
                    <input type="file" accept="audio/*" onChange={onAudioUpload} className="hidden" />
                    <span className="absolute -top-9 left-1/2 -translate-x-1/2 hidden sm:block bg-black/80 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
                        {audioFile ? 'Change Audio' : 'Upload Audio'}
                    </span>
                </label>

                {/* ── Upload Background ── */}
                <label className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors relative group shrink-0">
                    <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <input type="file" accept="image/*" onChange={onBgUpload} className="hidden" />
                    <span className="absolute -top-9 left-1/2 -translate-x-1/2 hidden sm:block bg-black/80 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
                        {bgFile ? 'Change BG' : 'Upload BG'}
                    </span>
                </label>

                {/* ── Upload Profile ── */}
                <label className="p-2 sm:p-2.5 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors relative group shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                    <input type="file" accept="image/*" onChange={onCenterImageUpload} className="hidden" />
                    <span className="absolute -top-9 left-1/2 -translate-x-1/2 hidden sm:block bg-black/80 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
                        {centerImage ? 'Change Photo' : 'Upload Photo'}
                    </span>
                </label>

                {/* ── Settings toggle ── */}
                <button
                    onClick={onToggleSettings}
                    className={`p-2 sm:p-2.5 rounded-full transition-colors shrink-0 ${showControls ? 'bg-white text-black' : 'hover:bg-white/10 text-neutral-300 hover:text-white'}`}
                >
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <div className="w-px h-6 bg-white/10 mx-0.5 sm:mx-1 shrink-0" />

                {/* ── Quality selector ── */}
                <div className="flex items-center gap-0.5 bg-white/5 rounded-full px-1 py-1 border border-white/10 shrink-0">
                    {(['1080p', '2k', '4k'] as const).map(q => (
                        <button
                            key={q}
                            onClick={() => onQualityChange(q)}
                            disabled={isExporting}
                            className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${recordingQuality === q ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
                        >
                            {q}
                        </button>
                    ))}
                </div>

                {/* ── Export ── */}
                <button
                    onClick={onExport}
                    disabled={!audioFile || isExporting}
                    className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-[11px] font-semibold tracking-wide transition-all shrink-0 ${isExporting
                        ? 'bg-white/10 text-neutral-400 cursor-not-allowed'
                        : audioFile
                            ? 'hover:bg-white text-neutral-300 hover:text-black border border-white/20'
                            : 'text-neutral-600 cursor-not-allowed'}`}
                >
                    {isExporting ? (
                        <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <Download className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="hidden sm:inline">{isExporting ? 'Exporting…' : 'Export'}</span>
                </button>
            </div>
        </div>
    );
}
