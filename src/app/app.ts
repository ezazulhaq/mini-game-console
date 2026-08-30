import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnInit,
  ViewChild,
  signal,
  inject,
} from '@angular/core';
import {NES, Controller} from 'jsnes';
import {MatIconModule} from '@angular/material/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  @ViewChild('nesCanvas', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  nes!: NES;
  audioCtx?: AudioContext;
  
  romLoaded = signal(false);
  isPaused = signal(false);
  deferredPrompt = signal<Event | null>(null);
  
  private frameId = 0;
  private canvasCtx!: CanvasRenderingContext2D;
  private imageData!: ImageData;
  private buf!: ArrayBuffer;
  private buf8!: Uint8ClampedArray;
  private buf32!: Uint32Array;
  private ngZone = inject(NgZone);

  ngOnInit() {
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
    
    this.startLoop();
  }

  startLoop() {
    this.ngZone.runOutsideAngular(() => {
      const loop = () => {
        if (!this.isPaused()) {
          this.nes.frame();
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
