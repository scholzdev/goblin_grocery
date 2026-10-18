import Phaser from 'phaser';
import '@fontsource/luckiest-guy/400.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './ui/style.css';
import { BootScene } from './scenes/BootScene';
import { ArenaScene } from './scenes/ArenaScene';
import { flow } from './flow';
import { initAudio } from './audio/sfx';
import { initUi } from './ui/ui';
import { store } from './state/store';
import { BOT } from './lab';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 800,
  backgroundColor: '#B8DED2',
  // EXPAND: the 1280x800 arena always fits; extra width/height shows more of the store (no bars).
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, ArenaScene],
  banner: false,
});

flow.init(game);
initAudio(game);
initUi(game);

if (import.meta.env.DEV) import('./state/run').then((rules) => Object.assign(window, { __gg: { game, store, flow, rules } }));
if (BOT) import('./bot/bot').then((m) => m.startBot());
