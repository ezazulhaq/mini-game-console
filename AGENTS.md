# AI Agent Instructions for NES Mobile Emulator

## Architecture & Code Guidelines

This project strictly adheres to **SOLID principles** and **Object-Oriented Programming (OOP)** patterns. When contributing or modifying code, you must follow these rules:

1. **Single Responsibility Principle (SRP)**: 
   - UI components (like `App`) must act only as Controllers/Mediators. Do not place business logic, emulation loops, or direct database access inside the UI layer.
   - Distinct domains (Storage, Emulation, Input) must reside in their own dedicated services within `/src/app/core/services/`.

2. **Open/Closed Principle & Dependency Inversion**:
   - Always depend on abstract classes (e.g., `StorageService`, `EmulatorService`) rather than concrete implementations (e.g., `IndexedDbStorageService`). 
   - Register the concrete implementations in the providers array (`app.config.ts`).
   - If extending functionality (e.g., adding Cloud sync for saves), create a new implementation of the abstract base class rather than modifying the existing local storage implementation.

3. **State Management**:
   - Use Angular Signals (`signal`, `computed`) for all reactive state.
   - Keep state mutation localized and predictable.

4. **Styling**:
   - Use Tailwind CSS for all styling.
   - Maintain the mobile-first, edge-to-edge modern dark aesthetic. Avoid skeuomorphic box layouts.
