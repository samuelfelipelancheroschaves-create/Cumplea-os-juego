export type SaveData = {
  version: 1;
  best: Record<string, number>;
  cleared: string[];
  cards: string[];
  heardFinale: boolean;
};

const KEY = "para-ti-v1";

const EMPTY: SaveData = { version: 1, best: {}, cleared: [], cards: [], heardFinale: false };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, best: {}, cleared: [], cards: [] };
    const data = JSON.parse(raw) as SaveData;
    if (!data || data.version !== 1) return { ...EMPTY, best: {}, cleared: [], cards: [] };
    return {
      version: 1,
      best: data.best ?? {},
      cleared: data.cleared ?? [],
      cards: data.cards ?? [],
      heardFinale: !!data.heardFinale,
    };
  } catch {
    return { ...EMPTY, best: {}, cleared: [], cards: [] };
  }
}

export function writeSave(save: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(save));
}
