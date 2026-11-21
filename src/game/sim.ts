import {
  ACCEL,
  AIR_ACCEL,
  APEX_BAND,
  BUFFER,
  COYOTE,
  DJUMP_V,
  GRAV_APEX,
  GRAV_DOWN,
  GRAV_UP,
  JUMP_V,
  MAX_FALL,
  PLAYER_H,
  PLAYER_W,
  SPEED,
} from "./constants.ts";
import type { GameEvent, Input, LevelDef, Rect } from "./types.ts";

export type Collider = Rect & { oneWay: boolean; moverId?: string };

export type Mover = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  baseX: number;
  baseY: number;
  axis: "x" | "y";
  amp: number;
  period: number;
  phase: number;
  dx: number;
  dy: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  grav: number;
};

export type Player = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  onMover: string | null;
  onOneWay: boolean;
  coyote: number;
  buffer: number;
  extraJumps: number;
  dropTimer: number;
  invuln: number;
  lock: number;
  alive: boolean;
};

export type World = {
  level: LevelDef;
  player: Player;
  movers: Mover[];
  collected: Set<string>;
  cardLatch: Set<string>;
  checkpoint: { x: number; y: number };
  checkpointId: string | null;
  time: number;
  shake: number;
  particles: Particle[];
  camX: number;
  camY: number;
  won: boolean;
};

export function emptyInput(): Input {
  return { moveX: 0, jumpPressed: false, jumpHeld: false, jumpReleased: false, drop: false };
}

function makePlayer(x: number, y: number): Player {
  return {
    x,
    y,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    onMover: null,
    onOneWay: false,
    coyote: COYOTE,
    buffer: 0,
    extraJumps: 1,
    dropTimer: 0,
    invuln: 0,
    lock: 0,
    alive: true,
  };
}

export function createWorld(level: LevelDef): World {
  return {
    level,
    player: makePlayer(level.spawn.x, level.spawn.y),
    movers: level.movers.map((m) => ({
      id: m.id,
      x: m.x,
      y: m.y,
      w: m.w,
      h: m.h,
      baseX: m.x,
      baseY: m.y,
      axis: m.axis,
      amp: m.amp,
      period: m.period,
      phase: m.phase ?? 0,
      dx: 0,
      dy: 0,
    })),
    collected: new Set(),
    cardLatch: new Set(),
    checkpoint: { ...level.spawn },
    checkpointId: null,
    time: 0,
    shake: 0,
    particles: [],
    camX: Math.max(0, level.spawn.x - 80),
    camY: Math.max(0, level.spawn.y - 120),
    won: false,
  };
}

export function respawn(world: World) {
  const p = world.player;
  p.x = world.checkpoint.x;
  p.y = world.checkpoint.y;
  p.vx = 0;
  p.vy = 0;
  p.grounded = true;
  p.onMover = null;
  p.onOneWay = false;
  p.coyote = COYOTE;
  p.buffer = 0;
  p.extraJumps = 1;
  p.dropTimer = 0;
  p.invuln = 3;
  p.lock = 3;
  p.alive = true;
  world.won = false;
  world.shake = 0;
}

export function getColliders(world: World): Collider[] {
  const list: Collider[] = world.level.solids.map((s) => ({
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h,
    oneWay: !!s.oneWay,
  }));
  for (const m of world.movers) {
    list.push({ x: m.x, y: m.y, w: m.w, h: m.h, oneWay: true, moverId: m.id });
  }
  return list;
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function burst(world: World, x: number, y: number, color: string, n: number, speed: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random());
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 20,
      life: 0.35 + Math.random() * 0.35,
      max: 0.7,
      color,
      size: 2 + Math.random() * 3,
      grav: 400,
    });
  }
  if (world.particles.length > 100) world.particles.splice(0, world.particles.length - 100);
}

function tickParticles(world: World, dt: number) {
  for (const p of world.particles) {
    p.life -= dt;
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
}

function moveMovers(world: World, dt: number) {
  world.time += dt;
  for (const m of world.movers) {
    const prevX = m.x;
    const prevY = m.y;
    const o = Math.sin((world.time / m.period) * Math.PI * 2 + m.phase);
    m.x = m.baseX + (m.axis === "x" ? o * m.amp : 0);
    m.y = m.baseY + (m.axis === "y" ? o * m.amp : 0);
    m.dx = m.x - prevX;
    m.dy = m.y - prevY;
  }
}

function resolveX(p: Player, cols: Collider[]) {
  for (let pass = 0; pass < 3; pass++) {
    for (const s of cols) {
      if (s.oneWay) continue;
      if (!overlaps(p, s)) continue;
      if (p.vx > 0) p.x = s.x - p.w;
      else if (p.vx < 0) p.x = s.x + s.w;
      else {
        const pushL = p.x + p.w - s.x;
        const pushR = s.x + s.w - p.x;
        p.x = pushL < pushR ? s.x - p.w : s.x + s.w;
      }
      p.vx = 0;
    }
  }
}

function resolveY(p: Player, cols: Collider[], prevBottom: number) {
  if (p.vy < 0) {
    for (const s of cols) {
      if (s.oneWay || !overlaps(p, s)) continue;
      const prevTop = prevBottom - p.h;
      if (prevTop >= s.y + s.h - 4) {
        p.y = s.y + s.h;
        p.vy = 0;
      }
    }
  }

  if (p.vy >= 0) {
    let landed: Collider | null = null;
    const feet = p.y + p.h;
    for (const s of cols) {
      if (p.dropTimer > 0 && s.oneWay) continue;
      if (p.x + p.w - 2 <= s.x || p.x + 2 >= s.x + s.w) continue;
      const wasAbove = prevBottom <= s.y + 1.5;
      const crossing = feet >= s.y - 0.5 && p.y < s.y;
      if (!wasAbove || !crossing) continue;
      if (!landed || s.y < landed.y) landed = s;
    }
    if (landed) {
      p.y = landed.y - p.h;
      p.vy = 0;
      p.grounded = true;
      p.onMover = landed.moverId ?? null;
      p.onOneWay = landed.oneWay;
      return;
    }
  }

  p.grounded = false;
  p.onMover = null;
  p.onOneWay = false;
}

function cardRect(spot: { x: number; y: number }): Rect {
  return { x: spot.x, y: spot.y, w: 52, h: 78 };
}

function flagHits(p: Player, flag: Rect) {
  return overlaps(p, flag);
}

export function step(world: World, input: Input, dt: number, mode: "play" | "freeze"): GameEvent[] {
  if (mode === "freeze") {
    world.time += dt;
    tickParticles(world, dt);
    world.shake = Math.max(0, world.shake - dt * 18);
    return [];
  }

  const events: GameEvent[] = [];
  const p = world.player;
  if (!p.alive || world.won) {
    tickParticles(world, dt);
    return events;
  }

  moveMovers(world, dt);
  if (p.onMover) {
    const m = world.movers.find((item) => item.id === p.onMover);
    if (m) {
      p.x += m.dx;
      p.y += m.dy;
    }
  }

  if (!p.grounded) p.coyote = Math.max(0, p.coyote - dt);
  p.dropTimer = Math.max(0, p.dropTimer - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.lock = Math.max(0, p.lock - dt);
  const locked = p.lock > 0;
  const moveX = locked ? 0 : input.moveX;
  const jumpPressed = locked ? false : input.jumpPressed;
  const jumpReleased = locked ? false : input.jumpReleased;
  const drop = locked ? false : input.drop;
  if (locked) p.vx = 0;
  if (jumpPressed) p.buffer = BUFFER;

  if (drop && !jumpPressed && p.grounded && p.onOneWay) {
    p.dropTimer = 0.2;
    p.grounded = false;
    p.onMover = null;
    p.onOneWay = false;
    p.y += 3;
    p.vy = 30;
  }

  let jumped = false;
  if (p.buffer > 0 && (p.grounded || p.coyote > 0)) {
    p.vy = JUMP_V;
    p.grounded = false;
    p.coyote = 0;
    p.onMover = null;
    p.buffer = 0;
    jumped = true;
    events.push({ type: "jump", alt: false });
    burst(world, p.x + p.w / 2, p.y + p.h, "#e7b189", 5, 70);
  } else if (p.buffer > 0 && !p.grounded && p.extraJumps > 0) {
    p.vy = DJUMP_V;
    p.extraJumps -= 1;
    p.buffer = 0;
    jumped = true;
    events.push({ type: "jump", alt: true });
    burst(world, p.x + p.w / 2, p.y + p.h / 2, "#e25b86", 7, 90);
  }
  if (!jumped) p.buffer = Math.max(0, p.buffer - dt);
  if (jumpReleased && p.vy < 0) p.vy *= 0.55;

  const target = moveX * SPEED;
  const rate = p.grounded ? ACCEL : AIR_ACCEL;
  const diff = target - p.vx;
  const max = rate * dt;
  p.vx += Math.sign(diff) * Math.min(Math.abs(diff), max);
  if (moveX !== 0) p.facing = moveX > 0 ? 1 : -1;

  if (!p.grounded) {
    let g = p.vy < 0 ? GRAV_UP : GRAV_DOWN;
    if (Math.abs(p.vy) < APEX_BAND) g = GRAV_APEX;
    p.vy = Math.min(MAX_FALL, p.vy + g * dt);
  }

  const cols = getColliders(world);
  p.x += p.vx * dt;
  resolveX(p, cols);
  const prevBottom = p.y + p.h;
  p.y += p.vy * dt;
  resolveY(p, cols, prevBottom);

  if (p.grounded && p.onMover) {
    const m = world.movers.find((item) => item.id === p.onMover);
    if (m) p.y = m.y - p.h;
  }

  if (p.grounded) {
    p.coyote = COYOTE;
    p.extraJumps = 1;
  }

  const body: Rect = { x: p.x + 3, y: p.y + 6, w: p.w - 6, h: p.h - 8 };
  if (p.invuln <= 0) {
    for (const hz of world.level.hazards) {
      if (overlaps(body, hz)) {
        p.alive = false;
        p.vx = 0;
        world.shake = 8;
        burst(world, p.x + p.w / 2, p.y + 20, "#e25b86", 12, 140);
        events.push({ type: "dead" });
        return events;
      }
    }
    if (p.y > world.level.killY) {
      p.alive = false;
      world.shake = 8;
      events.push({ type: "dead" });
      return events;
    }
  }

  for (const coin of world.level.coins) {
    if (world.collected.has(coin.id)) continue;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    if ((cx - coin.x) ** 2 + (cy - coin.y) ** 2 < 34 * 34) {
      world.collected.add(coin.id);
      burst(world, coin.x, coin.y, "#e4b23c", 6, 80);
      events.push({ type: "coin", id: coin.id });
    }
  }

  for (const spot of world.level.checkpoints) {
    const zone: Rect = { x: spot.x - 24, y: spot.y - 90, w: 72, h: PLAYER_H + 100 };
    if (overlaps(p, zone) && world.checkpointId !== spot.id) {
      world.checkpointId = spot.id;
      world.checkpoint = { x: spot.x, y: spot.y };
      burst(world, spot.x + 10, spot.y + 20, "#e4b23c", 8, 60);
      events.push({ type: "checkpoint", id: spot.id });
    }
  }

  for (const spot of world.level.cards) {
    const zone = cardRect(spot);
    if (overlaps(p, zone) && !world.cardLatch.has(spot.id)) {
      world.cardLatch.add(spot.id);
      events.push({ type: "card", id: spot.id });
    }
  }

  if (flagHits(p, world.level.flag)) {
    world.won = true;
    world.shake = 4;
    burst(world, world.level.flag.x + 16, world.level.flag.y + 20, "#e25b86", 16, 160);
    burst(world, world.level.flag.x + 16, world.level.flag.y + 30, "#e4b23c", 12, 140);
    events.push({ type: "win" });
  }

  tickParticles(world, dt);
  world.shake = Math.max(0, world.shake - dt * 18);
  return events;
}

export function updateCamera(world: World, viewW: number, viewH: number, dt: number) {
  const p = world.player;
  const focusX = p.x + p.w / 2 + p.facing * 36;
  const left = world.camX + viewW * 0.36;
  const right = world.camX + viewW * 0.58;
  let target = world.camX;
  if (focusX < left) target = focusX - viewW * 0.36;
  if (focusX > right) target = focusX - viewW * 0.58;
  const maxX = Math.max(0, world.level.width - viewW);
  target = Math.max(0, Math.min(maxX, target));
  const k = 1 - Math.exp(-3.2 * dt);
  world.camX += (target - world.camX) * k;

  const focusY = p.y + p.h * 0.35;
  const maxY = Math.max(0, world.level.height - viewH);
  const targetY = Math.max(0, Math.min(maxY, focusY - viewH * 0.58));
  world.camY += (targetY - world.camY) * (1 - Math.exp(-2.4 * dt));
}
