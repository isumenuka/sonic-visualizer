# Sonic Visualizer 🎵✨

A premium, modern, and highly customizable Audio Visualizer built with React, TypeScript, Tailwind CSS, and the native HTML5 Canvas API.

### Features

- **12 Unique Visualizer Engines**: Select perfectly responsive audio-reactive shapes.
  - Bars, Wave, Spiral, Particles
  - Ring, Strings, Orbit, Spikes 
  - Laser, Nebula, Aura, Peaks
- **Tabbed Settings Menu**: A clean, categorized overlay containing **Visuals**, **Center**, **Effects**, and **Tuning** tabs.
- **Floating Minimalism**: Mac-OS inspired floating bottom dock with frosted glass translucent menus for a clean viewing experience.
- **Center Profiles**: Personalize the center circle. Type custom illuminated text, or upload a custom cropped profile image.
- **Smart Color Extraction**: Automatically extracts primary and secondary HEX colors from your uploaded custom images to seamlessly theme the entire visualizer to your profile, or set your own via the color pickers.
- **Real-Time Physics Tuning**: Adjust mirror spectrums, audio sensitivity, canvas radii, and custom background blur/opacity on the fly without interrupting playback.
- **Advanced Core Effects**: Stackable rendering effects including: 
  - Particles Overlay, Invert Colors, Color Cycle
  - Ghost Echoes, Glow bloom, Fade Trails, Camera Shake
- **Video Exporter**: Directly record your custom visualizer to `.webm` inside the app!
  - Supports `1080p`, `2K`, and `4K` rendering targets.
  - Records silently in the background (mutes playback during export).
  - Low-End PC mode temporarily overrides back to full 60fps & max resolution automatically during video exports so rendering quality isn't compromised.

## Getting Started

**Prerequisites:** Node.js v16+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server locally:
   ```bash
   npm run dev
   ```

## Usage

1. Click the center **Music Upload** icon in the floating dock to load a local audio file (`.mp3`, `.wav`, etc.).
2. Select the **Settings Gear** in the dock to open the Appearance panel.
3. Click through the categories to customize the visualizer type, visual effects, and center profile.
4. Try uploading a Custom Background Image and adjust the blur sliders for an ambient backdrop!
5. When you have a visual setup you are happy with, select your preferred resolution (1080p, 2K, 4K) and click the **Export** button to render out a video!
