import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface LiveRecordOptions {
    canvas: HTMLCanvasElement;
    audioElement: HTMLAudioElement;
    audioContext: AudioContext;
    audioSourceNode?: MediaElementAudioSourceNode;
    fps?: number;
    onStop?: (blob: Blob) => void;
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
        this.muxer = new Muxer({
            target,
            video: { codec: 'avc', width: this.canvas.width, height: this.canvas.height },
            audio: { codec: 'aac', sampleRate: this.audioCtx.sampleRate, numberOfChannels: 2 },
            firstTimestampBehavior: 'offset',
            fastStart: 'in-memory',
        });

        this.videoEncoder = new VideoEncoder({
            output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
            error: (e) => console.error('VideoEncoder error:', e),
        });
        const bitrate = this.canvas.width * this.canvas.height * this.fps * 0.14;
        this.videoEncoder.configure({
            codec: 'avc1.420028',
            width: this.canvas.width,
            height: this.canvas.height,
            bitrate: Math.min(bitrate, 20_000_000),
            framerate: this.fps,
        });

        this.audioEncoder = new AudioEncoder({
            output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
            error: (e) => console.error('AudioEncoder error:', e),
        });
        this.audioEncoder.configure({
            codec: 'mp4a.40.2',
            sampleRate: this.audioCtx.sampleRate,
            numberOfChannels: 2,
            bitrate: 192_000,
        });

        this.audioDestNode = this.audioCtx.createMediaStreamDestination();
        if (this.audioSourceNode) {
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
                if (value && this.audioEncoder?.state === 'configured') {
                    this.audioEncoder.encode(value);
                    value.close();
                }
            }
        } catch (e) {
            // Ignored
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
        if (!this._isRecording) return;
        this._isRecording = false;
        cancelAnimationFrame(this.frameHandle);

        if (this.audioSourceNode && this.audioDestNode) {
            try { this.audioSourceNode.disconnect(this.audioDestNode); } catch (e) { }
        }
        if (this.trackReader) {
            try { await this.trackReader.cancel(); } catch (e) { }
            this.trackReader = null;
        }

        await Promise.all([
            this.videoEncoder?.flush().catch(() => { }),
            this.audioEncoder?.flush().catch(() => { }),
        ]);

        this.videoEncoder?.close();
        this.audioEncoder?.close();
        this.muxer.finalize();

        const buffer = this.muxer.target.buffer;
        const blob = new Blob([buffer], { type: 'video/mp4' });
        this.onStop?.(blob);
    }
}

export function downloadRecording(blob: Blob, fileName = 'sonic-visualizer-live'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.mp4`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
