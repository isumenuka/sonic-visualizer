import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, User, Settings, RotateCcw, Palette, Wand2, Sliders } from 'lucide-react';
import { VisualizerSettings } from '../../types';

export interface SettingsPanelProps {
    showControls: boolean;
    onClose: () => void;
    bgImage: string | null;
    settings: VisualizerSettings;
    setSettings: React.Dispatch<React.SetStateAction<VisualizerSettings>>;
}

type TabType = 'visuals' | 'center' | 'effects' | 'tuning';

export function SettingsPanel({
    showControls,
    onClose,
    bgImage,
    settings,
    setSettings
}: SettingsPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('visuals');

    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'visuals', label: 'Visuals', icon: <Palette className="w-4 h-4 mb-1" /> },
        { id: 'center', label: 'Center', icon: <User className="w-4 h-4 mb-1" /> },
        { id: 'effects', label: 'Effects', icon: <Wand2 className="w-4 h-4 mb-1" /> },
        { id: 'tuning', label: 'Tuning', icon: <Sliders className="w-4 h-4 mb-1" /> },
    ];

    const renderToggle = (label: string, description: string, value: boolean, onChange: () => void, isDanger?: boolean) => (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
            <div>
                <label className={`text-sm font-medium ${isDanger ? 'text-rose-400' : 'text-neutral-200'}`}>{label}</label>
                <p className="text-[10px] text-neutral-500 mt-0.5">{description}</p>
            </div>
            <button
                onClick={onChange}
                className={`shrink-0 w-12 h-7 rounded-full relative transition-colors ${value ? (isDanger ? 'bg-rose-500' : 'bg-white') : 'bg-neutral-800'}`}
            >
                <div className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-transform ${value ? (isDanger ? 'bg-white translate-x-5' : 'bg-black translate-x-5') : 'bg-white translate-x-0 shadow-sm'}`} />
            </button>
        </div>
    );

    return (
        <AnimatePresence>
            {showControls && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed right-8 bottom-32 h-[550px] max-h-[calc(100vh-160px)] z-30 w-[380px] bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col"
                >
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10 shrink-0">
                        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            <Settings className="w-5 h-5 text-neutral-400" />
                            Appearance
                        </h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex bg-neutral-900/80 p-1 rounded-2xl border border-white/5 shadow-inner mb-6 shrink-0">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-3 text-[11px] rounded-xl font-medium transition-all flex flex-col items-center justify-center ${activeTab === tab.id ? 'bg-white text-black shadow-sm' : 'bg-transparent text-neutral-500 hover:text-neutral-300'}`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.15 }}
                                className="space-y-6"
                            >

                                {/* VISUALS TAB */}
                                {activeTab === 'visuals' && (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Style</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['bars', 'wave', 'spiral', 'particles', 'ring', 'strings', 'orbit', 'spikes', 'laser', 'nebula', 'aura', 'peaks'].map((type) => (
                                                    <button
                                                        key={type}
                                                        onClick={() => setSettings(s => ({ ...s, type: type as any }))}
                                                        className={`p-3 text-sm rounded-2xl font-medium transition-all border capitalize ${settings.type === type ? 'bg-white text-black border-transparent shadow-sm' : 'bg-white/5 text-neutral-300 border-white/5 hover:bg-white/10 hover:border-white/20'}`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Color Palette</label>
                                            <div className="flex gap-3">
                                                <div className="flex-1 flex flex-col gap-2">
                                                    <input
                                                        type="color"
                                                        value={settings.primaryColor}
                                                        onChange={(e) => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                                                        className="h-12 w-full rounded-[14px] cursor-pointer bg-transparent border border-white/10 p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-[10px]"
                                                    />
                                                    <label className="text-xs text-center text-neutral-400 font-medium">Primary</label>
                                                </div>
                                                <div className="flex-1 flex flex-col gap-2">
                                                    <input
                                                        type="color"
                                                        value={settings.secondaryColor}
                                                        onChange={(e) => setSettings(s => ({ ...s, secondaryColor: e.target.value }))}
                                                        className="h-12 w-full rounded-[14px] cursor-pointer bg-transparent border border-white/10 p-1 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-[10px]"
                                                    />
                                                    <label className="text-xs text-center text-neutral-400 font-medium">Secondary</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* CENTER TAB */}
                                {activeTab === 'center' && (
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Center Mode</label>
                                            <div className="flex gap-2 bg-neutral-900/50 p-1 rounded-2xl border border-white/5 shadow-inner">
                                                <button
                                                    onClick={() => setSettings(s => ({ ...s, centerMode: 'text' }))}
                                                    className={`flex-1 py-3 text-sm rounded-xl font-medium transition-all ${settings.centerMode === 'text' ? 'bg-white text-black shadow-sm' : 'bg-transparent text-neutral-400 hover:text-white'}`}
                                                >
                                                    Text
                                                </button>
                                                <button
                                                    onClick={() => setSettings(s => ({ ...s, centerMode: 'profile' }))}
                                                    className={`flex-1 py-3 text-sm rounded-xl font-medium transition-all ${settings.centerMode === 'profile' ? 'bg-white text-black shadow-sm' : 'bg-transparent text-neutral-400 hover:text-white'}`}
                                                >
                                                    Profile
                                                </button>
                                            </div>
                                        </div>

                                        {settings.centerMode === 'text' && (
                                            <div className="space-y-3">
                                                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Content</label>
                                                <input
                                                    type="text"
                                                    value={settings.centerText}
                                                    onChange={(e) => setSettings(s => ({ ...s, centerText: e.target.value }))}
                                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm font-medium text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all shadow-inner placeholder:text-neutral-600"
                                                    placeholder="Enter center text..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* EFFECTS TAB */}
                                {activeTab === 'effects' && (
                                    <div className="space-y-2">
                                        {renderToggle("Particles Overlay", "Floating background dust", settings.bgParticlesEnabled, () => setSettings(s => ({ ...s, bgParticlesEnabled: !s.bgParticlesEnabled })))}
                                        {renderToggle("Mirror Spectrum", "Reflects the frequency graph horizontally", settings.mirror, () => setSettings(s => ({ ...s, mirror: !s.mirror })))}
                                        {renderToggle("Beat Pulse", "Scale reacts to sub-bass peaks", settings.pulseEnabled, () => setSettings(s => ({ ...s, pulseEnabled: !s.pulseEnabled })))}
                                        {renderToggle("Glow", "Adds bloom light to visualizer", settings.glowEnabled, () => setSettings(s => ({ ...s, glowEnabled: !s.glowEnabled })))}
                                        {renderToggle("Trail", "Leaves fading ghost traces", settings.trailEnabled, () => setSettings(s => ({ ...s, trailEnabled: !s.trailEnabled })))}
                                        {renderToggle("Color Cycle", "Auto-cycles hue over time", settings.colorCycle, () => setSettings(s => ({ ...s, colorCycle: !s.colorCycle })))}
                                        {renderToggle("Camera Shake", "Screen trembles on heavy bass drops", settings.shakeEnabled, () => setSettings(s => ({ ...s, shakeEnabled: !s.shakeEnabled })))}
                                        {renderToggle("Ghost Echo", "Draws expanding translucent layers", settings.echoEnabled, () => setSettings(s => ({ ...s, echoEnabled: !s.echoEnabled })))}
                                        {renderToggle("Invert Colors", "Flips canvas colors to negative mode", settings.invertColors, () => setSettings(s => ({ ...s, invertColors: !s.invertColors })), true)}
                                    </div>
                                )}

                                {/* TUNING TAB */}
                                {activeTab === 'tuning' && (
                                    <div className="space-y-8">
                                        {bgImage && (
                                            <div className="space-y-6">
                                                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                                                    <ImageIcon className="w-3.5 h-3.5" /> Background
                                                </h3>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center text-xs font-medium">
                                                        <label className="text-neutral-300">Blur</label>
                                                        <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">{settings.bgBlur}px</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="50"
                                                        value={settings.bgBlur}
                                                        onChange={(e) => setSettings(s => ({ ...s, bgBlur: Number(e.target.value) }))}
                                                        className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center text-xs font-medium">
                                                        <label className="text-neutral-300">Opacity</label>
                                                        <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">{Math.round(settings.bgOpacity * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        value={settings.bgOpacity}
                                                        onChange={(e) => setSettings(s => ({ ...s, bgOpacity: Number(e.target.value) }))}
                                                        className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-6">
                                            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Engine</h3>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-xs font-medium">
                                                    <label className="text-neutral-300">Rotation Speed</label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">{settings.rotationSpeed}</span>
                                                        <button
                                                            onClick={() => setSettings(s => ({ ...s, rotationSpeed: 0 }))}
                                                            className="text-neutral-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                                                            title="Reset to default (0)"
                                                        >
                                                            <RotateCcw className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="-5"
                                                    max="5"
                                                    step="0.1"
                                                    value={settings.rotationSpeed}
                                                    onChange={(e) => setSettings(s => ({ ...s, rotationSpeed: Number(e.target.value) }))}
                                                    className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-xs font-medium">
                                                    <label className="text-neutral-300">Visualize Radius</label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">{settings.radius}px</span>
                                                        <button
                                                            onClick={() => setSettings(s => ({ ...s, radius: 150 }))}
                                                            className="text-neutral-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                                                            title="Reset to default (150)"
                                                        >
                                                            <RotateCcw className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="50"
                                                    max="300"
                                                    value={settings.radius}
                                                    onChange={(e) => setSettings(s => ({ ...s, radius: Number(e.target.value) }))}
                                                    className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-xs font-medium">
                                                    <label className="text-neutral-300">Audio Sensitivity</label>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">{settings.sensitivity}x</span>
                                                        <button
                                                            onClick={() => setSettings(s => ({ ...s, sensitivity: 1.5 }))}
                                                            className="text-neutral-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                                                            title="Reset to default (1.5x)"
                                                        >
                                                            <RotateCcw className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.5"
                                                    max="3"
                                                    step="0.1"
                                                    value={settings.sensitivity}
                                                    onChange={(e) => setSettings(s => ({ ...s, sensitivity: Number(e.target.value) }))}
                                                    className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </motion.div>
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
