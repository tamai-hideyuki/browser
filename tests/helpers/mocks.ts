import { vi, type Mock } from 'vitest';
import type { ApiBridge, CommandChannel, CommandInput, CommandOutput, Events } from '@shared/types/ipc';

// ─── Broadcaster ────────────────────────────────────────────
export type MockBroadcaster = {
  emit: Mock<(event: Events) => void>;
  emittedEvents: Events[];
};

export const createMockBroadcaster = (): MockBroadcaster => {
  const events: Events[] = [];
  return {
    emit: vi.fn((e: Events) => { events.push(e); }) as MockBroadcaster['emit'],
    emittedEvents: events,
  };
};

// ─── window.api（shell 側用） ────────────────────────────────
export type MockApi = ApiBridge & {
  __invokeCalls: Array<{ channel: CommandChannel; input: unknown }>;
  __setHandler<K extends CommandChannel>(channel: K, fn: (input: CommandInput<K>) => CommandOutput<K> | Promise<CommandOutput<K>>): void;
  __emit(event: Events): void;
  __reset(): void;
};

export const installMockApi = (): MockApi => {
  const handlers = new Map<CommandChannel, (input: any) => any>();
  const listeners = new Set<(e: Events) => void>();
  const calls: MockApi['__invokeCalls'] = [];

  const api: MockApi = {
    invoke: vi.fn(async (channel, input) => {
      calls.push({ channel, input });
      const handler = handlers.get(channel);
      if (!handler) {
        throw new Error(`mock: no handler for "${channel}"`);
      }
      return handler(input);
    }) as ApiBridge['invoke'],
    on: (handler) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
    __invokeCalls: calls,
    __setHandler: <K extends CommandChannel>(
      channel: K,
      fn: (input: CommandInput<K>) => CommandOutput<K> | Promise<CommandOutput<K>>
    ) => {
      handlers.set(channel, fn as (input: any) => any);
    },
    __emit: (event: Events) => {
      for (const l of listeners) l(event);
    },
    __reset: () => {
      handlers.clear();
      listeners.clear();
      calls.length = 0;
    },
  };

  // window.api を上書き
  (globalThis as any).window = (globalThis as any).window ?? {};
  (globalThis as any).window.api = api;

  return api;
};
