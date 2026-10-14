import Phaser from 'phaser';
import { SVG_ASSETS, AUDIO_KEYS } from '../data/assets';
import { ITEM_IDS } from '../data/items';
import { store } from '../state/store';

const base = import.meta.env.BASE_URL;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const a of SVG_ASSETS) this.load.svg(a.key, `${base}assets/svg/${a.key}.svg`, { width: a.w, height: a.h });
    // Small rasterization of item icons for the in-cart props (avoids aliasing from heavy downscaling).
    for (const id of ITEM_IDS) this.load.svg(`prop_${id}`, `${base}assets/svg/icon_${id}.svg`, { width: 64, height: 64 });
    for (const k of AUDIO_KEYS) this.load.audio(k, `${base}assets/audio/${k}.wav`);
    this.load.on('progress', (v: number) => store.emit(`boot-progress:${Math.round(v * 100)}`));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('asset failed to load:', f.key));
  }

  async create(): Promise<void> {
    try {
      await Promise.all([document.fonts.load('32px "Luckiest Guy"'), document.fonts.load('16px Nunito'), document.fonts.load('800 16px Nunito')]);
    } catch {
      /* fallback fonts are fine */
    }
    this.scene.start('Arena');
    store.emit('boot-ready');
  }
}
