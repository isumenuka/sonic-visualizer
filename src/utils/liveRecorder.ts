import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface LiveRecordOptions {
    canvas: HTMLCanvasElement;
    audioElement: HTMLAudioElement;
    audioContext: AudioContext;
    audioSourceNode?: MediaElementAudioSourceNode;
    fps?: number;
    onStop?: (blob: Blob) => void;
}

// AudioEncoder only supports these sample rates — clamp to nearest supported value
const SUPPORTED_SAMPLE_RATES = [8000, 16000, 22050, 44100, 48000];
function clampSampleRate(rate: number): number {
    return SUPPORTED_SAMPLE_RATES.reduce((best, r) =>
        Math.abs(r - rate) < Math.abs(best - rate) ? r : best
    );
}

export class LiveRecorder {
    private canvas: HTMLCanvasElement;
    private audioElement: HTMLAudioElement;
    private audioCtx: AudioContext;
    private audioSourceNode?: MediaElementAudioSourceNode;
    private fps: number;
    private onStop?: (blob: Blob) => void;

    private muxer: any = null;
    private videoEncoder: VideoEncoder | null = null;
    private audioEncoder: AudioEncoder | null = null;
    private audioEncoderReady: boolean = false;
    private _isRecording: boolean = false;
    private startTime: number = 0;
    private lastFrameTime: number = 0;
    private frameHandle: number = 0;

    private audioDestNode: MediaStreamAudioDestinationNode | null = null;
    private trackReader: ReadableStreamDefaultReader<any> | null = null;

    constructor(options: LiveRecordOptions) {
        this.canvas = options.canvas;
        this.audioElement = options.audioElement;
        this.audioCtx = options.audioContext;
        this.audioSourceNode = options.audioSourceNode;
        this.fps = options.fps ?? 30;
        this.onStop = options.onStop;
    }

    static isSupported(): boolean {
        return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined';
    }

    async start(): Promise<void> {
        if (this._isRecording) return;
        this._isRecording = true;

        const target = new ArrayBufferTarget();
        const encWidth = this.canvas.width % 2 === 0 ? this.canvas.width : this.canvas.width - 1;
        const encHeight = this.canvas.height % 2 === 0 ? this.canvas.height : this.canvas.height - 1;
        // Clamp to a sample rate the AudioEncoder actually supports
        const sampleRate = clampSampleRate(this.audioCtx.sampleRate);

        this.muxer = new Muxer({
            target,
            video: { codec: 'avc', width: encWidth, height: encHeight },
            audio: { codec: 'aac', sampleRate, numberOfChannels: 2 },
            firstTimestampBehavior: 'offset',
            fastStart: 'in-memory',
        });

        this.videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                // mp4-muxer requires colorSpace in the decoder config metadata.
                // Canvas frames don't always emit it, so we inject standard sRGB values.
                if (meta?.decoderConfig && !meta.decoderConfig.colorSpace) {
                    (meta.decoderConfig as any).colorSpace = {
                        primaries: 'bt709',
                        transfer: 'bt709',
                        matrix: 'bt709',
                        fullRange: false,
                    };
                }
                this.muxer.addVideoChunk(chunk, meta);
            },
            error: (e) => console.error('VideoEncoder error:', e),
        });
        const bitrate = encWidth * encHeight * this.fps * 0.14;
        this.videoEncoder.configure({
            codec: 'avc1.42E028',   // H.264 Baseline profile
            width: encWidth,
            height: encHeight,
            bitrate: Math.min(bitrate, 20_000_000),
            framerate: this.fps,
            // Required by mp4-muxer to avoid "Cannot read properties of null (reading 'colorSpace')"
            avc: { format: 'avc' },
        });

        // Try to configure AudioEncoder — fall back to video-only if the browser doesn't support it
        this.audioEncoderReady = false;
        this.audioEncoder = new AudioEncoder({
            output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
            error: (e) => {
                console.warn('AudioEncoder error (video-only fallback):', e);
                this.audioEncoderReady = false;
            },
        });
        try {
            this.audioEncoder.configure({
                codec: 'mp4a.40.2',
                sampleRate,
                numberOfChannels: 2,
                bitrate: 192_000,
            });
            this.audioEncoderReady = true;
        } catch (e) {
            console.warn('AudioEncoder configure failed (video-only mode):', e);
            this.audioEncoderReady = false;
        }

        if (this.audioEncoderReady && this.audioSourceNode) {
            this.audioDestNode = this.audioCtx.createMediaStreamDestination();
            this.audioSourceNode.connect(this.audioDestNode);
            const audioTrack = this.audioDestNode.stream.getAudioTracks()[0];
            if (audioTrack && typeof MediaStreamTrackProcessor !== 'undefined') {
                const processor = new MediaStreamTrackProcessor({ track: audioTrack } as any);
                this.trackReader = processor.readable.getReader();
                this.processAudio();
            }
        }

        this.startTime = performance.now();
        this.lastFrameTime = this.startTime;
        this.captureLoop();
    }

    private async processAudio() {
        if (!this.trackReader) return;
        try {
            while (this._isRecording) {
                const { done, value } = await this.trackReader.read();
                if (done) break;
                if (value) {
                    if (this.audioEncoderReady && this.audioEncoder?.state === 'configured') {
                        this.audioEncoder.encode(value);
                    }
                    value.close();
                }
            }
        } catch (e) {
            // Ignored — stream cancelled on stop
        }
    }

    private captureLoop = () => {
        if (!this._isRecording) return;
        this.frameHandle = requestAnimationFrame(this.captureLoop);

        const now = performance.now();
        const elapsed = now - this.lastFrameTime;
        const frameDuration = 1000 / this.fps;

        if (elapsed >= frameDuration) {
            this.lastFrameTime = now - (elapsed % frameDuration);
            const timestamp = (now - this.startTime) * 1000;

            if (this.videoEncoder?.state === 'configured') {
                const frame = new VideoFrame(this.canvas, { timestamp });
                const keyFrame = (timestamp / 1_000_000) % 2 === 0;
                this.videoEncoder.encode(frame, { keyFrame });
                frame.close();
            }
        }
    }

    get isRecording(): boolean { return this._isRecording; }

    async stop(): Promise<void> {
        console.log('[LiveRecorder] stop() started');
        if (!this._isRecording) return;
        this._isRecording = false;
        cancelAnimationFrame(this.frameHandle);

        if (this.audioSourceNode && this.audioDestNode) {
            try { this.audioSourceNode.disconnect(this.audioDestNode); } catch (e) { }
        }
        if (this.trackReader) {
            try { this.trackReader.cancel().catch(() => { }); } catch (e) { }
            this.trackReader = null;
        }

        console.log('[LiveRecorder] flushing encoders');

        // Close broken audio encoder immediately — prevents hanging flush
        if (!this.audioEncoderReady) {
            try { this.audioEncoder?.close(); } catch (e) { }
            this.audioEncoder = null;
        }

        // Flush video with a 5s timeout. We do NOT close the encoder during the race —
        // that would abort in-flight frames. We close after the race either way.
        if (this.videoEncoder?.state === 'configured') {
            let flushDone = false;
            const flushPromise = this.videoEncoder.flush()
                .then(() => { flushDone = true; console.log('[LiveRecorder] video flush done'); })
                .catch(e => { console.warn('[LiveRecorder] video flush error:', e); });
            const timeoutPromise = new Promise<void>(res => setTimeout(() => {
                if (!flushDone) console.warn('[LiveRecorder] video flush timed out, closing encoder');
                res();
            }, 5000));
            await Promise.race([flushPromise, timeoutPromise]);
        }
        // Close video encoder after flush (success or timeout)
        if (this.videoEncoder?.state !== 'closed') {
            try { this.videoEncoder?.close(); } catch (e) { }
        }

        // Flush audio encoder only if it was healthy
        if (this.audioEncoderReady && this.audioEncoder?.state === 'configured') {
            try { await this.audioEncoder.flush(); } catch (e) {
                console.warn('audio flush error', e);
            }
        }
        if (this.audioEncoder && this.audioEncoder.state !== 'closed') {
            try { this.audioEncoder.close(); } catch (e) { }
        }

        console.log('[LiveRecorder] finalizing muxer');
        try {
            this.muxer.finalize();
        } catch (e) {
            console.error('muxer finalize error', e);
        }

        console.log('[LiveRecorder] generating blob');
        const buffer = this.muxer.target.buffer;
        const blob = new Blob([buffer], { type: 'video/mp4' });

        console.log('[LiveRecorder] calling onStop callback');
        this.onStop?.(blob);
    }
}

export function downloadRecording(blob: Blob, fileName = 'sonic-visualizer-live'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.mp4`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 10_000);
}
