import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, Zap } from 'lucide-react';

interface ExportModalProps {
    isOpen: boolean;
    progress: number;
    speed: number; // realtime multiplier, e.g. 4.2 means 4.2x faster than realtime
    onCancel: () => void;
}

export function ExportModal({ isOpen, progress, speed, onCancel }: ExportModalProps) {
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
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 16 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="
                            w-full sm:max-w-sm
                            bg-neutral-900 border border-white/10
                            shadow-2xl flex flex-col items-center
                            /* Mobile: bottom sheet */
                            rounded-t-3xl rounded-b-none pt-8 pb-10 px-6
                            /* Tablet+: card */
                            sm:rounded-3xl sm:p-8
                        "
                    >
                        {/* Mobile drag handle */}
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/20 rounded-full sm:hidden" />

                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 sm:mb-5">
                            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-white animate-spin" />
                        </div>

                        <h3 className="text-lg sm:text-xl font-bold text-white mb-1">Rendering Video</h3>
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

                        <button
                            onClick={onCancel}
                            className="px-5 sm:px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                            <X className="w-4 h-4" /> Cancel Export
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
