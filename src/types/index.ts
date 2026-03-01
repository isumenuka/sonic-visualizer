export type VisualizerType = 'bars' | 'wave' | 'spiral' | 'particles' | 'ring' | 'strings' | 'orbit' | 'spikes' | 'laser' | 'nebula' | 'aura' | 'peaks';
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
}
