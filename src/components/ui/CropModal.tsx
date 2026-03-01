import React, { useState, useRef, useEffect } from 'react';

export interface CropModalProps {
    src: string;
    onConfirm: (croppedDataUrl: string) => void;
    onCancel: () => void;
}

export function CropModal({ src, onConfirm, onCancel }: CropModalProps) {
    // Crop circle size: responsive — smaller on narrow screens
    const [SIZE, setSIZE] = useState(260);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [imgLoaded, setImgLoaded] = useState(false);

    // Pick a reasonable crop circle diameter based on screen width
    useEffect(() => {
        const update = () => {
            const vw = window.innerWidth;
            // fold/flip: 320px → 200px crop circle; normal mobile: 260; desktop: 300
            if (vw < 360) setSIZE(180);
            else if (vw < 480) setSIZE(220);
            else setSIZE(280);
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    useEffect(() => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            imgRef.current = img;
            setImgLoaded(true);
            const minSide = Math.min(img.naturalWidth, img.naturalHeight);
            setZoom(SIZE / minSide);
            setOffset({ x: 0, y: 0 });
        };
    }, [src, SIZE]);

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(true);
        dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragging) return;
        setOffset({
            x: dragStart.current.ox + (e.clientX - dragStart.current.mx),
            y: dragStart.current.oy + (e.clientY - dragStart.current.my),
        });
    };
    const onMouseUp = () => setDragging(false);

    // Touch support
    const onTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        dragStart.current = { mx: t.clientX, my: t.clientY, ox: offset.x, oy: offset.y };
        setDragging(true);
    };
    const onTouchMove = (e: React.TouchEvent) => {
        if (!dragging) return;
        const t = e.touches[0];
        setOffset({
            x: dragStart.current.ox + (t.clientX - dragStart.current.mx),
            y: dragStart.current.oy + (t.clientY - dragStart.current.my),
        });
    };

    const handleConfirm = () => {
        if (!imgRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        const img = imgRef.current;
        ctx.translate(SIZE / 2 + offset.x, SIZE / 2 + offset.y);
        ctx.scale(zoom, zoom);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        onConfirm(canvas.toDataURL('image/png'));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
            <div className="
                bg-[#0f0f0f] border border-white/10 shadow-2xl
                flex flex-col items-center gap-4 sm:gap-6
                /* Mobile: full-width bottom sheet style */
                w-full rounded-t-3xl rounded-b-none pt-6 pb-8 px-5
                /* Tablet+: card */
                sm:w-auto sm:rounded-2xl sm:p-6
                /* Max width on big screens so it doesn't get too wide */
                sm:max-w-sm md:max-w-[380px]
            ">
                {/* Drag handle (mobile only) */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/20 rounded-full sm:hidden" />

                <div className="text-center space-y-1">
                    <h2 className="text-white font-semibold text-base sm:text-lg tracking-tight">Adjust Profile</h2>
                    <p className="text-neutral-400 text-[10px] sm:text-xs">Drag to reposition · Zoom to resize</p>
                </div>

                {/* Circle crop preview */}
                <div
                    className="relative overflow-hidden rounded-full cursor-grab active:cursor-grabbing select-none shadow-inner bg-black"
                    style={{ width: SIZE, height: SIZE }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onMouseUp}
                >
                    {imgLoaded && (
                        <img
                            src={src}
                            alt="crop"
                            draggable={false}
                            style={{
                                position: 'absolute',
                                width: 'auto',
                                height: 'auto',
                                maxWidth: 'none',
                                left: '50%',
                                top: '50%',
                                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                                transformOrigin: 'center center',
                                pointerEvents: 'none',
                                userSelect: 'none',
                            }}
                        />
                    )}
                    {/* Circular guide ring */}
                    <div className="absolute inset-0 rounded-full ring-2 ring-white/20 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />
                </div>

                {/* Zoom */}
                <div className="w-full space-y-2 sm:space-y-3 max-w-[320px]">
                    <div className="flex justify-between text-[10px] sm:text-xs font-medium text-neutral-400">
                        <span>Zoom</span>
                        <span className="text-white">{Math.round(zoom * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min={0.1}
                        max={5}
                        step={0.01}
                        value={zoom}
                        onChange={e => setZoom(Number(e.target.value))}
                        className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-white"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3 w-full pt-1 sm:pt-2 max-w-[320px]">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-neutral-300 text-xs sm:text-sm font-medium hover:bg-white/5 hover:text-white transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 py-2.5 rounded-xl bg-white text-black text-xs sm:text-sm font-semibold hover:bg-neutral-200 transition-colors shadow-lg"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}
