import { contextBridge, ipcRenderer } from 'electron';
import type { ApiBridge, CommandChannel, CommandInput, CommandOutput, Events } from '@shared/types/ipc';

const api: ApiBridge = {
  invoke<K extends CommandChannel>(channel: K, input: CommandInput<K>): Promise<CommandOutput<K>> {
    return ipcRenderer.invoke(channel, input) as Promise<CommandOutput<K>>;
  },
  on(handler: (event: Events) => void): () => void {
    const listener = (_: unknown, payload: Events) => handler(payload);
    ipcRenderer.on('event', listener);
    return () => ipcRenderer.off('event', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
