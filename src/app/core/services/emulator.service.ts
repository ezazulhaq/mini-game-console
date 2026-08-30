import { Injectable, signal, WritableSignal } from '@angular/core';
import { NES } from 'jsnes';

export abstract class EmulatorService {
  abstract init(canvasCtx: CanvasRenderingContext2D): void;
  abstract loadROM(romData: string): void;
  abstract frame(): void;
  abstract buttonDown(player: number, button: number): void;
  abstract buttonUp(player: number, button: number): void;
  abstract reset(): void;
  abstract getState(): unknown;
  abstract loadState(state: unknown): void;
}

@Injectable({ providedIn: 'root' })
export class NesEmulatorService extends EmulatorService {
  private nes!: NES;
  private canvasCtx!: CanvasRenderingContext2D;
  private imageData!: ImageData;
  private buf!: ArrayBuffer;
  private buf8!: Uint8ClampedArray;
  private buf32!: Uint32Array;

  override init(canvasCtx: CanvasRenderingContext2D): void {
    this.canvasCtx = canvasCtx;
    this.imageData = this.canvasCtx.getImageData(0, 0, 256, 240);
    this.buf = new ArrayBuffer(this.imageData.data.length);
    this.buf8 = new Uint8ClampedArray(this.buf);
    this.buf32 = new Uint32Array(this.buf);

    this.nes = new NES({
      onFrame: (frameBuffer: number[]) => this.renderFrame(frameBuffer),
      onAudioSample: () => {
        // Audio processing can be implemented here if needed
      },
    });
  }

  private renderFrame(frameBuffer: number[]): void {
    let i = 0;
    for (let y = 0; y < 240; ++y) {
      for (let x = 0; x < 256; ++x) {
        i = y * 256 + x;
        this.buf32[i] = 0xff000000 | frameBuffer[i];
      }
    }
    this.imageData.data.set(this.buf8);
    this.canvasCtx.putImageData(this.imageData, 0, 0);
  }

  override loadROM(romData: string): void {
    if (!this.nes) throw new Error('Emulator not initialized');
    this.nes.loadROM(romData);
  }

  override frame(): void {
    if (this.nes) {
      this.nes.frame();
    }
  }

  override buttonDown(player: number, button: number): void {
    if (this.nes) this.nes.buttonDown(player, button);
  }

  override buttonUp(player: number, button: number): void {
    if (this.nes) this.nes.buttonUp(player, button);
  }

  override reset(): void {
    if (this.nes) this.nes.reset();
  }

  override getState(): unknown {
    return this.nes ? (this.nes as any).toJSON() : null;
  }

  override loadState(state: unknown): void {
    if (this.nes && state) {
      (this.nes as any).fromJSON(state);
    }
  }
}
