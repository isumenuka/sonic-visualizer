import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, Clock } from 'lucide-react';

interface ExportModalProps {
    isOpen: boolean;
    progress: number;
    timeLeft: number;
    onCancel: () => void;
}

export function ExportModal({ isOpen, progress, timeLeft, onCancel }: ExportModalProps) {
    const formatTime = (seconds: number) => {
        if (seconds < 0 || isNaN(seconds) || !isFinite(seconds)) return 'Calculating...';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black z-40"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-sm bg-neutral-900 border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col items-center"
                    >
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1">Rendering Video</h3>
                        <p className="text-sm font-medium text-neutral-400 mb-6 text-center">
                            Please keep this window focused.<br />Audio is muted during export.
                        </p>

                        <div className="w-full space-y-2 mb-6">
                            <div className="flex justify-between items-center text-sm font-semibold text-white">
                                <span>Progress</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-3 w-full bg-neutral-800 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-white origin-left"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ ease: "linear", duration: 0.1 }}
                                />
                            </div>
                            <div className="flex justify-start items-center gap-1.5 text-xs font-medium text-neutral-500 mt-2">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Time left: {formatTime(timeLeft)}</span>
                            </div>
                        </div>

                        <button
                            onClick={onCancel}
                            className="px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                            <X className="w-4 h-4" /> Cancel Export
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
