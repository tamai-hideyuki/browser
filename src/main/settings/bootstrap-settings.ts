import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export type WindowBounds = { x: number; y: number; width: number; height: number };

export type BootstrapSettings = {
  windowBounds?: WindowBounds;
};

const bootstrapPath = (): string =>
  path.join(app.getPath('userData'), 'bootstrap.json');

export const loadBootstrap = (): BootstrapSettings => {
  try {
    const raw = fs.readFileSync(bootstrapPath(), 'utf8');
    const parsed = JSON.parse(raw) as BootstrapSettings;
    return parsed ?? {};
  } catch {
    return {};
  }
};

export const saveBootstrap = (s: BootstrapSettings): void => {
  try {
    const file = bootstrapPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(s, null, 2), 'utf8');
  } catch {
    // 失敗しても致命ではない
  }
};
