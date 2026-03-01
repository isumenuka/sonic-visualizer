import React from 'react';

export interface TopBarProps {
    performanceMode: boolean;
    onToggle: () => void;
}

export function TopBar({ performanceMode, onToggle }: TopBarProps) {
    return (
        <div className="fixed top-3 sm:top-4 md:top-6 left-3 sm:left-4 md:left-6 z-50 flex items-center gap-2 sm:gap-3 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 hover:bg-[#0a0a0a]/90 transition-colors shadow-2xl max-w-[calc(100vw-24px)]">
            {/* Text section (hidden on xs) */}
            <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${performanceMode ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-neutral-600'}`} />
                    <label className="text-xs sm:text-sm font-semibold text-white tracking-wide cursor-pointer whitespace-nowrap" onClick={onToggle}>Low-End PC Mode</label>
                </div>
                <p className="text-[10px] text-neutral-400 mt-0.5 ml-4">Lower quality, better performance</p>
            </div>

            {/* Compact version for xs screens */}
            <div className="flex sm:hidden items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${performanceMode ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-neutral-600'}`} />
                <label className="text-xs font-semibold text-white tracking-wide cursor-pointer whitespace-nowrap" onClick={onToggle}>Perf Mode</label>
            </div>

            {/* Toggle switch */}
            <button
                onClick={onToggle}
                className={`shrink-0 w-9 h-5 sm:w-11 sm:h-6 rounded-full relative transition-colors ${performanceMode ? 'bg-orange-500' : 'bg-neutral-800 border border-neutral-600'}`}
            >
                <div className={`absolute top-0.5 sm:top-1 left-0.5 sm:left-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-transform ${performanceMode ? 'bg-white translate-x-4 sm:translate-x-5' : 'bg-neutral-400 translate-x-0'}`} />
            </button>
        </div>
    );
}
