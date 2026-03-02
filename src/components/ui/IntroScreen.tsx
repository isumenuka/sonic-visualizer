import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Music, Upload, Zap, Cpu, Code2 } from 'lucide-react';

interface IntroScreenProps {
    onAudioUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const BARS = Array.from({ length: 32 }, (_, i) => i);

export function IntroScreen({ onAudioUpload }: IntroScreenProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            const dt = new DataTransfer();
            dt.items.add(file);
            if (inputRef.current) {
                inputRef.current.files = dt.files;
                inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    };

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 select-none">

            {/* Animated background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse"
                    style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/8 rounded-full blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="relative flex flex-col items-center gap-8 px-6 max-w-lg w-full"
            >
                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-violet-500/30 rounded-2xl blur-xl" />
                        <div className="relative w-16 h-16 rounded-2xl btn-gradient flex items-center justify-center shadow-2xl">
                            <Music className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gradient">SonicWave</h1>
                        <p className="text-sm text-white/40 mt-1 font-medium">Audio Visualizer & Exporter</p>
                    </div>
                </div>

                {/* Animated wave bars */}
                <div className="flex items-end gap-1 h-16">
                    {BARS.map((i) => (
                        <div
                            key={i}
                            className="wave-bar bg-gradient-to-t from-violet-600 to-blue-400 rounded-full"
                            style={{
                                width: '5px',
                                height: `${20 + Math.sin(i * 0.5) * 20 + Math.random() * 20}px`,
                                animationDelay: `${i * 0.05}s`,
                                opacity: 0.4 + Math.sin(i * 0.3) * 0.3,
                            }}
                        />
                    ))}
                </div>

                {/* Drop zone */}
                <label
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="relative group w-full cursor-pointer"
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept="audio/*"
                        onChange={onAudioUpload}
                        className="hidden"
                    />
                    <div className="
            relative overflow-hidden
            w-full rounded-2xl
            glass gradient-border
            p-8 flex flex-col items-center gap-4
            transition-all duration-300
            group-hover:bg-violet-500/10
            group-hover:border-violet-500/30
          ">
                        {/* Shimmer overlay on hover */}
                        <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center
                            group-hover:bg-violet-500/20 group-hover:border-violet-500/30 transition-all duration-300">
                            <Upload className="w-6 h-6 text-white/50 group-hover:text-violet-400 transition-colors duration-300" />
                        </div>

                        <div className="text-center">
                            <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
                                Drop your audio file here
                            </p>
                            <p className="text-xs text-white/30 mt-1">or click to browse — MP3, WAV, AAC, FLAC, OGG</p>
                        </div>

                        <div className="flex items-center gap-2 px-4 py-2 rounded-full btn-gradient text-white text-xs font-semibold shadow-lg">
                            <Music className="w-3.5 h-3.5" />
                            Choose Audio File
                        </div>
                    </div>
                </label>

                {/* Tech badges */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {[
                        { icon: <Cpu className="w-3 h-3" />, label: 'FFmpeg WebAssembly' },
                        { icon: <Code2 className="w-3 h-3" />, label: 'C/C++ Engine' },
                        { icon: <Zap className="w-3 h-3" />, label: 'In-Browser Export' },
                    ].map(({ icon, label }) => (
                        <div
                            key={label}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/8 text-white/35 text-[10px] font-medium"
                        >
                            {icon}
                            {label}
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
