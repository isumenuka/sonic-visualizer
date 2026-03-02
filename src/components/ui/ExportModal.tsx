import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ExportEngine } from '../../App';

export interface ExportModalProps {
    isOpen: boolean;
    progress: number;
    speed: number;
    error?: string | null;
    engine: ExportEngine;
    onCancel: () => void;
}

export function ExportModal({ isOpen, progress, speed, error, engine, onCancel }: ExportModalProps) {
    const speedLabel = speed > 0.5 ? `${speed.toFixed(1)}× realtime` : 'Initialising…';
    const isDone = progress >= 100;

    const getStageLabel = () => {
        if (engine === 'webcodecs') {
            return 'GPU encoding frames…';
        }
        // FFmpeg two-phase: 0-50% = render frames, 50-100% = transcode
        if (progress < 50) return `Rendering frames… ${Math.round(progress * 2)}%`;
        return `FFmpeg transcoding… ${Math.round((progress - 50) * 2)}%`;
    };

    return (
        <AnimatePresence>
            {(isOpen || error) && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6"
                >
                    <motion.div
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                        className="
                            w-full sm:max-w-sm
                            bg-[#0f0f0f] border border-white/10
                            rounded-t-3xl sm:rounded-2xl
                            px-6 pb-8 pt-6 sm:p-8
                            flex flex-col items-center gap-5
                            shadow-2xl
                        "
                    >
                        {/* Mobile pill */}
                        <div className="w-10 h-1 bg-white/20 rounded-full sm:hidden" />

                        {error ? (
                            /* ── Error State ── */
                            <div className="flex flex-col items-center gap-4 w-full">
                                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-base font-bold text-white mb-1">Export Failed</h3>
                                    <p className="text-xs text-neutral-400">
                                        {engine === 'webcodecs' ? 'WebCodecs encoder error' : 'FFmpeg encountered an error'}
                                    </p>
                                </div>
                                <div className="w-full bg-rose-500/8 border border-rose-500/15 rounded-xl px-4 py-3
                                                text-rose-300 text-xs text-center max-h-28 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                                    {error}
                                </div>
                                <button
                                    onClick={onCancel}
                                    className="px-6 py-2.5 rounded-full border border-white/10 hover:bg-white/5 text-white text-sm font-medium transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            /* ── Progress State ── */
                            <div className="flex flex-col items-center gap-4 w-full">
                                {isDone ? (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                        className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"
                                    >
                                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </motion.div>
                                ) : (
                                    <div className="relative w-14 h-14">
                                        <svg className="w-full h-full animate-spin" viewBox="0 0 56 56" fill="none">
                                            <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                                            <circle cx="28" cy="28" r="24" stroke="white" strokeWidth="4"
                                                strokeLinecap="round" strokeDasharray="150.8" strokeDashoffset="113.1" />
                                        </svg>
                                    </div>
                                )}

                                <div className="text-center">
                                    <h3 className="text-base font-bold text-white">
                                        {isDone ? 'Export Complete' : 'Rendering Video'}
                                    </h3>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        {isDone
                                            ? `Your MP4 is downloading…`
                                            : speedLabel}
                                    </p>
                                    {/* Engine badge */}
                                    {!isDone && (
                                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${engine === 'webcodecs'
                                            ? 'bg-emerald-400/15 text-emerald-400'
                                            : 'bg-amber-400/15 text-amber-400'
                                            }`}>
                                            {engine === 'webcodecs' ? '⚡ GPU' : '🖥 FFmpeg'}
                                        </span>
                                    )}
                                </div>

                                {/* Progress bar */}
                                <div className="w-full space-y-1.5">
                                    <div className="flex justify-between text-xs font-medium text-neutral-300">
                                        <span>Progress</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/8 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full rounded-full bg-white"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ ease: 'linear', duration: 0.1 }}
                                        />
                                    </div>
                                </div>

                                {!isDone && (
                                    <p className="text-[10px] text-neutral-600 text-center">
                                        {getStageLabel()}
                                    </p>
                                )}

                                {!isDone && (
                                    <button
                                        onClick={onCancel}
                                        className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl
                                                   border border-white/8 text-neutral-500 hover:text-rose-300
                                                   hover:border-rose-500/20 text-xs font-medium transition-colors"
                                    >
                                        Cancel Export
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
