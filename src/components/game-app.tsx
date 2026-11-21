import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Coins,
  Flag,
  Pause,
  RotateCcw,
} from "lucide-react";
import { CARDS, cardById, loadCardImages, type CardImageRef } from "@/game/cards";
import { LEVELS, levelById } from "@/game/levels";
import { sfx, playFinale, stopFinale, unlockAudio } from "@/game/audio";
import { loadSave, writeSave, type SaveData } from "@/game/save";
import {
  createWorld,
  emptyInput,
  respawn,
  step,
  updateCamera,
  type World,
} from "@/game/sim";
import { drawWorld } from "@/game/draw";
import { STEP } from "@/game/constants";
import type { Input } from "@/game/types";

type Screen = "title" | "levels" | "play" | "album";
type Modal = null | "win" | "pause";

declare global {
  interface Window {
    __controlsTest?: {
      getX: () => number;
      getY: () => number;
      getSpeed: () => number;
      getYaw: () => number;
      setKeys: (codes: string[]) => void;
    };
  }
}

const primaryBtn =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-card bg-rose-deep px-5 text-lg font-extrabold text-cream shadow-lg active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";
const quietBtn =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-card border border-line bg-paper px-5 text-lg font-extrabold text-ink active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose";

export function GameApp() {
  const [screen, setScreen] = useState<Screen>("title");
  const [modal, setModal] = useState<Modal>(null);
  const [levelId, setLevelId] = useState(LEVELS[0]?.id ?? "porche");
  const [save, setSave] = useState<SaveData>({ version: 1, best: {}, cleared: [], cards: [], heardFinale: false });
  const [images, setImages] = useState<CardImageRef[]>([]);
  const [hud, setHud] = useState({ coins: 0, total: 0 });
  const [ready, setReady] = useState(false);
  const [cardNote, setCardNote] = useState(false);
  const [restNote, setRestNote] = useState(false);

  const worldRef = useRef<World | null>(null);
  const heroRef = useRef<HTMLImageElement | null>(null);
  const keysRef = useRef(new Set<string>());
  const touchRef = useRef({ left: false, right: false, jump: false });
  const prevJump = useRef(false);
  const pausedRef = useRef(false);
  const cardTimer = useRef(0);
  const restTimer = useRef(0);
  const pingCardRef = useRef(() => {});
  const pingRestRef = useRef(() => {});
  const saveRef = useRef(save);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenRef = useRef(screen);
  saveRef.current = save;
  screenRef.current = screen;
  pausedRef.current = modal !== null;
  pingCardRef.current = () => {
    setCardNote(true);
    window.clearTimeout(cardTimer.current);
    cardTimer.current = window.setTimeout(() => setCardNote(false), 3400);
  };
  pingRestRef.current = () => {
    setRestNote(true);
    window.clearTimeout(restTimer.current);
    restTimer.current = window.setTimeout(() => setRestNote(false), 3000);
  };

  useEffect(() => {
    const stored = loadSave();
    setSave(stored);
    void loadCardImages().then(setImages);
    const img = new Image();
    img.onload = () => {
      heroRef.current = img;
      setReady(true);
    };
    img.onerror = () => setReady(true);
    img.src = "/sprites/hero.png";
  }, []);

  useEffect(() => {
    const GAME = new Set([
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Space",
      "KeyA",
      "KeyD",
      "KeyW",
      "KeyS",
    ]);
    const down = (e: KeyboardEvent) => {
      if (GAME.has(e.code)) e.preventDefault();
      if (e.code === "Escape") {
        if (screenRef.current !== "play") return;
        setModal((current) => (current === "pause" ? null : current === null ? "pause" : current));
      }
      keysRef.current.add(e.code);
      unlockAudio();
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    const clear = () => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clear();
    });
    window.__controlsTest = {
      getX: () => worldRef.current?.player.x ?? 0,
      getY: () => worldRef.current?.player.y ?? 0,
      getSpeed: () => worldRef.current?.player.vx ?? 0,
      getYaw: () => worldRef.current?.player.facing ?? 1,
      setKeys: (codes) => {
        keysRef.current.clear();
        for (const code of codes) keysRef.current.add(code);
      },
    };
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      delete window.__controlsTest;
    };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("qa")) beginRef.current("porche");
    // mount-only QA hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginRef = useRef<(id: string) => void>(() => {});
  beginRef.current = (id: string) => {
    const level = levelById(id);
    if (!level) return;
    worldRef.current = createWorld(level);
    stopFinale();
    setLevelId(id);
    setModal(null);
    setCardNote(false);
    setRestNote(false);
    setHud({ coins: 0, total: level.coins.length });
    setScreen("play");
    prevJump.current = false;
    keysRef.current.clear();
    touchRef.current = { left: false, right: false, jump: false };
  };

  useEffect(() => {
    if (screen !== "play") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const readInput = (): Input => {
      const keys = keysRef.current;
      const touch = touchRef.current;
      let moveX = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft") || touch.left) moveX -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight") || touch.right) moveX += 1;
      moveX = Math.max(-1, Math.min(1, moveX));
      const jumpHeld = keys.has("KeyW") || keys.has("ArrowUp") || keys.has("Space") || touch.jump;
      const drop = keys.has("KeyS") || keys.has("ArrowDown");
      const jumpPressed = jumpHeld && !prevJump.current;
      const jumpReleased = !jumpHeld && prevJump.current;
      prevJump.current = jumpHeld;
      return { moveX, jumpHeld, jumpPressed, jumpReleased, drop };
    };

    const onEvent = (world: World) => {
      return (ev: ReturnType<typeof step>[number]) => {
        if (ev.type === "jump") {
          if (ev.alt) sfx.djump();
          else sfx.jump();
        } else if (ev.type === "coin") {
          sfx.coin();
          const count = world.collected.size;
          setHud({ coins: count, total: world.level.coins.length });
          const next = { ...saveRef.current, best: { ...saveRef.current.best } };
          next.best[world.level.id] = Math.max(next.best[world.level.id] ?? 0, count);
          saveRef.current = next;
          setSave(next);
          writeSave(next);
        } else if (ev.type === "checkpoint") {
          sfx.check();
        } else if (ev.type === "card") {
          sfx.card();
          if (!saveRef.current.cards.includes(ev.id)) {
            const next = { ...saveRef.current, cards: [...saveRef.current.cards, ev.id] };
            saveRef.current = next;
            setSave(next);
            writeSave(next);
            pingCardRef.current();
          }
        } else if (ev.type === "dead") {
          sfx.hurt();
          keysRef.current.clear();
          touchRef.current = { left: false, right: false, jump: false };
          prevJump.current = false;
          if (worldRef.current) respawn(worldRef.current);
          pingRestRef.current();
        } else if (ev.type === "win") {
          pausedRef.current = true;
          keysRef.current.clear();
          const count = world.collected.size;
          const cleared = saveRef.current.cleared.includes(world.level.id)
            ? saveRef.current.cleared
            : [...saveRef.current.cleared, world.level.id];
          const next = {
            ...saveRef.current,
            best: { ...saveRef.current.best },
            cleared,
          };
          next.best[world.level.id] = Math.max(next.best[world.level.id] ?? 0, count);
          const finished =
            LEVELS.every((item) => cleared.includes(item.id)) &&
            CARDS.every((item) => next.cards.includes(item.id));
          if (finished && !next.heardFinale) {
            void playFinale()?.then(() => {
              const heard = { ...saveRef.current, heardFinale: true };
              saveRef.current = heard;
              setSave(heard);
              writeSave(heard);
            });
          } else {
            sfx.win();
          }
          saveRef.current = next;
          setSave(next);
          writeSave(next);
          setHud({ coins: count, total: world.level.coins.length });
          setModal("win");
        }
      };
    };

    const frame = (now: number) => {
      const world = worldRef.current;
      const parent = canvas.parentElement;
      if (world && parent) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cssW = parent.clientWidth;
        const cssH = parent.clientHeight;
        const bw = Math.max(1, Math.round(cssW * dpr));
        const bh = Math.max(1, Math.round(cssH * dpr));
        if (canvas.width !== bw || canvas.height !== bh) {
          canvas.width = bw;
          canvas.height = bh;
        }
        const viewHBase = 340;
        const viewWMin = 300;
        const viewWMax = 560;
        const aspect = bw / Math.max(1, bh);
        let viewH = viewHBase;
        let viewW = viewH * aspect;
        if (viewW < viewWMin) {
          viewW = viewWMin;
          viewH = viewW / aspect;
        } else if (viewW > viewWMax) {
          viewW = viewWMax;
          viewH = viewW / aspect;
        }
        const input = readInput();
        const handle = onEvent(world);
        if (pausedRef.current || !world.player.alive || world.won) {
          for (const ev of step(world, emptyInput(), dt, "freeze")) handle(ev);
        } else {
          acc += dt;
          let first = true;
          let guard = 0;
          while (acc >= STEP && guard < 5) {
            const slice: Input = {
              ...input,
              jumpPressed: first && input.jumpPressed,
              jumpReleased: first && input.jumpReleased,
            };
            for (const ev of step(world, slice, STEP, "play")) handle(ev);
            first = false;
            guard += 1;
            acc -= STEP;
            if (pausedRef.current) break;
          }
        }
        updateCamera(world, viewW, viewH, dt);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(bw / viewW, 0, 0, bh / viewH, 0, 0);
          ctx.imageSmoothingEnabled = false;
          drawWorld(ctx, world, heroRef.current, viewW, viewH);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  const level = levelById(levelId) ?? LEVELS[0];
  const nextLevel = LEVELS[LEVELS.findIndex((item) => item.id === levelId) + 1];
  const complete =
    LEVELS.every((item) => save.cleared.includes(item.id)) &&
    CARDS.every((item) => save.cards.includes(item.id));
  const listen = () => {
    void playFinale()?.then(() => {
      if (saveRef.current.heardFinale) return;
      const heard = { ...saveRef.current, heardFinale: true };
      saveRef.current = heard;
      setSave(heard);
      writeSave(heard);
    });
  };

  const hold =
    (dir: "left" | "right" | "jump") => (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      unlockAudio();
      touchRef.current[dir] = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  const release = (dir: "left" | "right" | "jump") => () => {
    touchRef.current[dir] = false;
  };

  return (
    <main className={`h-dvh overflow-hidden text-ink ${screen === "title" ? "bg-[#f7a3b4]" : "bg-cream"}`}>
      {screen === "title" ? (
        <section className="cover-screen relative mx-auto flex w-full max-w-md flex-col items-center px-3 pb-8">
          <PixelHeart className="absolute top-16 left-3 size-8" />
          <PixelHeart className="absolute top-28 right-4 size-6 opacity-80" pale />
          <h1 className="cover-title relative">
            <span className="absolute -left-2 top-1 text-lg text-[#fff6c2]">✦</span>
            BIENVENIDA A TU JUEGO DE
            <br />
            CUMPLEAÑOS MI NIÑA
            <br />
            HERMOSA
            <span className="absolute -right-1 bottom-1 text-lg text-[#fff6c2]">✦</span>
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <PixelCake />
          </div>
          <p className="mt-1 flex items-center gap-2 font-[family-name:var(--font-pixel)] text-xl font-bold tracking-wide text-[#7a4d98]">
            <PixelHeart className="size-7" />
            PERSONAJE
            <PixelHeart className="size-5" />
          </p>
          <div className="mt-1 flex w-full items-end justify-center">
            <img src="/cover/ghost-l.png" alt="" className="cover-ghost -mr-3 mb-2" />
            <img
              src="/cover/portrait.png"
              alt="Ferry, con lentes blancos y un moño rosa"
              className="cover-portrait relative z-10"
            />
            <img src="/cover/ghost-r.png" alt="" className="cover-ghost -ml-2 mb-1" />
          </div>
          <p className="cover-name mt-1">
            ferry la ornitorrinca
            <br />
            <span className="text-[0.92em]">(la más hermosa del universo)</span>
            <PixelHeart className="ml-1 inline size-4 align-middle" />
          </p>
          <div className="mt-3 flex w-full flex-col items-center gap-3">
            <button
              type="button"
              className="gem-btn"
              onClick={() => {
                unlockAudio();
                setScreen("levels");
              }}
            >
              JUGAR
            </button>
            <button type="button" className="gem-btn" onClick={() => setScreen("album")}>
              CARTAS {save.cards.length}/{CARDS.length}
            </button>
          </div>
          <div className="relative mt-4 flex h-28 w-full items-end justify-center">
            <PixelHeart className="absolute bottom-6 left-6 size-10" />
            <PixelHeart className="absolute bottom-2 left-16 size-7" pale />
            <PixelHeart className="absolute right-6 bottom-8 size-10" />
            <PixelHeart className="absolute right-16 bottom-2 size-7" pale />
            <img src="/cover/cat.png" alt="" className="relative z-10 w-36 pixel" />
          </div>
        </section>
      ) : null}

      {screen === "levels" ? (
        <section className="mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto px-5 py-6">
          <button
            type="button"
            className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-rose-deep"
            onClick={() => setScreen("title")}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Volver
          </button>
          <h2 className="font-display text-4xl leading-none">El camino</h2>
          <p className="mt-2 text-muted">Tres mapas. Puedes entrar al que quieras.</p>
          <div className="mt-5 flex flex-col gap-3">
            {LEVELS.map((item, index) => {
              const cleared = save.cleared.includes(item.id);
              const best = save.best[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  className="flex min-h-20 items-center justify-between gap-3 rounded-card border border-line bg-paper px-4 py-3 text-left shadow-sm active:translate-y-px"
                  onClick={() => beginRef.current(item.id)}
                >
                  <span>
                    <span className="block text-xs font-extrabold text-rose-deep">0{index + 1}</span>
                    <span className="block font-display text-2xl leading-tight">{item.name}</span>
                    <span className="block text-sm text-muted">{item.blurb}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-extrabold text-muted">
                    {cleared ? <Flag className="size-4 text-sage" aria-label="Completado" /> : null}
                    <span className="inline-flex items-center gap-1">
                      <Coins className="size-3.5 text-gold" aria-hidden="true" />
                      {best ?? 0}/{item.coins.length}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {screen === "album" ? (
        <section className="mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto px-5 py-6">
          <button
            type="button"
            className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-rose-deep"
            onClick={() => setScreen("title")}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Volver
          </button>
          <h2 className="font-display text-4xl leading-none">Cartas</h2>
          <p className="mt-2 text-muted">Termina el nivel para verlas en el menú.</p>
          <div className="mt-5 flex flex-col gap-4 pb-24">
            {CARDS.map((item) => {
              const found = save.cards.includes(item.id);
              const home = LEVELS.find((level) => level.cards.some((spot) => spot.id === item.id));
              const readable = found && !!home && save.cleared.includes(home.id);
              const image = images.find((ref) => ref.id === item.id);
              return (
                <article key={item.id} className="rounded-card border border-line bg-paper p-4 shadow-sm">
                  {readable ? (
                    <Letter cardId={item.id} image={image?.src} compact />
                  ) : (
                    <div>
                      <p className="text-xs font-extrabold tracking-wide text-rose-deep">{item.kicker}</p>
                      <p className="mt-2 text-sm font-bold text-muted">
                        {found ? "Termina el nivel para verla en menú." : "Sigue cerrada, en el camino."}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {screen === "play" && level ? (
        <div className="relative flex h-full flex-col">
          <div className="relative min-h-0 flex-1 touch-none">
            <canvas ref={canvasRef} className="h-full w-full touch-none" aria-label="El camino" />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <div className="pointer-events-auto rounded-card bg-paper/90 px-3 py-2 text-sm font-extrabold text-ink shadow-sm">
                <span className="flex items-center gap-1">
                  <Coins className="size-4 text-gold" aria-hidden="true" />
                  {hud.coins}/{hud.total}
                </span>
                <span className="block text-xs font-bold text-muted">{level.name}</span>
              </div>
              <button
                type="button"
                className="pointer-events-auto grid size-12 place-items-center rounded-full bg-paper text-ink shadow-sm"
                aria-label="Pausa"
                onClick={() => setModal("pause")}
              >
                <Pause className="size-5" />
              </button>
            </div>
            {!ready ? (
              <p className="absolute bottom-3 left-3 text-xs font-bold text-muted">Preparando el camino…</p>
            ) : null}
            {cardNote || restNote ? (
              <div className="pointer-events-none absolute inset-x-3 top-24 flex flex-col gap-2">
                {cardNote ? (
                  <p className="rounded-card bg-paper/95 px-4 py-3 text-center text-sm font-extrabold text-ink shadow-md">
                    ¡Conseguiste una carta! Termina el nivel para verla en menú
                  </p>
                ) : null}
                {restNote ? (
                  <p className="rounded-card bg-paper/95 px-4 py-3 text-center text-sm font-extrabold text-ink shadow-md">
                    El checkpoint te cubre. Espera un momento.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="touch-dock flex items-end justify-between gap-3 bg-cream px-3 pt-2 pb-[max(3.4rem,calc(env(safe-area-inset-bottom)+2.6rem))]">
            <div className="flex gap-2">
              <Hold label="Izquierda" onDown={hold("left")} onUp={release("left")}>
                <ChevronLeft className="size-7" />
              </Hold>
              <Hold label="Derecha" onDown={hold("right")} onUp={release("right")}>
                <ChevronRight className="size-7" />
              </Hold>
            </div>
            <Hold label="Saltar" wide onDown={hold("jump")} onUp={release("jump")}>
              Saltar
            </Hold>
          </div>

          {modal === "win" ? (
            <Overlay>
              {complete ? (
                <>
                  <p className="text-center text-sm font-extrabold text-rose-deep">Terminaste el juego</p>
                  <h2 className="text-center font-display text-4xl leading-tight">Feliz cumpleaños</h2>
                  <p className="text-center text-muted">
                    Los tres mapas y todas las cartas. Hay un mensaje para ti.
                  </p>
                  <button type="button" className={primaryBtn} onClick={listen}>
                    Escuchar el mensaje
                  </button>
                  <button type="button" className={quietBtn} onClick={() => { setModal(null); setScreen("album"); }}>
                    Leer las cartas
                  </button>
                </>
              ) : (
                <>
                  <p className="text-center text-sm font-extrabold text-rose-deep">{level.name}</p>
                  <h2 className="text-center font-display text-4xl leading-tight">
                    {nextLevel ? "Llegaste" : "Feliz cumpleaños"}
                  </h2>
                  <p className="text-center text-muted">
                    {hud.coins}/{hud.total} monedas.
                    {nextLevel ? " Queda camino, y otra carta." : " Las cartas se quedan contigo."}
                  </p>
                  {nextLevel ? (
                    <button type="button" className={primaryBtn} onClick={() => beginRef.current(nextLevel.id)}>
                      {nextLevel.name}
                    </button>
                  ) : (
                    <button type="button" className={primaryBtn} onClick={() => { setModal(null); setScreen("album"); }}>
                      Leer las cartas
                    </button>
                  )}
                </>
              )}
              <button type="button" className={quietBtn} onClick={() => setScreen("levels")}>
                Elegir otro mapa
              </button>
            </Overlay>
          ) : null}

          {modal === "pause" ? (
            <Overlay>
              <h2 className="text-center font-display text-4xl">Pausa</h2>
              <button type="button" className={primaryBtn} onClick={() => setModal(null)}>
                Seguir
              </button>
              <button type="button" className={quietBtn} onClick={() => beginRef.current(levelId)}>
                Reiniciar nivel
              </button>
              <button type="button" className={quietBtn} onClick={() => { setModal(null); setScreen("album"); }}>
                Ver cartas
              </button>
              <button type="button" className={quietBtn} onClick={() => { setModal(null); setScreen("levels"); }}>
                Mapas
              </button>
            </Overlay>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function PixelHeart({ className, pale }: { className?: string; pale?: boolean }) {
  return (
    <svg viewBox="0 0 9 8" className={`pixel ${className ?? ""}`} aria-hidden="true">
      <path
        fill={pale ? "#f3b7cf" : "#c43b78"}
        d="M2 0h2v1H2zM5 0h2v1H5zM1 1h3v1H1zM5 1h3v1H5zM0 2h9v1H0zM0 3h9v1H0zM1 4h7v1H1zM2 5h5v1H2zM3 6h3v1H3zM4 7h1v1H4z"
      />
    </svg>
  );
}

function PixelCake() {
  return (
    <svg viewBox="0 0 16 14" className="pixel size-8" aria-hidden="true">
      <rect x="3" y="6" width="10" height="6" fill="#f6c1d4" stroke="#3a241c" />
      <rect x="4" y="4" width="8" height="3" fill="#fff6ee" stroke="#3a241c" />
      <rect x="7" y="1" width="2" height="3" fill="#e4b23c" />
      <rect x="6" y="0" width="4" height="2" fill="#ffe1a8" />
    </svg>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-ink/45 p-4 sm:items-center">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-card bg-cream p-4 shadow-xl">{children}</div>
    </div>
  );
}

function Letter({ cardId, image, compact }: { cardId: string; image?: string; compact?: boolean }) {
  const card = cardById(cardId);
  if (!card) return null;
  if (image) {
    return (
      <div className={compact ? "" : "px-1 pt-2"}>
        <p className="mb-2 text-center text-xs font-extrabold tracking-wide text-rose-deep">{card.kicker}</p>
        <img src={image} alt={card.title} className="w-full rounded-card" />
      </div>
    );
  }
  return (
    <div className={compact ? "" : "px-1 pt-2"}>
      <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-rose-deep font-display text-xl text-cream">
        {card.kicker.slice(0, 1)}
      </div>
      <p className="text-center text-xs font-extrabold tracking-wide text-rose-deep">{card.kicker}</p>
      <h3 className={`text-center font-display leading-tight ${compact ? "text-3xl" : "text-4xl"}`}>{card.title}</h3>
      <div className="mt-3 space-y-2 text-center text-base leading-relaxed text-ink">
        {card.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <p className="mt-3 text-right font-display text-lg italic text-muted">{card.sign}</p>
    </div>
  );
}

function Hold({
  label,
  wide,
  onDown,
  onUp,
  children,
}: {
  label: string;
  wide?: boolean;
  onDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onUp: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`grid min-h-16 place-items-center rounded-card bg-rose-deep font-extrabold text-cream shadow-lg ${wide ? "min-w-28 px-6 text-lg" : "size-16"}`}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  );
}
