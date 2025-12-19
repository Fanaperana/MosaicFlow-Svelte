/**
 * Events API
 * 
 * Real-time event subscription for reactive updates.
 * This bridges Tauri events to the frontend.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from './bridge';
import {
  EventNames,
  type VaultEvent,
  type CanvasEvent,
  type WorkspaceEvent,
  type StateEvent,
  type HistoryEvent
} from './types';

// Event callback types
export type VaultEventCallback = (event: VaultEvent) => void;
export type CanvasEventCallback = (event: CanvasEvent) => void;
export type WorkspaceEventCallback = (event: WorkspaceEvent) => void;
export type StateEventCallback = (event: StateEvent) => void;
export type HistoryEventCallback = (event: HistoryEvent) => void;

// Event emitter for dev mode
class DevEventEmitter {
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();

  on(event: string, callback: (payload: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, payload: unknown): void {
    console.log(`[DEV EVENT] ${event}`, payload);
    this.listeners.get(event)?.forEach(cb => cb(payload));
  }
}

export const devEmitter = new DevEventEmitter();

// Generic event listener
async function subscribeToEvent<T>(
  eventName: string,
  callback: (payload: T) => void
): Promise<UnlistenFn> {
  if (!isTauri) {
    // Dev mode: use local emitter
    return devEmitter.on(eventName, callback as (payload: unknown) => void);
  }
  
  return listen<T>(eventName, (event) => {
    callback(event.payload);
  });
}

// Vault event subscriptions
export async function onVaultCreated(callback: VaultEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.VAULT_CREATED, callback);
}

export async function onVaultOpened(callback: VaultEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.VAULT_OPENED, callback);
}

export async function onVaultUpdated(callback: VaultEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.VAULT_UPDATED, callback);
}

export async function onVaultClosed(callback: VaultEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.VAULT_CLOSED, callback);
}

// Canvas event subscriptions
export async function onCanvasCreated(callback: CanvasEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.CANVAS_CREATED, callback);
}

export async function onCanvasOpened(callback: CanvasEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.CANVAS_OPENED, callback);
}

export async function onCanvasUpdated(callback: CanvasEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.CANVAS_UPDATED, callback);
}

export async function onCanvasClosed(callback: CanvasEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.CANVAS_CLOSED, callback);
}

export async function onCanvasDeleted(callback: CanvasEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.CANVAS_DELETED, callback);
}

// Workspace event subscriptions
export async function onWorkspaceLoaded(callback: WorkspaceEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.WORKSPACE_LOADED, callback);
}

export async function onWorkspaceSaved(callback: WorkspaceEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.WORKSPACE_SAVED, callback);
}

export async function onWorkspaceChanged(callback: WorkspaceEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.WORKSPACE_CHANGED, callback);
}

// State event subscriptions
export async function onStateChanged(callback: StateEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.STATE_CHANGED, callback);
}

export async function onHistoryChanged(callback: HistoryEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.HISTORY_CHANGED, callback);
}

// Subscribe to all vault events
export async function onAnyVaultEvent(callback: VaultEventCallback): Promise<UnlistenFn[]> {
  return Promise.all([
    onVaultCreated(callback),
    onVaultOpened(callback),
    onVaultUpdated(callback),
    onVaultClosed(callback),
  ]);
}

// Subscribe to all canvas events
export async function onAnyCanvasEvent(callback: CanvasEventCallback): Promise<UnlistenFn[]> {
  return Promise.all([
    onCanvasCreated(callback),
    onCanvasOpened(callback),
    onCanvasUpdated(callback),
    onCanvasClosed(callback),
    onCanvasDeleted(callback),
  ]);
}
