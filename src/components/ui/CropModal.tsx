import React, { useState, useRef, useEffect } from 'react';

export interface CropModalProps {
    src: string;
    onConfirm: (croppedDataUrl: string) => void;
    onCancel: () => void;
}

export function CropModal({ src, onConfirm, onCancel }: CropModalProps) {
    const SIZE = 300; // diameter of crop circle in px
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [imgLoaded, setImgLoaded] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            imgRef.current = img;
            setImgLoaded(true);
            // default zoom: fit the shorter side to the circle
            const minSide = Math.min(img.naturalWidth, img.naturalHeight);
            setZoom(SIZE / minSide);
            setOffset({ x: 0, y: 0 });
        };
    }, [src]);

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
        // clip to circle
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        const img = imgRef.current;
        // Match the CSS transform: translate to center + offset, then scale, draw at natural size
        ctx.translate(SIZE / 2 + offset.x, SIZE / 2 + offset.y);
        ctx.scale(zoom, zoom);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        onConfirm(canvas.toDataURL('image/png'));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-6 shadow-2xl w-[380px]">
                <div className="text-center space-y-1">
                    <h2 className="text-white font-semibold text-lg tracking-tight">Adjust Profile</h2>
                    <p className="text-neutral-400 text-xs">Drag to reposition · Zoom to resize</p>
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
                                // Keep natural size — zoom via CSS transform only (no stretching)
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
                <div className="w-full space-y-3">
                    <div className="flex justify-between text-xs font-medium text-neutral-400">
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
                <div className="flex gap-3 w-full pt-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-neutral-300 text-sm font-medium hover:bg-white/5 hover:text-white transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors shadow-lg"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}
