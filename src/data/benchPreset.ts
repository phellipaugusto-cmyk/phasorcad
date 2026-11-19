import type { CircuitElement } from "../core/CircuitElement";
import type { CircuitConnection } from "../core/CircuitConnection";
import { createCircuitTerminals } from "../core/CircuitTerminal";

/*
 * Exemplo "Bancada de Circuitos 2" (vídeo de 11/11/2026).
 *
 * Na bancada: multimedidor KWS-306, contator tripolar, interruptor
 * touch de 3 teclas, duas lâmpadas e um motor de ventilador (sem
 * hélice). O medidor mostrou só as fases A e B energizadas (C = 0 V):
 * sistema 127/220 V com dois fios-fase + neutro.
 *
 * Automação (partida do motor com contato de selo):
 *
 *   Fase A (125,8 V ∠0°)    → módulo touch (consumo próprio, ~5 W)
 *                            → B0 desliga (NF) ─┬─ B1 liga (NA) ─┬─ bobina K1
 *                                               └─ selo K1 (NA) ──┘
 *   Fase B (129,1 V ∠−120°) → tecla 1 → lâmpada 1 (60 W)
 *                            → tecla 2 → lâmpada 2 (60 W)
 *                            → contato de força K1 (NA) → motor
 *
 * Um toque em B1 energiza K1; o selo (contato auxiliar de K1, em
 * paralelo com B1) mantém a bobina depois que B1 é solta. Um toque
 * em B0 interrompe a bobina, o selo abre e o motor para.
 *
 * Leituras do vídeo:
 *   tudo desligado: A = 125,4 V, 5 W     B = 129,3 V, 0 W
 *   tudo ligado:    A = 125,8 V, 8 W     B = 129,1 V, 167 W
 * O exemplo abre com tudo ligado (K1 já selado) e essas leituras.
 *
 * Motor genérico de ventilador: 127 V, 45 W no eixo, η = 35 %,
 * FP = 0,95 (capacitor permanente), a vazio (sem hélice).
 * Bobina: 8 VA de retenção, FP 0,35, 127 V.
 */

function element(
  id: string,
  type: CircuitElement["type"],
  label: string,
  value: number,
  x: number,
  y: number,
  extra: Partial<CircuitElement> = {}
): CircuitElement {
  return {
    id,
    type,
    label,
    value,
    x,
    y,
    terminals: createCircuitTerminals(id),
    ...extra,
  };
}

function wire(from: string, to: string): CircuitConnection {
  return {
    id: `bench-${from}-${to}`.replace(/[^a-zA-Z0-9-]/g, "-"),
    fromTerminalId: from,
    toTerminalId: to,
  };
}

export const BENCH_PRESET_FREQUENCY = 60;

export function createBenchPreset(): {
  elements: CircuitElement[];
  connections: CircuitConnection[];
  frequency: number;
} {
  const elements: CircuitElement[] = [
    element("VA", "source", "Fase A", 125.8, 40, 40, {
      measured: { voltage: 125.8, power: 8 },
    }),
    element("RT", "resistor", "Módulo touch", 3165, 400, 40),
    element("B0", "switch", "B0 Desliga", 0, 220, 170, {
      momentary: true,
      normallyClosed: true,
    }),
    element("B1", "switch", "B1 Liga", 0, 400, 170, { momentary: true }),
    element("K1S", "switch", "Selo K1", 0, 400, 290, { controlledBy: "K1" }),
    element("K1", "contactor", "Bobina K1", 8, 580, 170, {
      contactor: { ratedVoltage: 127, powerFactor: 0.35 },
      energized: true,
    }),

    element("VB", "source", "Fase B", 129.1, 40, 540, {
      phase: -120,
      measured: { voltage: 129.1, power: 167 },
    }),
    element("S1", "switch", "Touch tecla 1", 0, 220, 420, { closed: true }),
    element("LP1", "lamp", "Lâmpada 1", 60, 400, 420, {
      lamp: { ratedVoltage: 127 },
    }),
    element("S2", "switch", "Touch tecla 2", 0, 220, 540, { closed: true }),
    element("LP2", "lamp", "Lâmpada 2", 60, 400, 540, {
      lamp: { ratedVoltage: 127 },
    }),
    element("K1A", "switch", "Contato K1", 0, 220, 660, {
      controlledBy: "K1",
    }),
    element("M1", "motor", "Motor do ventilador", 0.045, 400, 660, {
      motor: {
        efficiency: 0.35,
        powerFactor: 0.95,
        ratedVoltage: 127,
        loadFactor: 0,
      },
    }),
  ];

  const connections: CircuitConnection[] = [
    /* Neutro comum. */
    wire("VA:left", "VB:left"),
    wire("RT:right", "VA:left"),
    wire("K1:right", "VA:left"),
    wire("LP1:right", "VB:left"),
    wire("LP2:right", "VB:left"),
    wire("M1:right", "VB:left"),

    /* Fase A → touch e comando com selo. */
    wire("VA:right", "RT:left"),
    wire("VA:right", "B0:left"),
    wire("B0:right", "B1:left"),
    wire("B0:right", "K1S:left"),
    wire("B1:right", "K1:left"),
    wire("K1S:right", "K1:left"),

    /* Fase B → cargas. */
    wire("VB:right", "S1:left"),
    wire("VB:right", "S2:left"),
    wire("VB:right", "K1A:left"),
    wire("S1:right", "LP1:left"),
    wire("S2:right", "LP2:left"),
    wire("K1A:right", "M1:left"),
  ];

  return { elements, connections, frequency: BENCH_PRESET_FREQUENCY };
}
