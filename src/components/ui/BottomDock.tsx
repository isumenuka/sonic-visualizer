import React from 'react';
import { Play, Pause, Music, Image as ImageIcon, User, Settings, Download } from 'lucide-react';

export type ExportResolution = '1080p' | '2K' | '4K';

export interface BottomDockProps {
    audioFile: File | null;
    bgFile: File | null;
    centerImage: string | null;
    isPlaying: boolean;
    showControls: boolean;
    isLiveRecording: boolean;
    exportResolution: ExportResolution;
    togglePlay: () => void;
    onAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBgUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCenterImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onToggleSettings: () => void;
    onLiveRecord: () => void;
    onExportResolutionChange: (r: ExportResolution) => void;
}

const RESOLUTIONS: ExportResolution[] = ['1080p', '2K', '4K'];

export function BottomDock({
    audioFile, bgFile, centerImage, isPlaying, showControls, isLiveRecording,
    exportResolution,
    togglePlay, onAudioUpload, onBgUpload, onCenterImageUpload,
    onToggleSettings, onLiveRecord, onExportResolutionChange
}: BottomDockProps) {

    return (
        <div className="flex flex-col items-center justify-center w-full gap-2"
            style={{ maxWidth: 'calc(100vw - 16px)' }}>

            {/* ── Resolution chips (visible when audio loaded and not recording) ── */}
            {audioFile && !isLiveRecording && (
                <div className="flex items-center gap-1">
                    <span className="text-neutral-500 text-[10px] font-semibold tracking-widest uppercase mr-1">Resolution</span>
                    {RESOLUTIONS.map(r => (
                        <button
                            key={r}
                            onClick={() => onExportResolutionChange(r)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border transition-all
                                ${exportResolution === r
                                    ? 'bg-white text-black border-white'
                                    : 'bg-white/5 text-neutral-400 border-white/10 hover:border-white/30 hover:text-white'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            )}

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
                    disabled={!audioFile || isLiveRecording}
                    className={`p-2.5 sm:p-3 rounded-full flex items-center justify-center transition-all shrink-0 ${audioFile && !isLiveRecording
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

                {/* ── Export / Download button ── */}
                <button
                    onClick={onLiveRecord}
                    disabled={!audioFile}
                    title={isLiveRecording
                        ? 'Recording… click to stop & download MP4'
                        : `Export ${exportResolution} MP4 — plays full audio and records`}
                    className={`
                        flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2
                        rounded-full font-semibold text-[10px] sm:text-[11px] tracking-wide
                        transition-all shrink-0 relative overflow-hidden
                        ${isLiveRecording
                            ? 'bg-white text-black cursor-pointer'
                            : !audioFile
                                ? 'bg-white/5 text-neutral-600 cursor-not-allowed'
                                : 'bg-white text-black hover:bg-neutral-200 active:scale-95'
                        }
                    `}
                >
                    {isLiveRecording ? (
                        <>
                            {/* Animated download arrow bouncing */}
                            <span className="relative flex items-center justify-center w-3.5 h-3.5">
                                <Download className="w-3.5 h-3.5 animate-bounce" />
                            </span>
                            <span>Exporting…</span>
                            {/* Shimmer sweep animation */}
                            <span className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                                <span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-black/10 to-transparent animate-[shimmer_1.4s_ease-in-out_infinite]" />
                            </span>
                            {/* Red pulsing recording dot */}
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                        </>
                    ) : (
                        <>
                            <Download className="w-3.5 h-3.5 shrink-0" />
                            <span>Export {exportResolution}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
