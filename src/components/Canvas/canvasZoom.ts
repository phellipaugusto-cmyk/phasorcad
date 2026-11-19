/*
 * Zoom do Canvas. O circuito continua em coordenadas "lógicas"
 * (as mesmas do modelo, da grade e do roteador de fios); o zoom
 * só escala a exibição. Coordenadas do mouse (pixels da tela)
 * são divididas pelo zoom para voltar ao espaço lógico.
 */

export const ZOOM_MIN = 0.4;

export const ZOOM_MAX = 2.5;

export const ZOOM_DEFAULT = 1;

/* Degraus dos botões + e −. */
export const ZOOM_LEVELS = [
  0.4, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5,
];

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return ZOOM_DEFAULT;
  }

  return Math.min(
    ZOOM_MAX,
    Math.max(ZOOM_MIN, zoom)
  );
}

/* Próximo degrau acima (+1) ou abaixo (−1) do zoom atual. */
export function stepZoom(
  current: number,
  direction: 1 | -1
): number {
  const epsilon = 1e-6;

  if (direction === 1) {
    const next = ZOOM_LEVELS.find(
      (level) => level > current + epsilon
    );

    return next ?? ZOOM_MAX;
  }

  const lower = ZOOM_LEVELS.filter(
    (level) => level < current - epsilon
  );

  return lower.length > 0
    ? lower[lower.length - 1]
    : ZOOM_MIN;
}

/*
 * Zoom em que um circuito de largura × altura (em px lógicos)
 * cabe inteiro numa área visível de largura × altura (em px
 * da tela). Nunca amplia além de 100%.
 */
export function fitZoom(
  contentWidth: number,
  contentHeight: number,
  availableWidth: number,
  availableHeight: number
): number {
  if (
    contentWidth <= 0 ||
    contentHeight <= 0 ||
    availableWidth <= 0 ||
    availableHeight <= 0
  ) {
    return ZOOM_DEFAULT;
  }

  return clampZoom(
    Math.min(
      1,
      availableWidth / contentWidth,
      availableHeight / contentHeight
    )
  );
}

/* Posição na tela (px) → posição lógica no Canvas. */
export function toLogical(
  screenValue: number,
  zoom: number
): number {
  return screenValue / zoom;
}

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
