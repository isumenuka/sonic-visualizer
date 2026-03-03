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
                            relative overflow-hidden
                        "
                    >
                        {/* Shimmer background effect while exporting */}
                        {!isDone && !error && (
                            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
                        )}

                        {/* Mobile pill */}
                        <div className="w-10 h-1 bg-white/20 rounded-full sm:hidden z-10" />

                        {error ? (
                            /* ── Error State ── */
                            <div className="flex flex-col items-center gap-4 w-full z-10">
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
                            <div className="flex flex-col items-center gap-4 w-full z-10">
                                {isDone ? (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                        className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                                    >
                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </motion.div>
                                ) : (
                                    <div className="relative w-16 h-16 flex items-center justify-center">
                                        <svg className="absolute inset-0 w-full h-full animate-[spin_3s_linear_infinite]" viewBox="0 0 56 56" fill="none">
                                            <circle cx="28" cy="28" r="26" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                                            <circle cx="28" cy="28" r="26" stroke="url(#spinnerGrad)" strokeWidth="2" strokeLinecap="round" strokeDasharray="163" strokeDashoffset="80" />
                                            <defs>
                                                <linearGradient id="spinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor="#fff" />
                                                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                                                </linearGradient>
                                            </defs>
                                        </svg>
                                        <span className="text-sm font-bold text-white tabular-nums">{Math.round(progress)}%</span>
                                    </div>
                                )}

                                <div className="text-center">
                                    <h3 className="text-lg font-bold text-white tracking-tight">
                                        {isDone ? 'Export Complete' : 'Rendering Video'}
                                    </h3>
                                    <p className="text-xs text-neutral-400 mt-1">
                                        {isDone
                                            ? `Your high-quality MP4 is being saved.`
                                            : speedLabel}
                                    </p>
                                    {/* Engine badge */}
                                    {!isDone && (
                                        <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-inner ${engine === 'webcodecs'
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                            }`}>
                                            {engine === 'webcodecs' ? '⚡ GPU Engine' : '🖥 FFmpeg Engine'}
                                        </span>
                                    )}
                                </div>

                                {/* Rich Animated Progress Bar */}
                                <div className="w-full space-y-2 mt-2">
                                    <div className="flex justify-between text-[11px] font-semibold tracking-wide uppercase text-neutral-400">
                                        <span>Progress</span>
                                        <span className="text-white">{Math.round(progress)}%</span>
                                    </div>
                                    <div className="relative h-3 w-full bg-black/40 border border-white/5 rounded-full overflow-hidden shadow-inner">
                                        <motion.div
                                            className="absolute top-0 left-0 bottom-0 bg-white rounded-full transition-shadow"
                                            style={{
                                                boxShadow: '0 0 10px rgba(255,255,255,0.5), inset 0 0 5px rgba(255,255,255,0.8)'
                                            }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ ease: 'easeOut', duration: 0.2 }}
                                        />
                                        {/* Glint effect running across the bar */}
                                        {!isDone && (
                                            <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden rounded-full z-10">
                                                <div className="w-[40%] h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] animate-[shimmer_2s_infinite]" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {!isDone && (
                                    <p className="text-[11px] font-medium text-neutral-500 text-center uppercase tracking-wide">
                                        {getStageLabel()}
                                    </p>
                                )}

                                {!isDone && (
                                    <button
                                        onClick={onCancel}
                                        className="w-full mt-2 flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                                                   bg-white/5 border border-white/10 hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400
                                                   hover:border-rose-500/30 text-xs font-bold uppercase tracking-wider transition-all"
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
