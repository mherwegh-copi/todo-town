import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  probeWebGL,
  waitForWebGL,
  showOverlay,
  hideOverlay,
  installRuntimeRecovery,
} from '../../../src/systems/webglRecovery';

/** Minimal canvas stub whose getContext yields a context with a given lost state. */
function canvasWith(ctx: { isContextLost(): boolean } | null): HTMLCanvasElement {
  return { getContext: () => ctx } as unknown as HTMLCanvasElement;
}

/** Event-emitter stub matching the slice of Phaser's renderer we depend on. */
function fakeRenderer() {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    on(event: string, fn: () => void) {
      (handlers[event] ??= []).push(fn);
    },
    emit(event: string) {
      (handlers[event] ?? []).forEach((f) => f());
    },
  };
}

describe('probeWebGL', () => {
  it('returns false when getContext returns a lost context', () => {
    const canvas = canvasWith({ isContextLost: () => true });
    expect(probeWebGL(() => canvas)).toBe(false);
  });

  it('returns true when getContext returns a live context', () => {
    const canvas = canvasWith({ isContextLost: () => false });
    expect(probeWebGL(() => canvas)).toBe(true);
  });

  it('returns false when getContext returns null', () => {
    expect(probeWebGL(() => canvasWith(null))).toBe(false);
  });

  it('returns false when canvas creation throws', () => {
    expect(
      probeWebGL(() => {
        throw new Error('no canvas');
      }),
    ).toBe(false);
  });
});

describe('waitForWebGL', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves true immediately when probe already passes', async () => {
    await expect(
      waitForWebGL({ probe: () => true, timeoutMs: 1000, intervalMs: 100 }),
    ).resolves.toBe(true);
  });

  it('resolves true once probe flips to true', async () => {
    let alive = false;
    const promise = waitForWebGL({ probe: () => alive, timeoutMs: 1000, intervalMs: 100 });
    await vi.advanceTimersByTimeAsync(250);
    alive = true;
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe(true);
  });

  it('resolves false when probe never passes before timeout', async () => {
    const promise = waitForWebGL({ probe: () => false, timeoutMs: 500, intervalMs: 100 });
    await vi.advanceTimersByTimeAsync(600);
    await expect(promise).resolves.toBe(false);
  });
});

describe('overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('showOverlay adds an element carrying the message', () => {
    showOverlay('Rendu interrompu');
    const el = document.getElementById('webgl-overlay');
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain('Rendu interrompu');
  });

  it('showOverlay replaces the message on a second call instead of stacking', () => {
    showOverlay('first');
    showOverlay('second');
    expect(document.querySelectorAll('#webgl-overlay').length).toBe(1);
    expect(document.getElementById('webgl-overlay')!.textContent).not.toContain('first');
    expect(document.getElementById('webgl-overlay')!.textContent).toContain('second');
  });

  it('showOverlay with onReload renders a button that invokes the callback', () => {
    const onReload = vi.fn();
    showOverlay('dead', { onReload });
    const btn = document.querySelector<HTMLButtonElement>('#webgl-overlay button');
    expect(btn).not.toBeNull();
    btn!.click();
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('hideOverlay removes the element', () => {
    showOverlay('x');
    hideOverlay();
    expect(document.getElementById('webgl-overlay')).toBeNull();
  });
});

describe('installRuntimeRecovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the overlay when the renderer loses the WebGL context', () => {
    const renderer = fakeRenderer();
    installRuntimeRecovery({ renderer }, { reload: vi.fn() });
    expect(document.getElementById('webgl-overlay')).toBeNull();
    renderer.emit('losewebgl');
    expect(document.getElementById('webgl-overlay')).not.toBeNull();
  });

  it('hides the overlay when the renderer restores the context', () => {
    const renderer = fakeRenderer();
    installRuntimeRecovery({ renderer }, { reload: vi.fn() });
    renderer.emit('losewebgl');
    renderer.emit('restorewebgl');
    expect(document.getElementById('webgl-overlay')).toBeNull();
  });

  it('offers a reload button if the context is not restored within the watchdog window', () => {
    vi.useFakeTimers();
    try {
      const renderer = fakeRenderer();
      installRuntimeRecovery({ renderer }, { reload: vi.fn(), watchdogMs: 8000 });
      renderer.emit('losewebgl');
      expect(document.querySelector('#webgl-overlay button')).toBeNull();
      vi.advanceTimersByTime(8000);
      expect(document.querySelector('#webgl-overlay button')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
