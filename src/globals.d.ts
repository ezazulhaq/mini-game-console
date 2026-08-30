declare module 'jsnes' {
  export class NES {
    constructor(options: {
      onFrame: (frameBuffer: number[]) => void;
      onAudioSample: (left: number, right: number) => void;
      sampleRate?: number;
    });
    buttonDown(controller: number, button: number): void;
    buttonUp(controller: number, button: number): void;
    loadROM(romData: string): void;
    frame(): void;
    reset(): void;
  }
  export const Controller: {
    BUTTON_A: number;
    BUTTON_B: number;
    BUTTON_SELECT: number;
    BUTTON_START: number;
    BUTTON_UP: number;
    BUTTON_DOWN: number;
    BUTTON_LEFT: number;
    BUTTON_RIGHT: number;
  };
}
