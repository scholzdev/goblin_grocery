import { t } from '../i18n';
import { flow } from '../flow';
import { store } from '../state/store';
import { SimError } from '../sims/_sim';
import { simRegistry } from '../sims/_registry';

// Sims (src/sims): the `SIM <id>` tag, the notes toast on start, and the error card for an unknown or broken sim. See docs/sims.md.
let tag: HTMLElement, note: HTMLElement, err: HTMLElement;
let noteTimer = 0;

export function initSimTag(ui: HTMLElement): void {
  tag = document.createElement('div');
  tag.id = 'simtag';
  tag.className = 'sticker hidden';
  note = document.createElement('div');
  note.id = 'simnote';
  note.className = 'receipt hidden';
  note.addEventListener('click', () => note.classList.add('hidden'));
  err = document.createElement('div');
  err.id = 'simerror';
  err.className = 'overlay interactive hidden';
  err.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-sim-ok]')) err.classList.add('hidden'); });
  ui.append(tag, note, err);
  store.on('change', render);
  store.on('run-start', () => {
    clearTimeout(noteTimer);
    const notes = flow.sim?.notes;
    note.classList.toggle('hidden', !notes);
    if (!notes) return;
    note.textContent = notes;
    noteTimer = window.setTimeout(() => note.classList.add('hidden'), 12000);
  });
}

function render(): void {
  const sim = flow.sim, phase = store.state.phase;
  const show = !!sim && phase !== 'title';
  tag.classList.toggle('hidden', !show);
  if (show) tag.textContent = `${t('simTag', { id: sim.id })} · ${t('simRestart')}`;
  if (!show) note.classList.add('hidden');
}

/** A card with a title and one line per problem; the OK button (or a click on the backdrop button) closes it. */
export function showSimError(title: string, lines: string[]): void {
  err.replaceChildren();
  const card = document.createElement('div');
  card.className = 'receipt sim-error-card';
  const h = document.createElement('h2');
  h.textContent = title;
  const ul = document.createElement('ul');
  for (const l of lines) { const li = document.createElement('li'); li.textContent = l; ul.append(li); }
  const ok = document.createElement('button');
  ok.className = 'btn coral';
  ok.dataset.simOk = '1';
  ok.textContent = t('simOk');
  card.append(h, ul, ok);
  err.append(card);
  err.classList.remove('hidden');
}

/** Starts the sim `id` (or shows why it cannot). Used by `?sim=` and the Test Lab modal. */
export function launchSim(id: string): void {
  const sim = simRegistry.get(id);
  if (!sim) { showSimError(t('simUnknown', { id }), [`${t('simValid')}:`, ...simRegistry.ids]); return; }
  try {
    flow.startSim(sim);
  } catch (e) {
    if (e instanceof SimError) showSimError(t('simBroken', { id }), e.problems);
    else throw e;
  }
}
