// Picture definitions for image-mode. Each picture is a self-contained SVG
// scene (works fully offline) that is split into a rows×cols grid. One tile is
// revealed per station found, and the whole picture assembles on completion.
//
// The number of stations in image-mode equals rows*cols for the active picture.

export interface PictureDef {
  id: string;
  label: string;
  cols: number;
  rows: number;
  /** viewBox is always "0 0 120 120". */
  svg: string;
}

const RADIO: PictureDef = {
  id: "radio",
  label: "Radio (2×2)",
  cols: 2,
  rows: 2,
  svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#12324a"/>
  <rect x="14" y="34" width="92" height="66" rx="8" fill="#c8843c"/>
  <rect x="14" y="34" width="92" height="66" rx="8" fill="none" stroke="#7a4d1e" stroke-width="3"/>
  <rect x="22" y="44" width="44" height="30" rx="4" fill="#0e1512"/>
  <rect x="24" y="46" width="40" height="26" rx="3" fill="#1f3c30"/>
  <line x1="28" y1="59" x2="60" y2="59" stroke="#e8d9b0" stroke-width="2"/>
  <polygon points="46,50 49,59 43,59" fill="#ff5a3c"/>
  <circle cx="84" cy="52" r="10" fill="#2a1c12"/>
  <circle cx="84" cy="52" r="10" fill="none" stroke="#e8d9b0" stroke-width="2"/>
  <circle cx="84" cy="80" r="8" fill="#2a1c12"/>
  <rect x="22" y="82" width="44" height="10" rx="3" fill="#7a4d1e"/>
  <line x1="90" y1="34" x2="104" y2="14" stroke="#c9b892" stroke-width="3" stroke-linecap="round"/>
  <circle cx="104" cy="14" r="4" fill="#ffd23f"/>
</svg>`,
};

const SATELLITE: PictureDef = {
  id: "satellite",
  label: "Satellit (3×2)",
  cols: 3,
  rows: 2,
  svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#0b1030"/>
  <circle cx="20" cy="24" r="1.5" fill="#fff"/>
  <circle cx="96" cy="18" r="1.5" fill="#fff"/>
  <circle cx="60" cy="12" r="1.2" fill="#fff"/>
  <circle cx="104" cy="46" r="1.4" fill="#fff"/>
  <circle cx="30" cy="96" r="26" fill="#2f6fb0"/>
  <path d="M8 92 q14 -8 26 0 t26 0" fill="#3f9b5a" opacity="0.8"/>
  <rect x="54" y="46" width="20" height="14" rx="2" fill="#c9c9d6"/>
  <rect x="34" y="49" width="20" height="8" rx="1.5" fill="#2b6cc4"/>
  <rect x="74" y="49" width="20" height="8" rx="1.5" fill="#2b6cc4"/>
  <line x1="64" y1="46" x2="64" y2="36" stroke="#c9c9d6" stroke-width="2"/>
  <circle cx="64" cy="34" r="3" fill="#ffd23f"/>
  <path d="M78 30 a16 16 0 0 1 12 12" fill="none" stroke="#ffd23f" stroke-width="2"/>
  <path d="M82 24 a24 24 0 0 1 18 18" fill="none" stroke="#ffd23f" stroke-width="2" opacity="0.6"/>
</svg>`,
};

const ROCKET: PictureDef = {
  id: "rocket",
  label: "Raket (2×3)",
  cols: 2,
  rows: 3,
  svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#0e1330"/>
  <circle cx="24" cy="20" r="1.5" fill="#fff"/>
  <circle cx="98" cy="30" r="1.5" fill="#fff"/>
  <circle cx="90" cy="90" r="1.5" fill="#fff"/>
  <circle cx="30" cy="70" r="1.2" fill="#fff"/>
  <path d="M60 14 q16 20 16 48 l-32 0 q0 -28 16 -48 z" fill="#e8e8ef"/>
  <path d="M60 14 q16 20 16 48 l-16 0 z" fill="#c7c7d4"/>
  <circle cx="60" cy="44" r="8" fill="#2b6cc4"/>
  <circle cx="60" cy="44" r="8" fill="none" stroke="#0e1330" stroke-width="2"/>
  <path d="M44 62 l-14 12 l14 0 z" fill="#ff5a3c"/>
  <path d="M76 62 l14 12 l-14 0 z" fill="#ff5a3c"/>
  <path d="M50 78 q10 22 20 0 q-4 12 -10 22 q-6 -10 -10 -22 z" fill="#ffb03a"/>
  <path d="M54 82 q6 14 12 0 q-2 8 -6 16 q-4 -8 -6 -16 z" fill="#ffd23f"/>
</svg>`,
};

export const PICTURES: PictureDef[] = [RADIO, SATELLITE, ROCKET];

export function getPicture(id: string): PictureDef {
  return PICTURES.find((p) => p.id === id) ?? RADIO;
}

export function pictureTileCount(id: string): number {
  const p = getPicture(id);
  return p.cols * p.rows;
}
