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
                <input type="file" accept="audio/*" onChange={onAudioUpload} className="hidden" />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
                    {audioFile ? 'Change Audio' : 'Upload Audio'}
                </div>
            </label>

            {/* Upload Background */}
            <label className="p-3 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors relative group">
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*" onChange={onBgUpload} className="hidden" />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
                    {bgFile ? 'Change Background' : 'Upload Background'}
                </div>
            </label>

            {/* Upload Profile */}
            <label className="p-3 rounded-full hover:bg-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors relative group">
                <User className="w-5 h-5" />
                <input type="file" accept="image/*" onChange={onCenterImageUpload} className="hidden" />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 pointer-events-none">
                    {centerImage ? 'Change Profile' : 'Upload Profile Picture'}
                </div>
            </label>

            <div className="w-px h-8 bg-white/10 mx-2" />

            {/* Settings Toggle */}
            <button
                onClick={onToggleSettings}
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
                        onClick={() => onQualityChange(q)}
                        disabled={isExporting}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${recordingQuality === q ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
                    >
                        {q}
                    </button>
                ))}
            </div>

            {/* Export Button */}
            <button
                onClick={onExport}
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
    );
}
