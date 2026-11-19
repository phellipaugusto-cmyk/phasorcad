export const DEBUG_PANELS_STORAGE_KEY =
  "phasorcad-show-debug-panels";

/*
 * Preferência de interface: exibir ou não os painéis
 * de depuração (CircuitGraph, matrizes e solução MNA).
 *
 * O padrão é ocultar, para uma tela limpa ao usuário.
 */
export function loadShowDebugPanels(): boolean {
  try {
    return (
      localStorage.getItem(
        DEBUG_PANELS_STORAGE_KEY
      ) === "true"
    );
  } catch {
    return false;
  }
}

export function saveShowDebugPanels(
  show: boolean
): void {
  try {
    localStorage.setItem(
      DEBUG_PANELS_STORAGE_KEY,
      String(
        show
      )
    );
  } catch {
    /* Preferência não essencial: ignora falhas de gravação. */
  }
}

export const CANVAS_ZOOM_STORAGE_KEY =
  "phasorcad-canvas-zoom";

/* Último zoom do Canvas (1 = 100%). */
export function loadCanvasZoom(): number {
  try {
    const saved = Number(
      localStorage.getItem(
        CANVAS_ZOOM_STORAGE_KEY
      )
    );

    return Number.isFinite(saved) && saved > 0
      ? saved
      : 1;
  } catch {
    return 1;
  }
}

export function saveCanvasZoom(
  zoom: number
): void {
  try {
    localStorage.setItem(
      CANVAS_ZOOM_STORAGE_KEY,
      String(zoom)
    );
  } catch {
    /* Preferência não essencial: ignora falhas de gravação. */
  }
}
