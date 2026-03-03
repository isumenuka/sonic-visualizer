import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Settings, RotateCcw, Palette, Wand2, Sliders, User, ChevronDown } from 'lucide-react';
import { VisualizerSettings } from '../../types';

export interface SettingsPanelProps {
    showControls: boolean;
    onClose: () => void;
    bgImage: string | null;
    settings: VisualizerSettings;
    setSettings: React.Dispatch<React.SetStateAction<VisualizerSettings>>;
}

type TabType = 'visuals' | 'center' | 'effects' | 'tuning';

// ── Accordion section ──────────────────────────────────────────────────────────
function AccordionSection({ title, children, defaultOpen = false }: {
    title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border border-white/8 overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
            >
                <span className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wider">{title}</span>
                <ChevronDown
                    className="w-3 h-3 text-neutral-400 transition-transform duration-200"
                    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                    >
                        <div className="p-2">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function SettingsPanel({ showControls, onClose, bgImage, settings, setSettings }: SettingsPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('visuals');

    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'visuals', label: 'Visuals', icon: <Palette className="w-3.5 h-3.5 mb-0.5" /> },
        { id: 'center', label: 'Center', icon: <User className="w-3.5 h-3.5 mb-0.5" /> },
        { id: 'effects', label: 'Effects', icon: <Wand2 className="w-3.5 h-3.5 mb-0.5" /> },
        { id: 'tuning', label: 'Tuning', icon: <Sliders className="w-3.5 h-3.5 mb-0.5" /> },
    ];

    const renderToggle = (label: string, desc: string, value: boolean, onChange: () => void, isDanger?: boolean) => (
        <div className="flex items-center justify-between py-2 px-1 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg transition-colors">
            <div className="flex-1 min-w-0 pr-2">
                <div className={`text-xs font-medium ${isDanger ? 'text-rose-400' : 'text-neutral-200'}`}>{label}</div>
                <div className="text-[9px] text-neutral-500 mt-0.5 leading-tight">{desc}</div>
            </div>
            <button onClick={onChange}
                className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${value ? (isDanger ? 'bg-rose-500' : 'bg-white') : 'bg-neutral-700'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${value ? (isDanger ? 'bg-white translate-x-4' : 'bg-black translate-x-4') : 'bg-neutral-400 translate-x-0'}`} />
            </button>
        </div>
    );

    const renderStyleGrid = (types: string[]) => (
        <div className="grid grid-cols-3 gap-1">
            {types.map(type => (
                <button key={type}
                    onClick={() => setSettings(s => ({ ...s, type: type as any }))}
                    className={`py-2 text-[10px] rounded-lg font-medium transition-all border capitalize ${settings.type === type
                        ? 'bg-white text-black border-transparent'
                        : 'bg-white/5 text-neutral-300 border-white/5 hover:bg-white/10'}`}>
                    {type}
                </button>
            ))}
        </div>
    );

    // ── Visual categories ──────────────────────────────────────────────────────
    const visualCategories = [
        { label: '〰 Wave & Line', types: ['bars', 'wave', 'ring', 'waveform', 'strings'], open: true },
        { label: '✦ Particle & Space', types: ['particles', 'nebula', 'constellation', 'orbit'], open: false },
        { label: '◈ Geometric', types: ['spiral', 'spikes', 'diamond', 'fractal', 'prism', 'tunnel'], open: false },
        { label: '⚡ Energy', types: ['laser', 'lightning', 'aura', 'peaks', 'helix', 'frequency'], open: false },
    ];

    // ── Effect categories ──────────────────────────────────────────────────────
    type EffectToggle = [string, string, boolean, () => void, boolean?];
    const effectCategories: { label: string; open: boolean; effects: EffectToggle[] }[] = [
        {
            label: '🥁 Beat Reactive', open: true, effects: [
                ['Beat Pulse', 'Scale reacts to bass', settings.pulseEnabled, () => setSettings(s => ({ ...s, pulseEnabled: !s.pulseEnabled }))],
                ['Camera Shake', 'Screen trembles on heavy bass', settings.shakeEnabled, () => setSettings(s => ({ ...s, shakeEnabled: !s.shakeEnabled }))],
                ['Starburst', 'Light rays from center on mids', settings.starburstEnabled, () => setSettings(s => ({ ...s, starburstEnabled: !s.starburstEnabled }))],
                ['Strobe', 'White flash on heavy bass', settings.strobeEnabled, () => setSettings(s => ({ ...s, strobeEnabled: !s.strobeEnabled }))],
                ['Ripple', 'Expanding rings from center', settings.rippleEnabled, () => setSettings(s => ({ ...s, rippleEnabled: !s.rippleEnabled }))],
            ],
        },
        {
            label: '✨ Visual FX', open: false, effects: [
                ['Glow', 'Bloom light on visualizer', settings.glowEnabled, () => setSettings(s => ({ ...s, glowEnabled: !s.glowEnabled }))],
                ['Trail', 'Fading ghost traces', settings.trailEnabled, () => setSettings(s => ({ ...s, trailEnabled: !s.trailEnabled }))],
                ['Color Cycle', 'Auto-cycles hue over time', settings.colorCycle, () => setSettings(s => ({ ...s, colorCycle: !s.colorCycle }))],
                ['Chromatic Aberration', 'RGB channel split on mids', settings.chromaticEnabled, () => setSettings(s => ({ ...s, chromaticEnabled: !s.chromaticEnabled }))],
                ['Vignette', 'Dark pulsing edges on bass', settings.vignetteEnabled, () => setSettings(s => ({ ...s, vignetteEnabled: !s.vignetteEnabled }))],
                ['Scanlines', 'CRT scanline overlay', settings.scanlineEnabled, () => setSettings(s => ({ ...s, scanlineEnabled: !s.scanlineEnabled }))],
                ['Pixelate', 'Block pixels react to audio', settings.pixelateEnabled, () => setSettings(s => ({ ...s, pixelateEnabled: !s.pixelateEnabled }))],
            ],
        },
        {
            label: '🔮 Transform', open: false, effects: [
                ['Mirror Spectrum', 'Reflects frequency horizontally', settings.mirror, () => setSettings(s => ({ ...s, mirror: !s.mirror }))],
                ['Ghost Echo', 'Expanding translucent layers', settings.echoEnabled, () => setSettings(s => ({ ...s, echoEnabled: !s.echoEnabled }))],
                ['Kaleidoscope', 'Mirror slices into kaleidoscope', settings.kaleidoscopeEnabled, () => setSettings(s => ({ ...s, kaleidoscopeEnabled: !s.kaleidoscopeEnabled }))],
                ['Particles Overlay', 'Floating background dust', settings.bgParticlesEnabled, () => setSettings(s => ({ ...s, bgParticlesEnabled: !s.bgParticlesEnabled }))],
            ],
        },
        {
            label: '⚠ Danger Zone', open: false, effects: [
                ['Invert Colors', 'Negative mode', settings.invertColors, () => setSettings(s => ({ ...s, invertColors: !s.invertColors })), true],
            ],
        },
    ];

    return (
        <AnimatePresence>
            {showControls && (
                <motion.div
                    key="settings-sidebar"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full flex flex-col bg-[#0a0a0a] overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            <Settings className="w-4 h-4 text-neutral-400" />
                            Appearance
                        </h2>
                        <button onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-neutral-900/80 mx-3 mt-3 p-0.5 rounded-xl border border-white/5 shrink-0">
                        {tabs.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-1.5 text-[9px] rounded-lg font-medium transition-all flex flex-col items-center justify-center ${activeTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                        <AnimatePresence mode="wait">
                            <motion.div key={activeTab}
                                initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.12 }}
                                className="space-y-2">

                                {/* ── VISUALS ── */}
                                {activeTab === 'visuals' && (
                                    <div className="space-y-2">
                                        {/* Style accordion categories */}
                                        {visualCategories.map(cat => (
                                            <AccordionSection key={cat.label} title={cat.label} defaultOpen={cat.open}>
                                                {renderStyleGrid(cat.types)}
                                            </AccordionSection>
                                        ))}

                                        {/* Color palette */}
                                        <AccordionSection title="🎨 Color Palette" defaultOpen={true}>
                                            <div className="flex gap-2">
                                                <div className="flex-1 space-y-1">
                                                    <input type="color" value={settings.primaryColor}
                                                        onChange={e => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                                                        className="h-9 w-full rounded-xl cursor-pointer bg-transparent border border-white/10 p-0.5 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                                                    <div className="text-[9px] text-center text-neutral-400">Primary</div>
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <input type="color" value={settings.secondaryColor}
                                                        onChange={e => setSettings(s => ({ ...s, secondaryColor: e.target.value }))}
                                                        className="h-9 w-full rounded-xl cursor-pointer bg-transparent border border-white/10 p-0.5 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                                                    <div className="text-[9px] text-center text-neutral-400">Secondary</div>
                                                </div>
                                            </div>
                                        </AccordionSection>
                                    </div>
                                )}

                                {/* ── CENTER ── */}
                                {activeTab === 'center' && (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider block">Center Mode</label>
                                            <div className="flex gap-1 bg-neutral-900/60 p-0.5 rounded-xl border border-white/5">
                                                {['text', 'profile'].map(m => (
                                                    <button key={m} onClick={() => setSettings(s => ({ ...s, centerMode: m as any }))}
                                                        className={`flex-1 py-2 text-xs rounded-lg font-medium transition-all capitalize ${settings.centerMode === m ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}>
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {settings.centerMode === 'text' && (
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider block">Text</label>
                                                <input type="text" value={settings.centerText}
                                                    onChange={e => setSettings(s => ({ ...s, centerText: e.target.value }))}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white transition-all placeholder:text-neutral-600"
                                                    placeholder="Enter center text..." />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── EFFECTS ── */}
                                {activeTab === 'effects' && (
                                    <div className="space-y-2">
                                        {effectCategories.map(cat => (
                                            <AccordionSection key={cat.label} title={cat.label} defaultOpen={cat.open}>
                                                <div>
                                                    {cat.effects.map(([label, desc, value, onChange, isDanger]) =>
                                                        renderToggle(label as string, desc as string, value as boolean, onChange as () => void, isDanger as boolean | undefined)
                                                    )}
                                                </div>
                                            </AccordionSection>
                                        ))}
                                    </div>
                                )}

                                {/* ── TUNING ── */}
                                {activeTab === 'tuning' && (
                                    <div className="space-y-5">
                                        {bgImage && (
                                            <AccordionSection title="🖼 Background" defaultOpen={true}>
                                                {[
                                                    { label: 'Blur', key: 'bgBlur', min: 0, max: 50, step: 1, unit: 'px' },
                                                    { label: 'Opacity', key: 'bgOpacity', min: 0, max: 1, step: 0.05, unit: '%', display: (v: number) => Math.round(v * 100) + '%' },
                                                ].map(({ label, key, min, max, step, unit, display }) => (
                                                    <div key={key} className="space-y-1 mb-2">
                                                        <div className="flex justify-between text-[9px] font-medium">
                                                            <span className="text-neutral-300">{label}</span>
                                                            <span className="text-white bg-white/10 px-1.5 py-0.5 rounded">
                                                                {display ? display((settings as any)[key]) : `${(settings as any)[key]}${unit}`}
                                                            </span>
                                                        </div>
                                                        <input type="range" min={min} max={max} step={step} value={(settings as any)[key]}
                                                            onChange={e => setSettings(s => ({ ...s, [key]: Number(e.target.value) }))}
                                                            className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white" />
                                                    </div>
                                                ))}
                                            </AccordionSection>
                                        )}

                                        <AccordionSection title="⚙ Engine" defaultOpen={true}>
                                            {[
                                                { label: 'Rotation Speed', key: 'rotationSpeed', min: -5, max: 5, step: 0.1, def: 0, unit: '' },
                                                { label: 'Radius', key: 'radius', min: 50, max: 300, step: 1, def: 150, unit: 'px' },
                                                { label: 'Sensitivity', key: 'sensitivity', min: 0.5, max: 3, step: 0.1, def: 1.5, unit: 'x' },
                                            ].map(({ label, key, min, max, step, def, unit }) => (
                                                <div key={key} className="space-y-1 mb-2">
                                                    <div className="flex justify-between items-center text-[9px] font-medium">
                                                        <span className="text-neutral-300">{label}</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-white bg-white/10 px-1.5 py-0.5 rounded">{(settings as any)[key]}{unit}</span>
                                                            <button onClick={() => setSettings(s => ({ ...s, [key]: def }))}
                                                                className="text-neutral-600 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors">
                                                                <RotateCcw className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <input type="range" min={min} max={max} step={step} value={(settings as any)[key]}
                                                        onChange={e => setSettings(s => ({ ...s, [key]: Number(e.target.value) }))}
                                                        className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white" />
                                                </div>
                                            ))}
                                        </AccordionSection>
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
