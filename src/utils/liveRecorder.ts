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

// Pick H.264 High Profile codec string at the right level for the given dimensions.
// Level 5.1 supports up to 3840×2160 @ 30fps which covers 1080p, 2K, and 4K.
function h264Codec(_w: number, _h: number): string {
    // avc1.PPCCLL  PP=profile(64=High)  CC=constraints(00)  LL=level(33=5.1)
    return 'avc1.640033';
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

        const encWidth = this.canvas.width % 2 === 0 ? this.canvas.width : this.canvas.width - 1;
        const encHeight = this.canvas.height % 2 === 0 ? this.canvas.height : this.canvas.height - 1;
        const sampleRate = clampSampleRate(this.audioCtx.sampleRate);
        const codec = h264Codec(encWidth, encHeight);

        // ── Pre-check AudioEncoder support BEFORE creating the muxer ─────────
        // This is critical: if we declare audio in the muxer but never write
        // audio chunks, mp4-muxer produces a malformed file VLC can't open.
        const audioConfig = {
            codec: 'mp4a.40.2',
            sampleRate,
            numberOfChannels: 2,
            bitrate: 192_000,
        };
        let audioSupported = false;
        if (typeof AudioEncoder !== 'undefined') {
            try {
                const support = await AudioEncoder.isConfigSupported(audioConfig);
                audioSupported = !!support.supported;
            } catch (_) {
                audioSupported = false;
            }
        }

        // ── Pre-check VideoEncoder support ────────────────────────────────────
        const videoConfig = {
            codec,
            width: encWidth,
            height: encHeight,
            bitrate: Math.min(encWidth * encHeight * this.fps * 0.14, 60_000_000),
            framerate: this.fps,
            avc: { format: 'avc' as const },
        };
        let resolvedCodec = codec;
        try {
            const vsupport = await VideoEncoder.isConfigSupported(videoConfig);
            if (!vsupport.supported) {
                // Fall back to Baseline profile Level 5.2 if High isn't supported
                resolvedCodec = 'avc1.420034';
            }
        } catch (_) { /* use default */ }

        const target = new ArrayBufferTarget();
        this.muxer = new Muxer({
            target,
            video: { codec: 'avc', width: encWidth, height: encHeight },
            // Only declare audio track if AudioEncoder can actually encode audio.
            // Declaring audio but writing zero chunks produces a malformed MP4.
            ...(audioSupported ? { audio: { codec: 'aac', sampleRate, numberOfChannels: 2 } } : {}),
            firstTimestampBehavior: 'offset',
            fastStart: 'in-memory',
        });

        // ── Video encoder ─────────────────────────────────────────────────────
        this.videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                // Inject standard sRGB color space if missing (required by mp4-muxer)
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
        this.videoEncoder.configure({ ...videoConfig, codec: resolvedCodec });

        // ── Audio encoder (only if supported) ─────────────────────────────────
        this.audioEncoderReady = false;
        if (audioSupported) {
            this.audioEncoder = new AudioEncoder({
                output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
                error: (e) => {
                    console.warn('AudioEncoder error:', e);
                    this.audioEncoderReady = false;
                },
            });
            try {
                this.audioEncoder.configure(audioConfig);
                this.audioEncoderReady = true;
            } catch (e) {
                console.warn('AudioEncoder configure failed:', e);
                this.audioEncoderReady = false;
            }
        }

        // ── Wire audio capture ────────────────────────────────────────────────
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
        } catch (_) {
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
            try { this.audioSourceNode.disconnect(this.audioDestNode); } catch (_) { }
        }
        if (this.trackReader) {
            try { this.trackReader.cancel().catch(() => { }); } catch (_) { }
            this.trackReader = null;
        }

        console.log('[LiveRecorder] flushing encoders');

        // Flush and close video encoder (5s timeout to avoid hanging forever)
        if (this.videoEncoder?.state === 'configured') {
            let flushDone = false;
            const flushPromise = this.videoEncoder.flush()
                .then(() => { flushDone = true; console.log('[LiveRecorder] video flush done'); })
                .catch(e => { console.warn('[LiveRecorder] video flush error:', e); });
            await Promise.race([
                flushPromise,
                new Promise<void>(res => setTimeout(() => {
                    if (!flushDone) console.warn('[LiveRecorder] video flush timed out');
                    res();
                }, 5000)),
            ]);
        }
        if (this.videoEncoder?.state !== 'closed') {
            try { this.videoEncoder?.close(); } catch (_) { }
        }

        // Flush and close audio encoder
        if (this.audioEncoderReady && this.audioEncoder?.state === 'configured') {
            try { await this.audioEncoder.flush(); } catch (e) {
                console.warn('[LiveRecorder] audio flush error', e);
            }
        }
        if (this.audioEncoder && this.audioEncoder.state !== 'closed') {
            try { this.audioEncoder.close(); } catch (_) { }
        }

        console.log('[LiveRecorder] finalizing muxer');
        try {
            this.muxer.finalize();
        } catch (e) {
            console.error('[LiveRecorder] muxer finalize error', e);
        }

        const buffer = this.muxer.target.buffer;
        if (!buffer || buffer.byteLength === 0) {
            console.error('[LiveRecorder] muxer produced empty buffer — no frames encoded?');
        }
        const blob = new Blob([buffer], { type: 'video/mp4' });
        console.log(`[LiveRecorder] blob size: ${blob.size} bytes`);
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
