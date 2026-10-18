// Electron shell for the desktop / Steam build. Serves dist/ over a private app:// scheme so
// every asset (SVG, WAV, fonts) loads exactly like on the web, with no file:// restrictions.
const { app, BrowserWindow, Menu, ipcMain, net, protocol } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    title: 'Goblin Grocery', backgroundColor: '#241932', show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.once('ready-to-show', () => win.show());
  // The game never navigates or opens windows; block both.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  // --lab: in-game Test Lab. GG_DEV_URL (set by `npm run app:dev`) loads the Vite dev server instead of dist/.
  const base = process.env.GG_DEV_URL || 'app://game/index.html';
  win.loadURL(process.argv.includes('--lab') ? `${base}${base.includes('?') ? '&' : '?'}lab=1` : base);
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const file = path.normalize(path.join(DIST, decodeURIComponent(new URL(req.url).pathname)));
    if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // macOS keeps a minimal app menu so Cmd+Q / Cmd+H work; other platforms get none.
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'windowMenu' }]) : null);
  ipcMain.on('quit', () => app.quit());
  ipcMain.on('set-fullscreen', (e, on) => BrowserWindow.fromWebContents(e.sender)?.setFullScreen(!!on));
  ipcMain.handle('is-fullscreen', (e) => BrowserWindow.fromWebContents(e.sender)?.isFullScreen() ?? false);
  createWindow();
});

app.on('window-all-closed', () => app.quit());
