// Small inline icons for the item card: plum 2px outline, flat palette fills.
const P = '#30203f';
const ico = (body: string, s = 20): string => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${P}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  bolt: (s?: number) => ico('<path d="M13 2 5 13.5h6L10 22l9-12h-6.5z" fill="#f5bd45"/>', s),
  grid: (s?: number) => ico('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="#6d5a86"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" fill="#6d5a86"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" fill="#6d5a86"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill="#6d5a86"/>', s),
  crate: (s?: number) => ico('<path d="M3 8 12 4l9 4v9l-9 4-9-4z" fill="#e8a455"/><path d="M3 8l9 4 9-4M12 12v9" /><path d="M7.5 6l9 4" />', s),
  burst: (s?: number) => ico('<path d="m12 2 2.2 5.2L19 4.5l-1.4 5.6L22 12l-4.4 1.9L19 19.5l-4.8-2.7L12 22l-2.2-5.2L5 19.5l1.4-5.6L2 12l4.4-1.9L5 4.5l4.8 2.7z" fill="#f2655a"/><circle cx="12" cy="12" r="3.2" fill="#f5bd45" stroke="none"/>', s),
  stopwatch: (s?: number) => ico('<path d="M9.5 2.5h5M12 2.5V5"/><circle cx="12" cy="13.5" r="8" fill="#cfe6fb"/><path d="M12 9v5l3 1.5"/>', s),
  crosshair: (s?: number) => ico('<circle cx="12" cy="12" r="7.5" fill="#d9f0e6"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/><circle cx="12" cy="12" r="1.2" fill="#30203f"/>', s),
  plus: (s?: number) => ico('<path d="M12 5v14M5 12h14" stroke-width="3.5"/>', s),
  wind: (s?: number) => ico('<path d="M3 9h11a3 3 0 1 0-3-3M3 15h14a3 3 0 1 1-3 3M3 12h7" stroke="#2b6d8f"/>', s),
  speed: (s?: number) => ico('<path d="M3 12h7M3 7h5M3 17h5" stroke="#2b6d8f"/><path d="M11 5l9 7-9 7z" fill="#cfe6fb"/>', s),
  flame: (s?: number) => ico('<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-7 1 1 2 2 2 3 1-2 1-5 1-8z" fill="#f2655a"/><path d="M12 22a3 3 0 0 1-3-3c0-2 3-3 3-6 1 2 3 3 3 6a3 3 0 0 1-3 3z" fill="#f5bd45" stroke="none"/>', s),
  snow: (s?: number) => ico('<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" stroke="#2b6d8f"/><circle cx="12" cy="12" r="3" fill="#cfe6fb"/>', s),
  heart: (s?: number) => ico('<path d="M12 21C5 15.5 3 12 3 8.8A4.8 4.8 0 0 1 12 6.5 4.8 4.8 0 0 1 21 8.8C21 12 19 15.5 12 21z" fill="#f2655a"/>', s),
  magnet: (s?: number) => ico('<path d="M5 3h4v9a3 3 0 0 0 6 0V3h4v9a7 7 0 0 1-14 0z" fill="#f2655a"/><path d="M5 7h4M15 7h4" stroke="#fff2d5"/>', s),
  shield: (s?: number) => ico('<path d="M12 2.5 20 6v6c0 5-3.5 8.5-8 9.5C7.5 20.5 4 17 4 12V6z" fill="#cfe6fb"/>', s),
  boot: (s?: number) => ico('<path d="M7 3h6v8l7 3v5H4V9a2 2 0 0 1 3-1z" fill="#c8884a"/><path d="M4 16h16"/>', s),
  coin: (s?: number) => ico('<circle cx="12" cy="12" r="9" fill="#f5bd45"/><path d="m12 7 1.5 3.2 3.5.4-2.6 2.4.7 3.4L12 14.6 8.9 16.4l.7-3.4L7 10.6l3.5-.4z" fill="#f2655a" stroke-width="1.2"/>', s),
  arrow: (s?: number) => ico('<path d="M4 9h9V5l8 7-8 7v-4H4z" fill="#8b7aa8"/>', s),
};

const SET_ICON: Record<string, string> = {
  kitchen: '<circle cx="9.5" cy="12" r="7"/><path d="M15.5 12H22" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>',
  cleaning: '<path d="M12 2.5S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.5 12 2.5z"/>',
  tools: '<path d="M15 2.5a6 6 0 0 0-5.6 8L3.2 16.7a2.4 2.4 0 0 0 3.4 3.4l6.2-6.2A6 6 0 0 0 21.5 9l-3.6 3.6-3-.8-.8-3L17.7 5.2A6 6 0 0 0 15 2.5z"/>',
  snacks: '<path fill-rule="evenodd" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 8.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM14.5 7.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM13 13.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8 14.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/>',
  checkout: '<path fill-rule="evenodd" d="M3 3h9l9 9-9 9-9-9zM7.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
  heat: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-7 1 1 2 2 2 3 1-2 1-5 1-8z"/>',
  frost: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8 20.2 7.2M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  blast: '<path d="m12 2 2.2 5.2L19 4.5l-1.4 5.6L22 12l-4.4 1.9L19 19.5l-4.8-2.7L12 22l-2.2-5.2L5 19.5l1.4-5.6L2 12l4.4-1.9L5 4.5l4.8 2.7z"/>',
  electric: '<path d="M13 2 5 13.5h6L10 22l9-12h-6.5z"/>',
};
/** Bold single-colour set icon (inline SVG, tints with the surrounding `color`). */
export const setIcon = (id: string, size = 14): string => `<svg class="sico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SET_ICON[id] ?? ''}</svg>`;

const MOD_ICON: Record<string, string> = {
  none: '<path d="M2 4h3l1.2 3"/><path d="M6.2 7H21l-2.4 8H8z" fill="#cfe6fb"/><circle cx="9.5" cy="19.5" r="1.8" fill="#30203f"/><circle cx="17" cy="19.5" r="1.8" fill="#30203f"/>',
  rush: '<path d="M2 10h5M1.5 14h5M3 18h4" stroke="#2b6d8f"/><path d="M9 7h5l2 4.5 5.5 2V18H9z" fill="#f2655a"/><path d="M9 15.5h12.5M12.5 7v3" />',
  clearance: '<path d="M3 12V3.5h8.5L21 13l-8 8z" fill="#f5bd45"/><circle cx="7.5" cy="7.5" r="1.6" fill="#fff2d5"/>',
  event: '<path d="M13 2 5 13.5h6L10 22l9-12h-6.5z" fill="#f5bd45"/>',
  quiet: '<path d="M19.5 15A8.5 8.5 0 1 1 9 4.5 7 7 0 0 0 19.5 15z" fill="#f5bd45"/><path d="m17 3.5.7 1.6 1.6.7-1.6.7L17 8.1l-.7-1.6-1.6-.7 1.6-.7z" fill="#fff2d5" stroke-width="1.2"/>',
  stockroom: '<path d="M3 8 12 4l9 4v9l-9 4-9-4z" fill="#e8a455"/><path d="M3 8l9 4 9-4M12 12v9"/><path d="M7.5 6l9 4"/>',
  coldRoom: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" stroke="#2b6d8f"/><circle cx="12" cy="12" r="3" fill="#cfe6fb"/>',
  vipAisle: '<path d="M3 17 2 7l5.5 4L12 4l4.5 7L22 7l-1 10z" fill="#f5bd45"/><path d="M3.5 20.5h17"/>',
};
/** Door/route icon for an aisle modifier, in the same plum-outline sticker style as `icons`. */
export const modIcon = (id: string, s = 64): string => ico(MOD_ICON[id] ?? '', s);
