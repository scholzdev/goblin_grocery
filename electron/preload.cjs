// Minimal, explicit bridge: the page gets three desktop actions and nothing else.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  quit: () => ipcRenderer.send('quit'),
  setFullscreen: (on) => ipcRenderer.send('set-fullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('is-fullscreen'),
});
