import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  ViewChild,
  signal,
  inject,
  afterNextRender,
} from '@angular/core';
import {NES, Controller} from 'jsnes';
import {MatIconModule} from '@angular/material/icon';
import {saveStateToDB, loadStateFromDB} from './db';

export interface Game {
  id: string;
  title: string;
  url: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  @ViewChild('nesCanvas', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  nes!: NES;
  audioCtx?: AudioContext;
  
  romLoaded = signal(false);
  isPaused = signal(false);
  deferredPrompt = signal<Event | null>(null);

  currentGameId = signal<string | null>(null);
  hasSavedState = signal(false);

  availableGames = signal<Game[]>([
    { id: '1', title: 'Driar (Platformer)', url: '/roms/driar.nes' },
    { id: '2', title: 'Flappy Bird (Arcade)', url: '/roms/flappybird.nes' },
    { id: '3', title: 'Lala the Magical (Adventure)', url: '/roms/lala.nes' },
  ]);
  isLoading = signal(false);
  loadError = signal('');
  currentFps = signal(0);
  
  private frameId = 0;
  private frameCount = 0;
  private lastFpsTime = 0;
  private canvasCtx!: CanvasRenderingContext2D;
  private imageData!: ImageData;
  private buf!: ArrayBuffer;
  private buf8!: Uint8ClampedArray;
  private buf32!: Uint32Array;
  private ngZone = inject(NgZone);

  constructor() {
    afterNextRender(() => {
      this.canvasCtx = this.canvasRef.nativeElement.getContext('2d')!;
      this.imageData = this.canvasCtx.getImageData(0, 0, 256, 240);
      this.buf = new ArrayBuffer(this.imageData.data.length);
      this.buf8 = new Uint8ClampedArray(this.buf);
      this.buf32 = new Uint32Array(this.buf);
      
      // Set up jsnes
      this.nes = new NES({
        onFrame: (frameBuffer: number[]) => {
          // Convert JSnes frame buffer (which is an array of 256*240 32-bit colors) to ImageData
          let i = 0;
          for (let y = 0; y < 240; ++y) {
            for (let x = 0; x < 256; ++x) {
              i = y * 256 + x;
              // The NES palette is in 32-bit format but it might need to be converted to RGBA
              this.buf32[i] = 0xff000000 | frameBuffer[i];
            }
          }
          this.imageData.data.set(this.buf8);
          this.canvasCtx.putImageData(this.imageData, 0, 0);
        },
        onAudioSample: () => {
          // Audio processing can be implemented here if needed
        },
      });
    });
  }

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(e: Event) {
    e.preventDefault();
    this.deferredPrompt.set(e);
  }

  async installApp() {
    const prompt = this.deferredPrompt() as { prompt: () => void, userChoice: Promise<{ outcome: string }> } | null;
    if (!prompt) return;
    prompt.prompt();
    const {outcome} = await prompt.userChoice;
    if (outcome === 'accepted') {
      this.deferredPrompt.set(null);
    }
  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    // Using string conversion compatible with ts types without casting as any unnecessarily
    const romData = Array.from(new Uint8Array(buffer)).map(byte => String.fromCharCode(byte)).join('');
    
    this.nes.loadROM(romData);
    this.romLoaded.set(true);
    this.currentGameId.set(file.name);
    
    this.startLoop();
    this.checkSavedState();
  }

  async loadGameFromUrl(url: string, id: string) {
    this.isLoading.set(true);
    this.loadError.set('');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not load ROM. Did you place ${url}?`);
      const buffer = await response.arrayBuffer();
      const romData = Array.from(new Uint8Array(buffer)).map(byte => String.fromCharCode(byte)).join('');
      
      this.nes.loadROM(romData);
      this.romLoaded.set(true);
      this.currentGameId.set(id);
      this.isPaused.set(false);
      this.startLoop();
      this.checkSavedState();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error loading ROM';
      this.loadError.set(msg);
    } finally {
      this.isLoading.set(false);
    }
  }

  returnToLibrary() {
    this.isPaused.set(true);
    this.romLoaded.set(false);
    this.currentGameId.set(null);
    this.hasSavedState.set(false);
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
    this.canvasCtx.clearRect(0, 0, 256, 240);
  }

  async checkSavedState() {
    const id = this.currentGameId();
    if (!id) return;
    try {
      const state = await loadStateFromDB(id);
      this.hasSavedState.set(!!state);
    } catch (e) {
      console.error('Failed to check saved state', e);
    }
  }

  async saveState() {
    const id = this.currentGameId();
    if (!id || !this.romLoaded()) return;
    try {
      const state = (this.nes as unknown as { toJSON: () => unknown }).toJSON();
      await saveStateToDB(id, state);
      this.hasSavedState.set(true);
    } catch (e) {
      console.error('Failed to save state', e);
    }
  }

  async loadState() {
    const id = this.currentGameId();
    if (!id || !this.romLoaded()) return;
    try {
      const state = await loadStateFromDB(id);
      if (state) {
        (this.nes as unknown as { fromJSON: (s: unknown) => void }).fromJSON(state);
      }
    } catch (e) {
      console.error('Failed to load state', e);
    }
  }

  startLoop() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps.set(0);

    this.ngZone.runOutsideAngular(() => {
      const loop = (time: number) => {
        if (!this.isPaused()) {
          this.nes.frame();
          this.frameCount++;
          
          if (time - this.lastFpsTime >= 1000) {
            this.currentFps.set(this.frameCount);
            this.frameCount = 0;
            this.lastFpsTime = time;
          }
        } else {
          this.lastFpsTime = time; // keep it updated while paused
        }
        this.frameId = requestAnimationFrame(loop);
      };
      this.frameId = requestAnimationFrame(loop);
    });
  }

  togglePause() {
    this.isPaused.update((p) => !p);
  }
  
  // Controller Handlers
  onButtonDown(button: number, e: Event) {
    e.preventDefault();
    if (this.romLoaded()) {
      this.nes.buttonDown(1, button);
    }
  }

  onButtonUp(button: number, e: Event) {
    e.preventDefault();
    if (this.romLoaded()) {
      this.nes.buttonUp(1, button);
    }
  }

  get c() {
    return Controller;
  }
}
