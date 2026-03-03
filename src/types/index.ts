export type VisualizerType = 'bars' | 'wave' | 'spiral' | 'particles' | 'ring' | 'strings' | 'orbit' | 'spikes' | 'laser' | 'nebula' | 'aura' | 'peaks' | 'diamond' | 'tunnel' | 'frequency' | 'fractal' | 'helix' | 'constellation' | 'lightning' | 'waveform' | 'prism';
export type CenterMode = 'logo' | 'profile' | 'text' | 'none';

export interface VisualizerSettings {
    primaryColor: string;
    secondaryColor: string;
    sensitivity: number;
    barWidth: number;
    radius: number;
    type: VisualizerType;
    centerMode: CenterMode;
    centerText: string;
    centerTextSize: number;
    centerColor: string;
    logoScale: number;
    bgBlur: number;
    bgOpacity: number;
    mirror: boolean;
    rotationSpeed: number;
    pulseEnabled: boolean;
    glowEnabled: boolean;
    trailEnabled: boolean;
    colorCycle: boolean;
    shakeEnabled: boolean;
    echoEnabled: boolean;
    invertColors: boolean;
    bgParticlesEnabled: boolean;
    performanceMode: boolean;
    starburstEnabled: boolean;
    kaleidoscopeEnabled: boolean;
    scanlineEnabled: boolean;
    chromaticEnabled: boolean;
    vignetteEnabled: boolean;
    pixelateEnabled: boolean;
    strobeEnabled: boolean;
    rippleEnabled: boolean;
}
