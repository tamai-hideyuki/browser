import type { BrowserWindow } from 'electron';
import type { Events } from '@shared/types/ipc';

export class Broadcaster {
  constructor(private getWindow: () => BrowserWindow | null) {}

  emit(event: Events): void {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('event', event);
  }
}
