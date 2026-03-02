/**
 * Live Record Engine
 * ─────────────────
 * Records the canvas + audio in real-time using MediaRecorder API.
 * Much simpler than the export engines — just captures whatever is
 * currently rendered as the song plays back.
 *
 * Output: WebM (VP9 + Opus) — compatible with YouTube, Discord, etc.
 */

export interface LiveRecordOptions {
    canvas: HTMLCanvasElement;
    audioElement: HTMLAudioElement;
    audioContext: AudioContext;
    fps?: number;
    onStop?: (blob: Blob) => void;
}

export class LiveRecorder {
    private recorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private audioDestNode: MediaStreamAudioDestinationNode | null = null;
    private audioCtx: AudioContext;
    private audioElement: HTMLAudioElement;
    private canvas: HTMLCanvasElement;
    private fps: number;
    private onStop?: (blob: Blob) => void;

    constructor(options: LiveRecordOptions) {
        this.canvas = options.canvas;
        this.audioElement = options.audioElement;
        this.audioCtx = options.audioContext;
        this.fps = options.fps ?? 30;
        this.onStop = options.onStop;
    }

    /** Returns true if MediaRecorder is supported in this browser */
    static isSupported(): boolean {
        return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
    }

    /** Returns the best supported MIME type for recording */
    static getMimeType(): string {
        const candidates = [
            // MP4 first — H.264+AAC, natively plays everywhere
            'video/mp4;codecs=avc1,mp4a.40.2',  // Chrome Windows, Safari
            'video/mp4;codecs=avc1',
            'video/mp4',
            // WebM fallback (Firefox, older Chrome on Linux/Mac)
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
        ];
        for (const type of candidates) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return '';
    }

    start(): void {
        if (this.recorder?.state === 'recording') return;

        this.chunks = [];

        // 1. Capture canvas frames
        const videoStream = this.canvas.captureStream(this.fps);

        // 2. Capture audio through AudioContext MediaStreamDestination node
        //    (this taps into the same audio graph that drives the analyser,
        //     so the recording is always perfectly synced with the visualizer)
        this.audioDestNode = this.audioCtx.createMediaStreamDestination();

        // Connect the audio source → the recording destination
        // We do this from the audio element via captureStream for reliability
        let audioTracks: MediaStreamTrack[] = [];
        try {
            // Try HTML5 captureStream first (works in Chrome/Edge/Firefox)
            const elStream = (this.audioElement as any).captureStream?.() as MediaStream | undefined;
            if (elStream) {
                audioTracks = elStream.getAudioTracks();
            }
        } catch { }

        // Combine video + audio into one stream
        const tracks = [...videoStream.getVideoTracks(), ...audioTracks];
        this.stream = new MediaStream(tracks);

        const mimeType = LiveRecorder.getMimeType();
        const recorderOptions: MediaRecorderOptions = {};
        if (mimeType) recorderOptions.mimeType = mimeType;
        // Auto-scale bitrate to canvas resolution
        // ~0.14 bits/pixel/frame → 1080p@30fps ≈ 8 Mbps, 2K ≈ 15 Mbps, 4K ≈ 35 Mbps
        const pixels = this.canvas.width * this.canvas.height;
        recorderOptions.videoBitsPerSecond = Math.min(
            Math.round(pixels * this.fps * 0.14),
            40_000_000 // 40 Mbps cap for 4K
        );

        this.recorder = new MediaRecorder(this.stream, recorderOptions);

        this.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data);
        };

        this.recorder.onstop = () => {
            const mimeType = this.recorder?.mimeType || 'video/webm';
            const blob = new Blob(this.chunks, { type: mimeType });
            this.chunks = [];
            this.stream?.getTracks().forEach(t => t.stop());
            this.stream = null;
            this.onStop?.(blob);
        };

        // Collect a chunk every second so data is available even on stop
        this.recorder.start(1000);
    }

    stop(): void {
        if (this.recorder && this.recorder.state !== 'inactive') {
            this.recorder.stop();
        }
    }

    get isRecording(): boolean {
        return this.recorder?.state === 'recording';
    }
}

/** Download a Blob as a video file */
export function downloadRecording(blob: Blob, fileName = 'sonic-visualizer-live'): void {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
