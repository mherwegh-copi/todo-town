// Survives WebGL context loss. Safari reclaims the GPU context of idle/background
// tabs; Phaser 4 is WebGL-only, so a lost context means a permanent black screen
// unless the app detects it at boot and reacts to loss/restore at runtime.

const OVERLAY_ID = 'webgl-overlay';
const LOSE_WEBGL = 'losewebgl';
const RESTORE_WEBGL = 'restorewebgl';
const DEFAULT_WATCHDOG_MS = 8000;

export interface WaitOptions {
  /** Returns true when a live WebGL context is available. */
  probe: () => boolean;
  /** Give up after this many milliseconds. */
  timeoutMs: number;
  /** Delay between probe attempts. */
  intervalMs: number;
}

/**
 * True only when a *live* (non-lost) WebGL context can be obtained.
 *
 * `getContext('webgl')` can return a truthy-but-already-lost context after Safari
 * reclaims the GPU — Phaser's own feature test only checks truthiness, so it is
 * fooled. Checking `isContextLost()` is what makes this probe reliable.
 */
export function probeWebGL(
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): boolean {
  try {
    const canvas = createCanvas();
    const ctx = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    return !!ctx && !ctx.isContextLost();
  } catch {
    return false;
  }
}

/** Polls `probe` until it passes, resolving false if the timeout elapses first. */
export function waitForWebGL(opts: WaitOptions): Promise<boolean> {
  const { probe, timeoutMs, intervalMs } = opts;
  return new Promise((resolve) => {
    if (probe()) {
      resolve(true);
      return;
    }
    let attemptsLeft = Math.max(1, Math.ceil(timeoutMs / intervalMs));
    const timer = setInterval(() => {
      attemptsLeft -= 1;
      if (probe()) {
        clearInterval(timer);
        resolve(true);
      } else if (attemptsLeft <= 0) {
        clearInterval(timer);
        resolve(false);
      }
    }, intervalMs);
  });
}

function applyOverlayStyle(el: HTMLElement): void {
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    background: 'rgba(14, 16, 20, 0.92)',
    color: '#f0f0f0',
    font: "15px system-ui, sans-serif",
    textAlign: 'center',
    zIndex: '9999',
  } satisfies Partial<CSSStyleDeclaration>);
}

/**
 * Shows (or updates) a full-screen overlay over the game. Passing `onReload`
 * adds a reload button — used once recovery is deemed hopeless.
 */
export function showOverlay(message: string, opts: { onReload?: () => void } = {}): HTMLElement {
  let el = document.getElementById(OVERLAY_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    applyOverlayStyle(el);
    document.body.appendChild(el);
  }
  el.textContent = '';

  const msg = document.createElement('div');
  msg.textContent = message;
  el.appendChild(msg);

  if (opts.onReload) {
    const btn = document.createElement('button');
    btn.textContent = 'Recharger';
    Object.assign(btn.style, {
      padding: '8px 16px',
      background: '#2d6a4f',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      fontSize: '14px',
      cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>);
    btn.addEventListener('click', opts.onReload);
    el.appendChild(btn);
  }
  return el;
}

/** Removes the overlay if present. */
export function hideOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

/** The slice of Phaser's renderer this module depends on. */
export interface MinimalRenderer {
  on(event: string, fn: () => void): void;
}

export interface MinimalGame {
  renderer: MinimalRenderer;
}

export interface RuntimeRecoveryOptions {
  /** Invoked by the reload button. Defaults to a full page reload. */
  reload?: () => void;
  /** How long to wait for a restore before offering a manual reload. */
  watchdogMs?: number;
}

/**
 * Wires the running game's renderer to the recovery overlay: shows it when the
 * WebGL context is lost, hides it once Phaser restores the context (Phaser 4
 * re-uploads textures itself), and offers a manual reload if restore stalls.
 */
export function installRuntimeRecovery(game: MinimalGame, opts: RuntimeRecoveryOptions = {}): void {
  const reload = opts.reload ?? (() => window.location.reload());
  const watchdogMs = opts.watchdogMs ?? DEFAULT_WATCHDOG_MS;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  game.renderer.on(LOSE_WEBGL, () => {
    showOverlay('Rendu interrompu — récupération en cours…');
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      showOverlay("Le rendu graphique n'a pas pu reprendre.", { onReload: reload });
    }, watchdogMs);
  });

  game.renderer.on(RESTORE_WEBGL, () => {
    if (watchdog) clearTimeout(watchdog);
    hideOverlay();
  });
}
