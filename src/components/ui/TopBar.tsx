import React from 'react';

export interface TopBarProps {
    performanceMode: boolean;
    onToggle: () => void;
}

export function TopBar({ performanceMode, onToggle }: TopBarProps) {
    return (
        <div className="fixed top-6 left-6 z-50 flex items-center gap-3 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2 hover:bg-[#0a0a0a]/90 transition-colors shadow-2xl">
            <div>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${performanceMode ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 'bg-neutral-600'}`} />
                    <label className="text-sm font-semibold text-white tracking-wide cursor-pointer" onClick={onToggle}>Low-End PC Mode</label>
                </div>
                <p className="text-[10px] text-neutral-400 mt-0.5 ml-4">Lower quality, better performance</p>
            </div>
            <button
                onClick={onToggle}
                className={`ml-2 shrink-0 w-11 h-6 rounded-full relative transition-colors ${performanceMode ? 'bg-orange-500' : 'bg-neutral-800 border border-neutral-600'}`}
            >
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${performanceMode ? 'bg-white translate-x-5' : 'bg-neutral-400 translate-x-0'}`} />
            </button>
        </div>
    );
}
