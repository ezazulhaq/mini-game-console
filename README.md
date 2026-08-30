# NES Mobile Emulator

A modern, responsive, edge-to-edge web-based NES emulator built with Angular, Tailwind CSS, and `jsnes`.

## Features

- **Modern Mobile-First UI**: A sleek, fullscreen dark-mode interface that feels like a native mobile app.
- **Advanced Touch Controls**: Features a responsive virtual analog joystick (potentiometer-style) and multi-touch action buttons.
- **Desktop & Gamepad Support**: Automatically detects non-touch environments, hiding virtual controls and seamlessly falling back to Keyboard (WASD/Arrows) and HTML5 Gamepad API inputs.
- **Custom ROM Loading**: Play any compatible `.nes` file by loading it locally from your device.
- **Save States**: Save and load game progress reliably using browser-native `IndexedDB`.
- **PWA Ready**: Fully installable as a Progressive Web App for offline access on iOS and Android devices.

## Architecture

This codebase is strictly refactored to follow **SOLID** and **OOP** principles:
- **`EmulatorService`**: Abstract core encapsulating the `jsnes` engine, rendering loops, and audio processing.
- **`InputManagerService`**: Normalizes all control pipelines across Touch, Keyboard, and external Gamepads.
- **`StorageService`**: Dependency-injected interface for persistent database interactions (Save states).

## Controls

### Keyboard (Desktop)
- **D-Pad**: `WASD` or `Arrow Keys`
- **A Button**: `Space`, `X`, or `K`
- **B Button**: `Z` or `J`
- **Start**: `Enter`
- **Select**: `Shift`
- **Pause**: `P` or `Esc`
- **Restart**: `R`

## Getting Started

To run the application locally:

```bash
npm install
npm start
```
