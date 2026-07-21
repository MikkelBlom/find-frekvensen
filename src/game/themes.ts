// Field-identity themes. Each theme maps a panel index to an { icon, name,
// accent } so every field on the TV has a clear, distinct identity a child can
// point at from across the room. Themes are swappable live from the debug panel
// and easy to extend — add an entry to THEMES.

import { accentForIndex } from "./tokens";
import type { FieldTheme } from "./types";

interface ThemeDef {
  id: string;
  label: string;
  /** Entries indexed by panel; must cover at least 10 fields. */
  entries: { icon: string; name: string }[];
}

const NUMBERS: ThemeDef = {
  id: "numbers",
  label: "Numre",
  entries: Array.from({ length: 10 }, (_, i) => ({
    icon: "📻",
    name: `Radio ${i + 1}`,
  })),
};

const ANIMALS: ThemeDef = {
  id: "animals",
  label: "Dyr",
  entries: [
    { icon: "🦊", name: "Ræven" },
    { icon: "🦉", name: "Uglen" },
    { icon: "🐢", name: "Skildpadden" },
    { icon: "🦁", name: "Løven" },
    { icon: "🐬", name: "Delfinen" },
    { icon: "🦋", name: "Sommerfuglen" },
    { icon: "🐙", name: "Blæksprutten" },
    { icon: "🦇", name: "Flagermusen" },
    { icon: "🐝", name: "Bien" },
    { icon: "🦕", name: "Dinoen" },
  ],
};

const SPACE: ThemeDef = {
  id: "space",
  label: "Rummet",
  entries: [
    { icon: "🚀", name: "Raketten" },
    { icon: "🛰️", name: "Satellitten" },
    { icon: "🌙", name: "Månen" },
    { icon: "⭐", name: "Stjernen" },
    { icon: "☄️", name: "Kometen" },
    { icon: "🪐", name: "Saturn" },
    { icon: "👽", name: "Rumvæsnet" },
    { icon: "🌍", name: "Jorden" },
    { icon: "🔭", name: "Teleskopet" },
    { icon: "☀️", name: "Solen" },
  ],
};

const PIONEERS: ThemeDef = {
  id: "pioneers",
  label: "Pionerer",
  entries: [
    { icon: "💡", name: "Ada" },
    { icon: "📡", name: "Hedy" },
    { icon: "🚀", name: "Katherine" },
    { icon: "🔬", name: "Marie" },
    { icon: "💻", name: "Grace" },
    { icon: "🧬", name: "Rosalind" },
    { icon: "📶", name: "Radia" },
    { icon: "🌌", name: "Vera" },
    { icon: "🧮", name: "Dorothy" },
    { icon: "🛰️", name: "Mary" },
  ],
};

export const THEMES: ThemeDef[] = [NUMBERS, ANIMALS, SPACE, PIONEERS];

export const DEFAULT_THEME_ID = "numbers";

/** Resolve the { icon, name, accent } identity for a panel index under a theme. */
export function fieldTheme(themeId: string, index: number): FieldTheme {
  const theme = THEMES.find((t) => t.id === themeId) ?? NUMBERS;
  const entry = theme.entries[index % theme.entries.length];
  return { icon: entry.icon, name: entry.name, accent: accentForIndex(index) };
}
