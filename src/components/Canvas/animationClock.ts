import { useSyncExternalStore } from "react";

/*
 * Relógio único da animação (câmera lenta). Canvas e gráficos
 * de onda assinam o mesmo relógio, então ficam sincronizados e
 * só quem usa a fase é redesenhado a cada quadro.
 *
 * Fase φ = ωt: um ciclo elétrico dura ANIMATION_CYCLE_SECONDS.
 */

export const CLOCK_CYCLE_SECONDS = 4;

export interface ClockSnapshot {
  running: boolean;
  /* Fase em radianos, crescente. */
  phase: number;
}

let snapshot: ClockSnapshot = { running: false, phase: 0 };
let frameId = 0;
let startTime = 0;
let lastPaint = 0;

const listeners = new Set<() => void>();

function publish(next: ClockSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function tick(now: number) {
  /* ~30 quadros por segundo bastam e poupam CPU. */
  if (now - lastPaint >= 33) {
    lastPaint = now;

    publish({
      running: true,
      phase:
        ((now - startTime) / 1000 / CLOCK_CYCLE_SECONDS) * 2 * Math.PI,
    });
  }

  frameId = requestAnimationFrame(tick);
}

export function setAnimating(running: boolean) {
  if (running === snapshot.running) {
    return;
  }

  if (running) {
    startTime = performance.now();
    lastPaint = 0;
    publish({ running: true, phase: 0 });
    frameId = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(frameId);
    publish({ running: false, phase: snapshot.phase });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useAnimationClock(): ClockSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot
  );
}
