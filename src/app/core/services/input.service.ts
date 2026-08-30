import { Injectable } from '@angular/core';
import { Controller } from 'jsnes';

export interface IInputDevice {
  poll(): void;
}

export abstract class InputHandler {
  abstract onButtonDown(button: number): void;
  abstract onButtonUp(button: number): void;
}

@Injectable({ providedIn: 'root' })
export class InputManagerService {
  private handler: InputHandler | null = null;
  private lastGamepadState: Record<number, boolean> = {};
  private activeJoyDirs = new Set<number>();
  
  private readonly JOYSTICK_DEADZONE = 10;

  setHandler(handler: InputHandler): void {
    this.handler = handler;
  }

  // Keyboard mapping
  mapKeyCode(code: string): number | null {
    switch (code) {
      case 'ArrowUp':
      case 'KeyW': return Controller.BUTTON_UP;
      case 'ArrowDown':
      case 'KeyS': return Controller.BUTTON_DOWN;
      case 'ArrowLeft':
      case 'KeyA': return Controller.BUTTON_LEFT;
      case 'ArrowRight':
      case 'KeyD': return Controller.BUTTON_RIGHT;
      case 'Enter': return Controller.BUTTON_START;
      case 'ShiftLeft':
      case 'ShiftRight': return Controller.BUTTON_SELECT;
      case 'KeyZ':
      case 'KeyJ': return Controller.BUTTON_B;
      case 'KeyX':
      case 'KeyK':
      case 'Space': return Controller.BUTTON_A;
      default: return null;
    }
  }

  handleKeyDown(code: string): void {
    if (!this.handler) return;
    const btn = this.mapKeyCode(code);
    if (btn !== null) {
      this.handler.onButtonDown(btn);
    }
  }

  handleKeyUp(code: string): void {
    if (!this.handler) return;
    const btn = this.mapKeyCode(code);
    if (btn !== null) {
      this.handler.onButtonUp(btn);
    }
  }

  // Touch UI Mapping
  handleTouchButtonDown(btn: number): void {
    if (this.handler) this.handler.onButtonDown(btn);
  }

  handleTouchButtonUp(btn: number): void {
    if (this.handler) this.handler.onButtonUp(btn);
  }

  // Analog Joystick Mapping
  updateJoystick(dx: number, dy: number): void {
    if (!this.handler) return;

    const newDirs = new Set<number>();
    
    if (Math.abs(dx) > this.JOYSTICK_DEADZONE || Math.abs(dy) > this.JOYSTICK_DEADZONE) {
      if (dx < -this.JOYSTICK_DEADZONE) newDirs.add(Controller.BUTTON_LEFT);
      if (dx > this.JOYSTICK_DEADZONE) newDirs.add(Controller.BUTTON_RIGHT);
      if (dy < -this.JOYSTICK_DEADZONE) newDirs.add(Controller.BUTTON_UP);
      if (dy > this.JOYSTICK_DEADZONE) newDirs.add(Controller.BUTTON_DOWN);
    }

    for (const btn of this.activeJoyDirs) {
      if (!newDirs.has(btn)) {
        this.handler.onButtonUp(btn);
      }
    }
    
    for (const btn of newDirs) {
      if (!this.activeJoyDirs.has(btn)) {
        this.handler.onButtonDown(btn);
      }
    }
    
    this.activeJoyDirs = newDirs;
  }

  // Gamepad Polling
  pollGamepads(): void {
    if (!navigator.getGamepads || !this.handler) return;
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];
    
    if (!gp) return;

    const states: Record<number, boolean> = {
      [Controller.BUTTON_A]: gp.buttons[0]?.pressed || gp.buttons[1]?.pressed || false,
      [Controller.BUTTON_B]: gp.buttons[2]?.pressed || gp.buttons[3]?.pressed || false,
      [Controller.BUTTON_SELECT]: gp.buttons[8]?.pressed || false,
      [Controller.BUTTON_START]: gp.buttons[9]?.pressed || false,
      [Controller.BUTTON_UP]: gp.buttons[12]?.pressed || (gp.axes[1] < -0.5) || false,
      [Controller.BUTTON_DOWN]: gp.buttons[13]?.pressed || (gp.axes[1] > 0.5) || false,
      [Controller.BUTTON_LEFT]: gp.buttons[14]?.pressed || (gp.axes[0] < -0.5) || false,
      [Controller.BUTTON_RIGHT]: gp.buttons[15]?.pressed || (gp.axes[0] > 0.5) || false,
    };

    for (const [btnStr, pressed] of Object.entries(states)) {
      const btn = Number(btnStr);
      if (pressed && !this.lastGamepadState[btn]) {
        this.handler.onButtonDown(btn);
      } else if (!pressed && this.lastGamepadState[btn]) {
        this.handler.onButtonUp(btn);
      }
      this.lastGamepadState[btn] = pressed;
    }
  }
}
