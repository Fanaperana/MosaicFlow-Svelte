import { ask } from '@tauri-apps/plugin-dialog';

/** Native warning dialog; window.confirm is not reliable in every desktop webview. */
export async function confirmDanger(message: string, title: string, okLabel = 'Delete'): Promise<boolean> {
  try {
    return await ask(message, { title, kind: 'warning', okLabel, cancelLabel: 'Cancel' });
  } catch {
    return confirm(message);
  }
}
