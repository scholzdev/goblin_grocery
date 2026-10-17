// Build-lab launcher: `npm run buildlab -- --runs 50 --seed 1 --starter toaster --out buildlab-out/run.json`.
// The game's content registry uses import.meta.glob, which plain node cannot load, so the lab (tools/buildlab.ts -> src/buildlab) is loaded
// through Vite's own SSR loader (no extra dependency, no browser, no Phaser). See docs/buildlab.md.
import { createServer } from 'vite';

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  clearScreen: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false, watch: null },
});
let code = 0;
try {
  const mod = await server.ssrLoadModule('/tools/buildlab.ts');
  code = (await mod.main(process.argv.slice(2))) ?? 0;
} catch (e) {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  code = 1;
} finally {
  await server.close();
}
process.exit(code);
