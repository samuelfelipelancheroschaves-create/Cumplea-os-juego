export type Rect = { x: number; y: number; w: number; h: number };

export type SolidDef = Rect & { oneWay?: boolean };

export type MoverDef = Rect & {
  id: string;
  axis: "x" | "y";
  amp: number;
  period: number;
  phase?: number;
};

export type CoinDef = { id: string; x: number; y: number };

export type Spot = { id: string; x: number; y: number };

export type HintDef = { x: number; y: number; text: string };

export type BalloonDef = { x: number; y: number; tint: "rose" | "gold" | "sage" | "cream" };

export type LevelDef = {
  id: string;
  name: string;
  blurb: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  solids: SolidDef[];
  movers: MoverDef[];
  coins: CoinDef[];
  hazards: Rect[];
  checkpoints: Spot[];
  cards: Spot[];
  flag: Rect;
  killY: number;
  sky: "morning" | "garden" | "dusk";
  hints: HintDef[];
  balloons: BalloonDef[];
};

export type Input = {
  moveX: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  jumpReleased: boolean;
  drop: boolean;
};

export type GameEvent =
  | { type: "jump"; alt: boolean }
  | { type: "coin"; id: string }
  | { type: "card"; id: string }
  | { type: "checkpoint"; id: string }
  | { type: "dead" }
  | { type: "win" };
