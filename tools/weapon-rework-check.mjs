// Focused end-to-end check of weapon families, shop rules and combo scrolling.
// Uses an isolated Chrome context and the existing dev bridge; never writes a real player profile.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
try {
  const base = await devUrl(process.argv[2]);
  for (const [width, height, locale = 'en-US'] of (process.argv.includes('--customer') ? [] : [[1280, 800], [1672, 941], [390, 844], [1280, 800, 'de-DE'], [2048, 997, 'de-DE']])) {
    const context = await browser.newContext({ viewport: { width, height }, locale });
    const suffix = locale === 'en-US' ? '' : '-de';
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector('#title:not(.hidden)').catch(async (error) => {
      await page.screenshot({ path: '/tmp/goblin-boot-error.png' });
      throw new Error(`${error.message}\nPage errors: ${JSON.stringify(errors)}\n${(await page.locator('body').innerText()).slice(0, 1000)}`);
    });
    await page.click('[data-act="codex"]');
    const familyOrder = ['hunter', 'spreader', 'primer', 'controller'];
    const comboFamilies = await page.locator('.codex-combo-group[data-weapon-family]').evaluateAll((groups) => groups.map((g) => g.dataset.weaponFamily));
    assert.deepEqual([...new Set(comboFamilies)], familyOrder);
    assert.ok(comboFamilies.every((family, i) => i === 0 || familyOrder.indexOf(family) >= familyOrder.indexOf(comboFamilies[i - 1])));
    await page.click('[data-tab="items"]');
    const catalog = await page.locator('.codex-item-group[data-weapon-family]').evaluateAll((groups) => groups.map((g) => ({
      family: g.dataset.weaponFamily, items: [...g.querySelectorAll('[data-card]')].map((tile) => tile.dataset.card),
    })));
    assert.deepEqual(catalog, [
      { family: 'hunter', items: ['toaster', 'nailgun', 'microwave', 'laser'] },
      { family: 'spreader', items: ['blender', 'fizz', 'cooker', 'popcorn'] },
      { family: 'primer', items: ['mop', 'spray', 'snowcone', 'tomato'] },
      { family: 'controller', items: ['pan', 'vacuum', 'leafblower'] },
    ]);
    const itemIds = await page.locator('.codex-item-groups [data-card]').evaluateAll((tiles) => tiles.map((tile) => tile.dataset.card));
    const total = Number((await page.locator('[data-tab="items"]').innerText()).match(/\/(\d+)/)[1]);
    assert.equal(itemIds.length, total); assert.equal(new Set(itemIds).size, total);
    await page.screenshot({ path: `/tmp/goblin-catalog-categories-${width}${suffix}.png` });
    const catalogScroll = await page.locator('.codex-item-groups').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      return { height: el.clientHeight, total: el.scrollHeight, scrolled: el.scrollTop };
    });
    assert.ok(catalogScroll.height > 0 && (catalogScroll.total <= catalogScroll.height || catalogScroll.scrolled > 0));
    await page.locator('[data-act="close-settings"]').click();
    await page.click('[data-act="play"]');
    assert.match(await page.locator('[data-weapon="toaster"]').innerText(), /Hunter|Jäger/i);
    const picker = await page.locator('.loadout-pick').boundingBox();
    assert.ok(picker.y >= 0 && picker.y + picker.height <= height + 1, JSON.stringify(picker));
    const role = await page.locator('[data-weapon="toaster"] .wp-role').boundingBox();
    assert.ok(role.width >= picker.width / 5, JSON.stringify(role));
    await page.screenshot({ path: `/tmp/goblin-weapons-picker-${width}${suffix}.png` });
    await page.evaluate(() => {
      const { flow, store, rules } = window.__gg;
      flow.startRun('toaster', 0, 'toaster', 'main');
      flow.endWave();
      const s = store.state;
      s.inventory.placed = [
        { uid: 'qa-hunter', type: 'toaster', tier: 1, x: 1, y: 1, rot: 0 },
        { uid: 'qa-primer', type: 'tomato', tier: 1, x: 0, y: 1, rot: 0 },
      ];
      s.inventory.shelf.fill(null);
      s.money = 100;
      s.shop.offers = [
        { slot: 0, type: 'fizz', tier: 1, price: 10, sold: false },
        { slot: 1, type: 'toaster', tier: 1, price: 10, sold: false },
        { slot: 2, type: 'fuel', tier: 1, price: 10, sold: false },
        { slot: 3, type: 'hotsauce', tier: 1, price: 10, sold: false },
      ];
      rules.recomputeBuild(s); store.changed();
    });
    await page.waitForSelector('#shop:not(.hidden)');
    assert.match(await page.locator('#shop .weapon-pair').innerText(), /Exploit|Ausnutzen/);
    assert.match(await page.locator('#shop .weapon-slots').innerText(), /2\/2/);
    await page.locator('#shop [data-offer="0"]').click();
    assert.equal(await page.evaluate(() => window.__gg.store.state.money), 100);
    await page.locator('#shop [data-offer="1"]').click();
    assert.equal(await page.evaluate(() => window.__gg.store.state.money), 90);
    // Long German names must not force the two-column offers grid wider than its shop column.
    await page.evaluate(() => {
      const { store } = window.__gg;
      store.state.shop.offers = ['fuel', 'bell', 'helmet', 'cooker'].map((type, slot) => ({ type, slot, tier: 1, sold: false, price: 10 }));
      store.changed();
    });
    await page.locator('#shop .offers .art').evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    const overflow = await page.evaluate(() => {
      const column = document.querySelector('#shop .col-right').getBoundingClientRect();
      return [...document.querySelectorAll('#shop .offers .card, #shop .offers .nm, #shop .offers .price-tag, #shop .shelf, #shop .services')].flatMap((el) => {
        const r = el.getBoundingClientRect();
        return r.right > Math.min(innerWidth, column.right + 12) + 1 || r.left < column.left - 1
          ? [{ text: el.textContent, right: r.right, viewport: innerWidth, columnRight: column.right }] : [];
      });
    });
    assert.deepEqual(overflow, [], `${width}x${height} ${locale}: shop content overflow`);
    await page.screenshot({ path: `/tmp/goblin-weapons-shop-top-${width}${suffix}.png` });
    const layout = await page.evaluate(() => {
      const panel = document.querySelector('#shop .combos'), cart = document.querySelector('#shop .grid-wrap');
      const before = cart.getBoundingClientRect().y;
      panel.scrollTop = panel.scrollHeight;
      return { height: panel.clientHeight, scrollHeight: panel.scrollHeight, scrolled: panel.scrollTop,
        bottom: panel.getBoundingClientRect().bottom, viewport: innerHeight, cartFixed: before === cart.getBoundingClientRect().y };
    });
    assert.ok(layout.height > 50, JSON.stringify(layout));
    if (layout.scrollHeight > layout.height) assert.ok(layout.scrolled > 0, JSON.stringify(layout));
    assert.ok(layout.cartFixed && layout.bottom <= layout.viewport + 1, JSON.stringify(layout));
    await page.screenshot({ path: `/tmp/goblin-weapons-shop-${width}${suffix}.png` });
    await page.evaluate(() => {
      const { flow, store } = window.__gg;
      flow.leaveShop(); flow.chooseDoor(store.state.doors[0]);
    });
    await page.waitForFunction(() => window.__gg.store.state.phase === 'combat');
    await page.waitForTimeout(700);
    console.log(`${width}x${height} ${locale}: families, pairing, purchase rules, scroll and combat transition passed`);
    await context.close();
  }
  for (const [width, height] of [[1280, 800], [2048, 997], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'de-DE' });
    await context.addInitScript(() => localStorage.setItem('goblin-grocery.settings.v1', JSON.stringify({ tutorialDone: true, hintSeen: true, tutorialSeen: ['sys', 'sys:sets', 'sets', 'merge'], reducedMotion: true })));
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector('#title:not(.hidden)');
    await page.evaluate(() => {
      const { flow, store, rules } = window.__gg;
      flow.startRun('toaster', 0, 'toaster', 'main');
      flow.endWave();
      const s = store.state;
      s.money = 60;
      s.inventory.placed = [
        { uid: 'shot-toaster', type: 'toaster', tier: 1, x: 1, y: 1, rot: 0 },
        { uid: 'shot-magnet', type: 'magnet', tier: 1, x: 0, y: 0, rot: 0 },
        { uid: 'shot-revive', type: 'insurance', tier: 1, x: 1, y: 0, rot: 0 },
      ];
      s.inventory.shelf.fill(null);
      s.shop.offers = ['soup', 'battery', 'tomato', 'fan'].map((type, slot) => ({ type, slot, tier: 1, price: 10, sold: false }));
      s.shop.customer = { uid: 'shot-toaster', type: 'toaster', tier: 1, price: rules.upgradeCost(s.inventory.placed[0]), status: 'offered' };
      rules.recomputeBuild(s); store.changed();
    });
    await page.waitForSelector('.customer-deal');
    const skipTutorial = page.locator('#tutorial .skip');
    if (await skipTutorial.count()) await skipTutorial.first().click();
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#shop img').evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode().catch(() => {}))));
    await page.mouse.move(2, 2);
    await page.screenshot({ path: `/tmp/goblin-customer-offer-${width}.png` });
    if (width === 1280) await page.locator('.customer-deal').screenshot({ path: '/tmp/goblin-customer-detail.png' });
    const overlap = await page.evaluate(() => {
      const bottom = document.querySelector('#shop .bottom').getBoundingClientRect();
      return ['.customer-deal', '.shelf', '.sell'].map((sel) => {
        const r = document.querySelector('#shop ' + sel).getBoundingClientRect();
        return { sel, bottom: r.bottom, limit: bottom.top, right: r.right, width: innerWidth };
      }).filter((r) => r.bottom > r.limit + 1 || r.right > r.width + 1);
    });
    console.log('Customer layout', width, JSON.stringify(overlap));
    assert.deepEqual(overlap, [], 'customer offer must leave the shelf and Next button accessible');
    const before = await page.evaluate(() => window.__gg.store.state.money);
    await page.locator('[data-act="reroll"]').click();
    assert.equal(await page.evaluate(() => window.__gg.store.state.shop.customer.status), 'offered');
    const money = await page.evaluate(() => window.__gg.store.state.money);
    const price = await page.evaluate(() => window.__gg.store.state.shop.customer.price);
    assert.ok(money <= before);
    await page.locator('[data-act="customer-accept"]').click();
    assert.deepEqual(await page.evaluate(() => ({ tier: window.__gg.store.state.inventory.placed[0].tier, money: window.__gg.store.state.money })), { tier: 2, money: money - price });
    await page.mouse.move(2, 2);
    await page.screenshot({ path: `/tmp/goblin-customer-accepted-${width}.png` });
    await page.evaluate(() => {
      const { store, rules } = window.__gg;
      store.state.shop.customer = { uid: 'shot-toaster', type: 'toaster', tier: 2, price: rules.upgradeCost(store.state.inventory.placed[0]), status: 'offered' };
      store.changed();
    });
    await page.locator('[data-act="customer-decline"]').click();
    assert.equal(await page.evaluate(() => window.__gg.store.state.shop.customer.status), 'declined');
    if (width === 1280) {
      await page.evaluate(() => {
        const { flow, store } = window.__gg;
        store.state.hp = 17.123456789;
        flow.victory();
      });
      await page.waitForSelector('.endcard');
      assert.match(await page.locator('.endscore .score').innerText(), /\d+\.\d{2}\s/);
      await page.screenshot({ path: '/tmp/goblin-result-two-decimals.png' });
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
