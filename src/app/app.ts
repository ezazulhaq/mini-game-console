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
import { MatIconModule } from '@angular/material/icon';
import { Controller } from 'jsnes';
import { Game } from './core/models/game.model';
import { StorageService } from './core/services/storage.service';
import { EmulatorService } from './core/services/emulator.service';
import { InputManagerService, InputHandler } from './core/services/input.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements InputHandler {
  @ViewChild('nesCanvas', {static: true}) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private storageService = inject(StorageService);
  private emulatorService = inject(EmulatorService);
  private inputService = inject(InputManagerService);
  private ngZone = inject(NgZone);

  romLoaded = signal(false);
  isPaused = signal(false);
  deferredPrompt = signal<Event | null>(null);
  isTouchDevice = signal(true);
  
  joystickPos = signal({ x: 0, y: 0 });

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

  constructor() {
    this.inputService.setHandler(this);
    
    afterNextRender(() => {
      this.isTouchDevice.set(
        window.matchMedia('(pointer: coarse)').matches || 
        'ontouchstart' in window || 
        navigator.maxTouchPoints > 0
      );
      
      const canvasCtx = this.canvasRef.nativeElement.getContext('2d')!;
      this.emulatorService.init(canvasCtx);
    });
  }

  // --- InputHandler Implementation ---
  onButtonDown(button: number): void {
    this.emulatorService.buttonDown(1, button);
  }

  onButtonUp(button: number): void {
    this.emulatorService.buttonUp(1, button);
  }

  // --- App Lifecycle & State Management ---
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
    const romData = Array.from(new Uint8Array(buffer)).map(byte => String.fromCharCode(byte)).join('');
    
    this.startROM(romData, file.name);
  }

  async loadGameFromUrl(url: string, id: string) {
    this.isLoading.set(true);
    this.loadError.set('');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not load ROM. Did you place ${url}?`);
      const buffer = await response.arrayBuffer();
      const romData = Array.from(new Uint8Array(buffer)).map(byte => String.fromCharCode(byte)).join('');
      
      this.startROM(romData, id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error loading ROM';
      this.loadError.set(msg);
    } finally {
      this.isLoading.set(false);
    }
  }

  private startROM(romData: string, id: string) {
    this.emulatorService.loadROM(romData);
    this.romLoaded.set(true);
    this.currentGameId.set(id);
    this.isPaused.set(false);
    this.startLoop();
    this.checkSavedState();
  }

  returnToLibrary() {
    this.isPaused.set(true);
    this.romLoaded.set(false);
    this.currentGameId.set(null);
    this.hasSavedState.set(false);
    this.stopLoop();
    
    const canvasCtx = this.canvasRef.nativeElement.getContext('2d');
    if (canvasCtx) canvasCtx.clearRect(0, 0, 256, 240);
  }

  async checkSavedState() {
    const id = this.currentGameId();
    if (!id) return;
    try {
      const state = await this.storageService.loadState(id);
      this.hasSavedState.set(!!state);
    } catch (e) {
      console.error('Failed to check saved state', e);
    }
  }

  async saveState() {
    const id = this.currentGameId();
    if (!id || !this.romLoaded()) return;
    try {
      const state = this.emulatorService.getState();
      if (state) {
        await this.storageService.saveState(id, state);
        this.hasSavedState.set(true);
      }
    } catch (e) {
      console.error('Failed to save state', e);
    }
  }

  async loadState() {
    const id = this.currentGameId();
    if (!id || !this.romLoaded()) return;
    try {
      const state = await this.storageService.loadState(id);
      if (state) {
        this.emulatorService.loadState(state);
      }
    } catch (e) {
      console.error('Failed to load state', e);
    }
  }

  // --- Emulation Loop ---
  private startLoop() {
    this.stopLoop();
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps.set(0);

    this.ngZone.runOutsideAngular(() => {
      const loop = (time: number) => {
        this.inputService.pollGamepads();
        
        if (!this.isPaused()) {
          this.emulatorService.frame();
          this.frameCount++;
          
          if (time - this.lastFpsTime >= 1000) {
            this.currentFps.set(this.frameCount);
            this.frameCount = 0;
            this.lastFpsTime = time;
          }
        } else {
          this.lastFpsTime = time;
        }
        this.frameId = requestAnimationFrame(loop);
      };
      this.frameId = requestAnimationFrame(loop);
    });
  }

  private stopLoop() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  togglePause() {
    this.isPaused.update((p) => !p);
  }

  restartGame() {
    if (this.romLoaded()) {
      this.emulatorService.reset();
      this.isPaused.set(false);
    }
  }

  // --- Input Event Bindings ---
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.romLoaded()) return;
    if (event.code === 'KeyP' || event.code === 'Escape') {
      this.togglePause();
    } else if (event.code === 'KeyR') {
      this.restartGame();
    } else {
      if (this.inputService.mapKeyCode(event.code) !== null) {
        event.preventDefault();
      }
      this.inputService.handleKeyDown(event.code);
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent) {
    if (!this.romLoaded()) return;
    if (this.inputService.mapKeyCode(event.code) !== null) {
      event.preventDefault();
    }
    this.inputService.handleKeyUp(event.code);
  }
  
  // Controller Handlers
  onTouchButtonDown(button: number, e: Event) {
    e.preventDefault();
    if (this.romLoaded()) {
      this.inputService.handleTouchButtonDown(button);
    }
  }

  onTouchButtonUp(button: number, e: Event) {
    e.preventDefault();
    if (this.romLoaded()) {
      this.inputService.handleTouchButtonUp(button);
    }
  }

  get c() {
    return Controller;
  }

  // Joystick Handlers
  private isDraggingJoy = false;

  onJoystickStart(e: TouchEvent | MouseEvent) {
    if (e.cancelable) e.preventDefault();
    this.isDraggingJoy = true;
    this.handleJoystickEvent(e);
  }

  onJoystickMove(e: TouchEvent | MouseEvent) {
    if (!this.isDraggingJoy) return;
    if (e.cancelable) e.preventDefault();
    this.handleJoystickEvent(e);
  }

  onJoystickEnd(e: TouchEvent | MouseEvent) {
    if (e && e.type !== 'mouseleave' && e.cancelable) e.preventDefault();
    this.isDraggingJoy = false;
    this.joystickPos.set({ x: 0, y: 0 });
    this.inputService.updateJoystick(0, 0);
  }

  private handleJoystickEvent(e: TouchEvent | MouseEvent) {
    const target = (e.currentTarget as HTMLElement).parentElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let clientX, clientY;
    if (window.TouchEvent && e instanceof TouchEvent) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    // 35 is JOYSTICK_RADIUS
    if (distance > 35) {
      const ratio = 35 / distance;
      dx *= ratio;
      dy *= ratio;
    }

    this.joystickPos.set({ x: dx, y: dy });
    this.inputService.updateJoystick(dx, dy);
  }
}

