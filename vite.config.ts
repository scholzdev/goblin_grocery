import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

// A git worktree under .claude/worktrees without its own node_modules resolves packages from the main checkout,
// which sits outside the worktree's Vite root, so fonts and other package assets would be refused.
const nodeModules = resolve(dirname(createRequire(import.meta.url).resolve('@fontsource/nunito/package.json')), '../..');

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1600 },
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), nodeModules] } },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
