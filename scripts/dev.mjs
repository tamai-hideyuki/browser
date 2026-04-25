// 開発用ランナー: Vite dev サーバ + esbuild watch + electron 再起動
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let electronProc = null;
let viteServer = null;
let mainCtx = null;
let preloadCtx = null;
let isRestarting = false;
let exiting = false;

const PRELOAD_OUT = path.join(root, 'build/preload/index.cjs');
const MAIN_OUT = path.join(root, 'build/main/index.cjs');

async function startVite() {
  viteServer = await createServer({
    configFile: path.join(root, 'vite.config.ts'),
  });
  await viteServer.listen();
  const url = viteServer.resolvedUrls?.local?.[0]
    ?? `http://localhost:${viteServer.httpServer?.address()?.port ?? 5173}`;
  console.log(`[vite] dev server: ${url}`);
  return url;
}

async function buildPreloadOnce() {
  preloadCtx = await esbuild.context({
    entryPoints: [path.join(root, 'src/preload/index.ts')],
    outfile: PRELOAD_OUT,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron'],
    alias: { '@shared': path.resolve(root, 'src/shared') },
    sourcemap: 'inline',
  });
  await preloadCtx.rebuild();
  await preloadCtx.watch();
}

async function buildMainOnce() {
  mainCtx = await esbuild.context({
    entryPoints: [path.join(root, 'src/main/index.ts')],
    outfile: MAIN_OUT,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron', 'better-sqlite3'],
    alias: { '@shared': path.resolve(root, 'src/shared') },
    sourcemap: 'inline',
    plugins: [
      {
        name: 'restart-electron',
        setup(b) {
          b.onEnd((result) => {
            if (result.errors.length > 0) return;
            restartElectron();
          });
        },
      },
    ],
  });
  await mainCtx.rebuild();
  await mainCtx.watch();
}

function restartElectron() {
  if (isRestarting || exiting) return;
  isRestarting = true;
  if (electronProc) {
    try { electronProc.kill(); } catch {}
  }
  setTimeout(() => {
    spawnElectron();
    isRestarting = false;
  }, 200);
}

function spawnElectron() {
  if (exiting) return;
  const electronBin = path.join(root, 'node_modules/.bin/electron');
  electronProc = spawn(electronBin, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_DEV: '1', VITE_DEV_URL: process.env.VITE_DEV_URL },
  });
  electronProc.on('exit', (code) => {
    if (!exiting && !isRestarting) {
      console.log(`[electron] exited with code ${code}`);
      shutdown();
    }
  });
}

async function shutdown() {
  if (exiting) return;
  exiting = true;
  if (electronProc) try { electronProc.kill(); } catch {}
  if (mainCtx) await mainCtx.dispose();
  if (preloadCtx) await preloadCtx.dispose();
  if (viteServer) await viteServer.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const url = await startVite();
process.env.VITE_DEV_URL = url;
await buildPreloadOnce();
await buildMainOnce();
