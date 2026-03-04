// Global declarations for Web APIs not yet in TypeScript's default lib

interface MediaStreamTrackProcessorInit {
    track: MediaStreamTrack;
}

declare class MediaStreamTrackProcessor {
    constructor(options: MediaStreamTrackProcessorInit);
    readonly readable: ReadableStream<VideoFrame | AudioData>;
}
