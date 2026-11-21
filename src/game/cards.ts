// Placeholder letters. To drop in a real card later:
// 1. Add the image at public/cards/<id>.png
// 2. Add { "id": "<id>", "src": "/cards/<id>.png" } to public/cards/index.json
// The written lines stay as the fallback when no image is listed.

export type BirthdayCard = {
  id: string;
  kicker: string;
  title: string;
  lines: string[];
  sign: string;
};

export const CARDS: BirthdayCard[] = [
  {
    id: "carta-4",
    kicker: "Primera carta",
    title: "La chispa",
    lines: ["La chispa."],
    sign: "Para ti",
  },
  {
    id: "carta-1",
    kicker: "Segunda carta",
    title: "Lo que sentía",
    lines: ["Lo que sentía."],
    sign: "Para ti",
  },
  {
    id: "carta-5",
    kicker: "Tercera carta",
    title: "Porque tú",
    lines: ["Porque tú."],
    sign: "Para ti",
  },
  {
    id: "carta-2",
    kicker: "Cuarta carta",
    title: "Mi primer amor",
    lines: ["Mi primer amor."],
    sign: "Para ti",
  },
  {
    id: "carta-6",
    kicker: "Quinta carta",
    title: "Nuestro presente",
    lines: ["Nuestro presente."],
    sign: "Para ti",
  },
  {
    id: "carta-3",
    kicker: "Última carta",
    title: "Nuestro futuro",
    lines: ["Nuestro futuro."],
    sign: "Para ti",
  },
];

export function cardById(id: string): BirthdayCard | undefined {
  return CARDS.find((card) => card.id === id);
}

export type CardImageRef = { id: string; src: string };

export async function loadCardImages(): Promise<CardImageRef[]> {
  try {
    const res = await fetch("/cards/index.json");
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is CardImageRef =>
        !!item &&
        typeof item === "object" &&
        typeof (item as CardImageRef).id === "string" &&
        typeof (item as CardImageRef).src === "string",
    );
  } catch {
    return [];
  }
}
