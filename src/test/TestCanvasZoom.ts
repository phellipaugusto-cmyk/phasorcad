import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  fitZoom,
  formatZoom,
  stepZoom,
  toLogical,
} from "../components/Canvas/canvasZoom";

let failures = 0;

function expect(
  name: string,
  actual: number | string,
  expected: number | string
): void {
  const ok =
    typeof actual === "number" &&
    typeof expected === "number"
      ? Math.abs(actual - expected) < 1e-9
      : actual === expected;

  if (!ok) {
    failures++;
  }

  console.log(
    `${ok ? "OK    " : "FALHOU"} ${name}: ${actual} (esperado ${expected})`
  );
}

console.log("Zoom do Canvas");

expect("+ a partir de 100%", stepZoom(1, 1), 1.25);
expect("− a partir de 100%", stepZoom(1, -1), 0.8);
expect("+ no máximo", stepZoom(ZOOM_MAX, 1), ZOOM_MAX);
expect("− no mínimo", stepZoom(ZOOM_MIN, -1), ZOOM_MIN);
expect("+ entre degraus (110%)", stepZoom(1.1, 1), 1.25);
expect("− entre degraus (110%)", stepZoom(1.1, -1), 1);
expect("limita acima", clampZoom(9), ZOOM_MAX);
expect("limita abaixo", clampZoom(0.01), ZOOM_MIN);
expect("valor inválido volta a 100%", clampZoom(NaN), ZOOM_DEFAULT);

/* Circuito de 800×400 px lógicos em área de 400×400 px: 50%. */
expect("ajuste por largura", fitZoom(800, 400, 400, 400), 0.5);
expect("ajuste por altura", fitZoom(400, 1000, 800, 500), 0.5);
expect("não amplia além de 100%", fitZoom(100, 100, 800, 800), 1);
expect("ajuste com conteúdo vazio", fitZoom(0, 0, 800, 800), 1);
expect("ajuste limitado a 40%", fitZoom(5000, 100, 400, 400), ZOOM_MIN);

/* Arrastar 100 px na tela com zoom de 50% move 200 px lógicos. */
expect("mouse → lógico a 50%", toLogical(100, 0.5), 200);
expect("mouse → lógico a 200%", toLogical(100, 2), 50);
expect("formata 125%", formatZoom(1.25), "125%");
expect("formata 67%", formatZoom(0.67), "67%");

console.log(
  failures === 0
    ? "Zoom do Canvas: todos os testes passaram."
    : `Zoom do Canvas: ${failures} FALHA(S).`
);
