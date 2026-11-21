import type { LevelDef } from "./types.ts";
import type { World } from "./sim.ts";

const INK = "#3a241c";
const CREAM = "#fff8f1";
const ROSE = "#e25b86";
const GOLD = "#e4b23c";
const SAGE = "#6f9a78";

const SKY: Record<LevelDef["sky"], [string, string, string]> = {
  morning: ["#f8d7c2", "#f6c3c9", "#f3e2c4"],
  garden: ["#d7ebdd", "#f6e3c4", "#f7d0cf"],
  dusk: ["#e7c4d4", "#f0b7c4", "#f6d7b8"],
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  hero: HTMLImageElement | null,
  viewW: number,
  viewH: number,
) {
  const { level } = world;
  const [top, mid, bot] = SKY[level.sky];
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, top);
  sky.addColorStop(0.55, mid);
  sky.addColorStop(1, bot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, viewH);

  const sunX = viewW * 0.78 - world.camX * 0.05;
  const sunY = 54 + world.camY * 0.02;
  ctx.fillStyle = level.sky === "dusk" ? "#f2c1b0" : "#ffe1a8";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
  ctx.fill();

  drawHills(ctx, world, viewW, viewH);

  const shake = world.shake;
  const sx = shake ? (Math.random() - 0.5) * shake : 0;
  const sy = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.save();
  ctx.translate(-Math.round(world.camX) + sx, -Math.round(world.camY) + sy);

  drawRavine(ctx, level);
  drawBalloons(ctx, world);
  drawSkyParty(ctx, world);
  for (const solid of level.solids) drawSlab(ctx, solid.x, solid.y, solid.w, solid.h, false, solid.x);
  for (const mover of world.movers) drawSlab(ctx, mover.x, mover.y, mover.w, mover.h, true, mover.baseX);
  drawGroundParty(ctx, world);
  for (const hazard of level.hazards) drawThorns(ctx, hazard.x, hazard.y, hazard.w, hazard.h);
  for (const coin of level.coins) {
    if (!world.collected.has(coin.id)) drawCoin(ctx, coin.x, coin.y, world.time + coin.x);
  }
  for (const spot of level.checkpoints) {
    drawLantern(ctx, spot.x, spot.y + 62, world.checkpointId === spot.id, world.time);
  }
  for (const card of level.cards) drawEnvelope(ctx, card.x + 26, card.y + 70, world.time);
  drawFlag(ctx, level.flag.x + 8, level.flag.y + level.flag.h, world.time);
  for (const hint of level.hints) drawHint(ctx, hint.x, hint.y, hint.text);
  for (const particle of world.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.globalAlpha = 1;
  }
  drawHero(ctx, world, hero);
  drawConfetti(ctx, world, 0.55);
  ctx.restore();
}

function drawHills(ctx: CanvasRenderingContext2D, world: World, viewW: number, viewH: number) {
  const bands = [
    { color: world.level.sky === "garden" ? "#b7d7c4" : "#f0c3b4", y: viewH * 0.62, h: 80, parallax: 0.15 },
    { color: world.level.sky === "dusk" ? "#e7a0b4" : "#e7b89a", y: viewH * 0.72, h: 90, parallax: 0.28 },
  ];
  for (const band of bands) {
    ctx.fillStyle = band.color;
    ctx.beginPath();
    const offset = -world.camX * band.parallax;
    ctx.moveTo(-40, viewH);
    for (let x = -40; x <= viewW + 40; x += 28) {
      const wave = Math.sin((x + offset) * 0.02) * 16 + Math.sin((x + offset) * 0.008) * 22;
      ctx.lineTo(x, band.y + wave);
    }
    ctx.lineTo(viewW + 40, viewH);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRavine(ctx: CanvasRenderingContext2D, level: LevelDef) {
  ctx.fillStyle = level.sky === "garden" ? "#c98b8a" : "#d9898e";
  ctx.fillRect(0, level.killY - 40, level.width, level.height);
  ctx.fillStyle = "rgba(58,36,28,0.18)";
  ctx.fillRect(0, level.killY - 8, level.width, 10);
}

function drawBalloons(ctx: CanvasRenderingContext2D, world: World) {
  const tints = { rose: ROSE, gold: GOLD, sage: SAGE, cream: CREAM };
  world.level.balloons.forEach((balloon, i) => {
    const y = balloon.y + Math.sin(world.time * 1.3 + i) * 6;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(balloon.x, y + 16);
    ctx.lineTo(balloon.x, y + 46);
    ctx.stroke();
    ctx.fillStyle = tints[balloon.tint];
    ctx.beginPath();
    ctx.ellipse(balloon.x, y, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function drawSlab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cloud: boolean,
  seed: number,
) {
  ctx.fillStyle = "rgba(58,36,28,0.12)";
  ctx.fillRect(x + 3, y + 5, w, Math.min(h, 28));
  ctx.fillStyle = cloud ? "#fff6ea" : "#e7b189";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = CREAM;
  ctx.fillRect(x, y, w, Math.min(8, h));
  ctx.fillStyle = cloud ? GOLD : ROSE;
  ctx.fillRect(x, y + Math.min(8, h - 3), w, 3);
  if (!cloud && h > 40) {
    const sprinkles = ["#e25b86", "#e4b23c", "#fff8f1", "#6f9a78", "#f4b7c9"];
    for (let i = 0; i < Math.floor(w / 18); i++) {
      const sx = x + 6 + ((i * 17 + Math.floor(hash(seed + i) * 8)) % Math.max(1, w - 14));
      ctx.fillStyle = sprinkles[i % sprinkles.length];
      ctx.fillRect(sx, y + 2, 3, 2);
    }
  }
  const drips = Math.max(1, Math.floor(w / 28));
  ctx.fillStyle = cloud ? "#f0d48a" : "#f099b4";
  for (let i = 0; i < drips; i++) {
    const dx = 8 + ((i * 28 + Math.floor(hash(seed + i) * 10)) % Math.max(1, w - 16));
    const dh = 4 + Math.floor(hash(seed + i * 3) * 6);
    ctx.fillRect(x + dx, y + 10, 4, dh);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawThorns(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const n = Math.max(2, Math.round(w / 16));
  ctx.fillStyle = ROSE;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < n; i++) {
    const tx = x + (i + 0.5) * (w / n);
    ctx.beginPath();
    ctx.moveTo(tx - 7, y + h);
    ctx.lineTo(tx, y);
    ctx.lineTo(tx + 7, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const squash = 0.35 + Math.abs(Math.sin(t * 3)) * 0.65;
  const bob = Math.sin(t * 4) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(squash, 1);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff4cc";
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(2.2, 0);
  ctx.lineTo(0, 3.2);
  ctx.lineTo(-2.2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLantern(ctx: CanvasRenderingContext2D, x: number, foot: number, on: boolean, time: number) {
  const glow = on ? 0.35 + Math.sin(time * 4) * 0.08 : 0.12;
  ctx.fillStyle = `rgba(228,178,60,${glow})`;
  ctx.beginPath();
  ctx.arc(x + 10, foot - 28, on ? 22 : 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(x + 8, foot - 8, 4, 8);
  ctx.fillStyle = on ? GOLD : "#f0d7a4";
  roundRect(ctx, x, foot - 40, 20, 26, 4);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = ROSE;
  ctx.fillRect(x + 8, foot - 30, 4, 4);
}

function drawEnvelope(ctx: CanvasRenderingContext2D, x: number, foot: number, time: number) {
  const bob = Math.sin(time * 2.4) * 3;
  ctx.save();
  ctx.translate(x, foot + bob);
  ctx.fillStyle = "rgba(58,36,28,0.12)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4b7c9";
  roundRect(ctx, -18, -46, 36, 26, 3);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-18, -46);
  ctx.lineTo(0, -32);
  ctx.lineTo(18, -46);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(0, -34, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, foot: number, time: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(x, foot - 92, 4, 92);
  ctx.fillStyle = ROSE;
  ctx.beginPath();
  const wave = Math.sin(time * 4) * 4;
  ctx.moveTo(x + 4, foot - 90);
  ctx.lineTo(x + 42, foot - 76 + wave);
  ctx.lineTo(x + 4, foot - 60);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(x + 20, foot - 76 + wave * 0.4, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawHint(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = "700 14px Nunito, sans-serif";
  const width = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(255,248,241,0.92)";
  roundRect(ctx, x, y - 16, width + 16, 22, 8);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(text, x + 8, y);
}

const SKIN = "#d08a68";
const SKIN_EDGE = "#7a4e3c";
const HAIR = "#1c1622";
const HAIR_LIGHT = "#3c3848";
const GLASS = "#f4f1f8";
const BOW = "#f3a4c6";
const BOW_DARK = "#d46d98";
const SKIRT = "#f6b0ce";
const SKIRT_EDGE = "#c45d8c";
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function bone(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  color: string,
  edge: string,
) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * (radius + 1.15);
  const oy = (dx / len) * (radius + 1.15);
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.moveTo(x0 + ox, y0 + oy);
  ctx.lineTo(x1 + ox, y1 + oy);
  ctx.lineTo(x1 - ox, y1 - oy);
  ctx.lineTo(x0 - ox, y0 - oy);
  ctx.closePath();
  ctx.fill();
  disc(ctx, x0, y0, radius + 1.15, edge);
  disc(ctx, x1, y1, radius + 1.15, edge);
  const ix = (-dy / len) * radius;
  const iy = (dx / len) * radius;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0 + ix, y0 + iy);
  ctx.lineTo(x1 + ix, y1 + iy);
  ctx.lineTo(x1 - ix, y1 - iy);
  ctx.lineTo(x0 - ix, y0 - iy);
  ctx.closePath();
  ctx.fill();
  disc(ctx, x0, y0, radius, color);
  disc(ctx, x1, y1, radius * 0.85, "#e4aa86");
}

function drawShoe(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = SKIN_EDGE;
  ctx.beginPath();
  ctx.ellipse(x + 1.4, y - 2.6, 5.4, 3.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 4.4, y - 2, 10.4, 2.6);
  ctx.fillStyle = BOW;
  ctx.beginPath();
  ctx.ellipse(x + 1.5, y - 3.3, 4.6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 3.6, y - 3.1, 9, 2.2);
  ctx.fillStyle = "#fff4f8";
  ctx.fillRect(x - 1.5, y - 4.6, 5, 1.15);
  ctx.fillStyle = "#fff8f1";
  ctx.fillRect(x - 4.2, y - 1.15, 9.6, 1.45);
}

function limbPose(phase: number, amp: number, airborne: boolean, rising: boolean) {
  if (airborne) {
    const tuck = rising ? 1 : 0.4;
    return { fx: 4 + tuck * 2, fy: -6 - tuck * 4, kx: 2.2, ky: -14 - tuck };
  }
  const s = Math.sin(phase);
  const lift = Math.pow(Math.max(0, Math.cos(phase)), 1.2);
  return {
    fx: s * amp,
    fy: -lift * (amp > 3 ? 7 : 1.6),
    kx: s * amp * 0.32 + (s >= 0 ? 1.6 : -0.2),
    ky: -12 - lift * 5,
  };
}

function drawPrettyLeg(
  ctx: CanvasRenderingContext2D,
  pose: { fx: number; fy: number; kx: number; ky: number },
) {
  const hipX = 1.2;
  const hipY = -22;
  bone(ctx, hipX, hipY, hipX + pose.kx, pose.ky, 3.15, SKIN, SKIN_EDGE);
  bone(ctx, hipX + pose.kx, pose.ky, hipX + pose.fx, pose.fy - 2.4, 2.45, SKIN, SKIN_EDGE);
  drawShoe(ctx, hipX + pose.fx, pose.fy);
}

function drawPrettyArm(ctx: CanvasRenderingContext2D, phase: number, airborne: boolean, rising: boolean) {
  const shoulderX = -1.5;
  const shoulderY = -36;
  let hx = -Math.sin(phase) * 6.5;
  let hy = -24 + Math.abs(Math.sin(phase)) * 1.5;
  let ex = hx * 0.45;
  let ey = -30;
  if (airborne) {
    hx = rising ? -7 : -4;
    hy = rising ? -44 : -40;
    ex = -4;
    ey = -40;
  }
  bone(ctx, shoulderX, shoulderY, shoulderX + ex, ey, 2.3, "#2a2430", "#120e16");
  bone(ctx, shoulderX + ex, ey, shoulderX + hx, hy, 1.85, SKIN, SKIN_EDGE);
  disc(ctx, shoulderX + hx, hy, 2.15, SKIN_EDGE);
  disc(ctx, shoulderX + hx, hy, 1.55, SKIN);
}

function drawBow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = BOW_DARK;
  ctx.beginPath();
  ctx.ellipse(x - 4.2, y, 4.2, 2.6, -0.4, 0, Math.PI * 2);
  ctx.ellipse(x + 4.2, y + 0.4, 4.2, 2.6, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BOW;
  ctx.beginPath();
  ctx.ellipse(x - 4, y - 0.3, 3.4, 2, -0.4, 0, Math.PI * 2);
  ctx.ellipse(x + 4, y + 0.1, 3.4, 2, 0.5, 0, Math.PI * 2);
  ctx.fill();
  disc(ctx, x, y, 1.7, "#fff0f6");
  disc(ctx, x, y, 1.1, BOW_DARK);
}

function drawFerryHead(ctx: CanvasRenderingContext2D, sway: number, blink: boolean) {
  disc(ctx, -1 + sway, -50, 16.5, "#0c0a10");
  disc(ctx, -7 + sway * 1.15, -44, 11, HAIR);
  disc(ctx, 1 + sway, -58, 11.5, HAIR);
  disc(ctx, 7 + sway * 0.4, -49, 8.5, HAIR);
  disc(ctx, -9 + sway * 1.3, -38, 7, HAIR);
  disc(ctx, -2 + sway, -36, 6, HAIR);
  disc(ctx, 4 + sway * 0.5, -62, 4.5, HAIR);
  disc(ctx, -5 + sway, -60, 2.4, HAIR_LIGHT);
  disc(ctx, 2 + sway * 0.3, -54, 2, HAIR_LIGHT);

  disc(ctx, 6.2, -46, 8.4, SKIN_EDGE);
  disc(ctx, 6.4, -46.4, 7.4, SKIN);
  disc(ctx, 9.2, -44.2, 1.7, "#e4a090");

  ctx.strokeStyle = GLASS;
  ctx.lineWidth = 1.45;
  ctx.beginPath();
  ctx.moveTo(3.2, -47.2);
  ctx.lineTo(-1.5, -45.5);
  ctx.stroke();
  disc(ctx, 7.4, -47.6, 3.7, GLASS);
  disc(ctx, 7.4, -47.6, 2.45, SKIN);
  if (!blink) {
    disc(ctx, 7.8, -47.5, 1.25, "#2c2630");
    disc(ctx, 8.2, -48, 0.45, "#ffffff");
  } else {
    ctx.strokeStyle = SKIN_EDGE;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(5.6, -47.4);
    ctx.quadraticCurveTo(7.6, -46.2, 9.6, -47.5);
    ctx.stroke();
  }
  ctx.strokeStyle = GLASS;
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  ctx.arc(7.4, -47.6, 3.7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#a86454";
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  ctx.arc(9, -43.4, 1.7, 0.15, Math.PI - 0.4);
  ctx.stroke();

  drawBow(ctx, 8 + sway * 0.3, -61);
}

function drawHero(ctx: CanvasRenderingContext2D, world: World, _hero: HTMLImageElement | null) {
  const p = world.player;
  const running = p.grounded && Math.abs(p.vx) > 22;
  const airborne = !p.grounded;
  const rising = p.vy < -30;
  const phase = world.time * (running ? 11 : 2.1);
  const step = Math.sin(phase);
  const bob = running ? -2.6 * Math.pow(Math.max(0, Math.cos(phase)), 2) : Math.sin(world.time * 2.2) * 0.6;
  const squash = airborne ? (rising ? 1.08 : 0.94) : 1;
  const amp = running ? 8.2 : 1.4;
  const sway = running ? -step * 2.4 : Math.sin(world.time * 1.7) * 0.8;
  const blink = world.time % 3.8 < 0.12;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(p.x + p.w / 2, p.y + p.h + bob);
  ctx.scale(p.facing, squash);
  ctx.fillStyle = "rgba(42,24,32,0.18)";
  ctx.beginPath();
  ctx.ellipse(1, 1.5, running ? 12 : 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (p.invuln > 0 && Math.floor(world.time * 16) % 2 === 0) ctx.globalAlpha = 0.45;

  drawPrettyLeg(ctx, limbPose(phase + Math.PI, amp, airborne, rising));
  drawPrettyArm(ctx, phase + Math.PI, airborne, rising);

  ctx.fillStyle = SKIRT_EDGE;
  ctx.beginPath();
  ctx.moveTo(-7, -23);
  ctx.quadraticCurveTo(2, -20, 9, -23);
  ctx.lineTo(12 + sway * 0.7, -11);
  ctx.quadraticCurveTo(2, -8 + Math.abs(sway) * 0.15, -10 + sway * 0.35, -11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = SKIRT;
  ctx.beginPath();
  ctx.moveTo(-5.5, -23);
  ctx.quadraticCurveTo(2, -20.5, 7.5, -23);
  ctx.lineTo(10 + sway * 0.7, -12.2);
  ctx.quadraticCurveTo(2, -9.4, -8 + sway * 0.35, -12.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#fff0f6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-1, -21);
  ctx.lineTo(-2 + sway * 0.4, -12);
  ctx.moveTo(4, -21);
  ctx.lineTo(5 + sway * 0.5, -12);
  ctx.stroke();

  disc(ctx, 2, -33, 7.2, "#120e16");
  ctx.fillStyle = "#241e2a";
  ctx.fillRect(-4, -40, 12, 16);
  ctx.fillStyle = SKIN;
  ctx.fillRect(1, -42, 5, 5);
  disc(ctx, 3.5, -40, 3.2, SKIN);

  drawFerryHead(ctx, sway, blink);
  drawPrettyLeg(ctx, limbPose(phase, amp, airborne, rising));
  drawPrettyArm(ctx, phase, airborne, rising);
  ctx.restore();
}

const PARTY = ["#e25b86", "#e4b23c", "#fff8f1", "#6f9a78", "#f4b7c9"];

function drawStreamers(ctx: CanvasRenderingContext2D, world: World) {
  const { level, time } = world;
  for (let i = 0; i < 7; i++) {
    const x = 80 + ((i * 370 + Math.floor(hash(i + 4) * 80)) % Math.max(1, level.width - 120));
    ctx.strokeStyle = PARTY[i % PARTY.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let t = 0; t <= 16; t++) {
      const y = 30 + t * 11;
      const sway = Math.sin(time * 1.4 + i + t * 0.45) * 8;
      if (t === 0) ctx.moveTo(x + sway, y);
      else ctx.lineTo(x + sway, y);
    }
    ctx.stroke();
  }
}

function drawBunting(ctx: CanvasRenderingContext2D, world: World) {
  const { level, time } = world;
  for (let x = 30; x < level.width - 20; x += 250) {
    const y = 168 + hash(x) * 36;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 110, y + 28 + Math.sin(time + x) * 3, x + 220, y + 6);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const px = x + 18 + i * 34;
      const py = y + 8 + Math.sin((i / 5) * Math.PI) * 14;
      ctx.fillStyle = PARTY[(i + Math.floor(x)) % PARTY.length];
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 12, py);
      ctx.lineTo(px + 6, py + 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }
}

function drawConfetti(ctx: CanvasRenderingContext2D, world: World, alpha: number) {
  const { level, time } = world;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 42; i++) {
    const span = level.width + 40;
    const speed = 18 + hash(i + 2) * 36;
    const x = ((hash(i) * span + time * speed) % span) - 20;
    const y = hash(i + 5) * (level.killY - 30) + Math.sin(time * 1.6 + i) * 12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 1.2 + i);
    ctx.fillStyle = PARTY[i % PARTY.length];
    if (i % 3 === 0) ctx.fillRect(-2, -3, 4, 6);
    else if (i % 3 === 1) {
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(-3, -1.2, 6, 2.4);
    ctx.restore();
  }
  ctx.restore();
}

function blockedDecor(level: LevelDef, x: number) {
  if (Math.abs(x - level.spawn.x) < 78) return true;
  if (Math.abs(x - level.flag.x) < 70) return true;
  for (const spot of level.cards) if (Math.abs(x - spot.x) < 56) return true;
  for (const spot of level.checkpoints) if (Math.abs(x - spot.x) < 48) return true;
  for (const hazard of level.hazards) {
    if (x > hazard.x - 20 && x < hazard.x + hazard.w + 20) return true;
  }
  return false;
}

function inkBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.15;
  ctx.strokeRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8);
}

function drawGift(ctx: CanvasRenderingContext2D, x: number, y: number, tint: string) {
  inkBox(ctx, x - 8, y - 14, 16, 14, tint);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 1.4, y - 14, 2.8, 14);
  ctx.fillRect(x - 8, y - 8, 16, 2.4);
  ctx.beginPath();
  ctx.arc(x - 3, y - 16, 2.4, 0, Math.PI * 2);
  ctx.arc(x + 3, y - 16, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawCupcake(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  ctx.fillStyle = "#f4b7c9";
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 7, y);
  ctx.lineTo(x + 5, y - 8);
  ctx.lineTo(x - 5, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.15;
  ctx.stroke();
  ctx.fillStyle = "#fff6ee";
  ctx.beginPath();
  ctx.arc(x, y - 10, 6, Math.PI, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ROSE;
  ctx.beginPath();
  ctx.arc(x + 2, y - 12, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 0.6, y - 18, 1.3, 6);
  const flick = Math.sin(time * 9 + x) * 0.8;
  ctx.fillStyle = "#ffe1a8";
  ctx.beginPath();
  ctx.ellipse(x + flick, y - 20, 1.8, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCandles(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  for (let i = 0; i < 3; i++) {
    const cx = x - 8 + i * 8;
    inkBox(ctx, cx - 1.4, y - 16, 2.8, 16, i === 1 ? ROSE : "#fff6ee");
    const flick = Math.sin(time * 8 + i + x) * 0.7;
    ctx.fillStyle = "#ffe1a8";
    ctx.beginPath();
    ctx.ellipse(cx + flick, y - 19, 2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCake(ctx: CanvasRenderingContext2D, x: number, foot: number, time: number) {
  inkBox(ctx, x - 16, foot - 12, 32, 12, "#f4b7c9");
  inkBox(ctx, x - 12, foot - 22, 24, 11, "#fff6ee");
  ctx.fillStyle = ROSE;
  ctx.fillRect(x - 12, foot - 16, 24, 3);
  for (let i = 0; i < 3; i++) {
    const cx = x - 6 + i * 6;
    ctx.fillStyle = GOLD;
    ctx.fillRect(cx - 0.7, foot - 30, 1.4, 8);
    const flick = Math.sin(time * 8 + i) * 0.6;
    ctx.fillStyle = "#ffe1a8";
    ctx.beginPath();
    ctx.ellipse(cx + flick, foot - 32, 1.7, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = ROSE;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 118, y + 4);
  ctx.lineTo(x + 118, y + 24);
  ctx.lineTo(x, y + 28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(x, y + 8, 3, 0, Math.PI * 2);
  ctx.arc(x + 118, y + 12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.font = "700 13px Nunito, sans-serif";
  ctx.fillText("Feliz cumple", x + 10, y + 18);
}

function drawSkyParty(ctx: CanvasRenderingContext2D, world: World) {
  drawStreamers(ctx, world);
  drawBunting(ctx, world);
  drawConfetti(ctx, world, 0.85);
}

function drawGroundParty(ctx: CanvasRenderingContext2D, world: World) {
  const { level, time } = world;
  const grounds = level.solids.filter((solid) => solid.h > 80 && !solid.oneWay);
  for (const ground of grounds) {
    for (let x = ground.x + 54; x < ground.x + ground.w - 28; x += 128) {
      if (blockedDecor(level, x)) continue;
      const kind = hash(x * 0.17);
      if (kind < 0.38) drawGift(ctx, x, ground.y, PARTY[Math.floor(hash(x + 3) * PARTY.length)] ?? ROSE);
      else if (kind < 0.72) drawCupcake(ctx, x, ground.y, time);
      else drawCandles(ctx, x, ground.y, time);
    }
  }
  const start = grounds[0];
  if (start) drawBanner(ctx, start.x + 78, start.y - 108);
  drawCake(ctx, level.flag.x - 30, level.flag.y + level.flag.h, time);
}
