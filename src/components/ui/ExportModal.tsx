import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, Zap } from 'lucide-react';

interface ExportModalProps {
    isOpen: boolean;
    progress: number;
    speed: number; // realtime multiplier, e.g. 4.2 means 4.2x faster than realtime
    error?: string | null;
    onCancel: () => void;
}

export function ExportModal({ isOpen, progress, speed, error, onCancel }: ExportModalProps) {
    const speedLabel = speed > 0.5
        ? `⚡ ${speed.toFixed(1)}× realtime`
        : 'Initialising encoder…';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/90 flex items-end sm:items-center justify-center p-0 sm:p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 sm:p-8 w-[90%] max-w-sm flex flex-col items-center shadow-2xl overflow-y-auto max-h-[90vh]"
                    >
                        {error ? (
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 rounded-full border border-red-500/30 flex items-center justify-center mb-4 text-red-500">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2 text-center">Export Failed</h2>
                                <div className="text-red-400 text-sm mb-6 text-center max-h-32 overflow-y-auto whitespace-pre-wrap px-2 w-full custom-scrollbar">
                                    {error}
                                </div>
                                <button
                                    onClick={onCancel}
                                    className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Spinner */}
                                <div className="relative mb-6">
                                    <svg className="w-12 h-12 text-white/10 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                    {progress === 100 && (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 flex items-center justify-center text-teal-400">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Title & Status */}
                                <h2 className="text-xl font-bold text-white mb-1">
                                    {progress === 100 ? 'Export Complete' : 'Rendering Video'}
                                </h2>
                                <p className="text-xs sm:text-sm font-medium text-neutral-400 mb-1 text-center">
                                    GPU-accelerated offline render
                                </p>

                                {/* Speed badge */}
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full mb-5 sm:mb-6">
                                    <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    <span>{speedLabel}</span>
                                </div>

                                <div className="w-full space-y-2 mb-5 sm:mb-6">
                                    <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-white">
                                        <span>Progress</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-2.5 sm:h-3 w-full bg-neutral-800 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-white origin-left"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ ease: 'linear', duration: 0.1 }}
                                        />
                                    </div>
                                </div>

                                {/* Cancel Button */}
                                {progress < 100 && (
                                    <button
                                        onClick={onCancel}
                                        className="mt-8 flex items-center justify-center gap-2 px-6 py-2 rounded-full bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 text-sm font-medium transition-colors w-full group"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                        Cancel Export
                                    </button>
                                )}
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
