/**
 * Events API
 * 
 * Real-time event subscription for reactive updates.
 * This bridges Tauri events to the frontend.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
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

// Generic event listener
async function subscribeToEvent<T>(
  eventName: string,
  callback: (payload: T) => void
): Promise<UnlistenFn> {
  return listen<T>(eventName, (event) => {
    callback(event.payload);
  });
}

// Vault event subscriptions
export async function onVaultUpdated(callback: VaultEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.VAULT_UPDATED, callback);
}

// Canvas event subscriptions
export async function onCanvasCreated(callback: CanvasEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.CANVAS_CREATED, callback);
}

export async function onCanvasUpdated(callback: CanvasEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.CANVAS_UPDATED, callback);
}

export async function onCanvasDeleted(callback: CanvasEventCallback): Promise<UnlistenFn> {
  return subscribeToEvent(EventNames.CANVAS_DELETED, callback);
}

// Workspace event subscriptions
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
