import type { CircuitElement } from "../core/CircuitElement";
import type { CircuitConnection } from "../core/CircuitConnection";
import { createCircuitTerminals } from "../core/CircuitTerminal";

/*
 * Exemplo "Bancada de Circuitos 2" (vídeo de 11/11/2026).
 *
 * Na bancada: multimedidor KWS-306, contator tripolar, interruptor
 * touch, duas lâmpadas e um motor de ventilador (sem hélice).
 * O medidor mostrou só as fases A e B energizadas (C = 0 V), então
 * o exemplo é um sistema 127/220 V a dois fios-fase + neutro:
 *
 *   Fase A (125,8 V ∠0°)    → comando (bobina do contator + touch)
 *   Fase B (129,1 V ∠−120°) → S1 → lâmpada 1 (60 W)
 *                            → S2 → lâmpada 2 (60 W)
 *                            → K1 (contato do contator) → motor
 *
 * Leituras do vídeo, com tudo ligado:
 *   A: 125,8 V, 8 W      B: 129,1 V, 167 W      C: 0 V
 *
 * O motor é genérico de ventilador: 127 V, 45 W no eixo, η = 35 %,
 * FP = 0,95 (capacitor permanente), girando a vazio (sem hélice).
 * O comando é aproximado por um resistor que dá os 8 W medidos.
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
    element("RCMD", "resistor", "Comando (bobina + touch)", 2000, 360, 40),

    element("VB", "source", "Fase B", 129.1, 40, 280, {
      phase: -120,
      measured: { voltage: 129.1, power: 167 },
    }),
    element("S1", "switch", "Interruptor 1", 0, 200, 200, { closed: true }),
    element("LP1", "lamp", "Lâmpada 1", 60, 360, 200, {
      lamp: { ratedVoltage: 127 },
    }),
    element("S2", "switch", "Interruptor 2", 0, 200, 320, { closed: true }),
    element("LP2", "lamp", "Lâmpada 2", 60, 360, 320, {
      lamp: { ratedVoltage: 127 },
    }),
    element("K1", "switch", "Contator K1", 0, 200, 440, { closed: true }),
    element("M1", "motor", "Motor do ventilador", 0.045, 360, 440, {
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
    wire("RCMD:right", "VA:left"),
    wire("LP1:right", "VB:left"),
    wire("LP2:right", "VB:left"),
    wire("M1:right", "VB:left"),

    /* Fase A → comando. */
    wire("VA:right", "RCMD:left"),

    /* Fase B → cargas. */
    wire("VB:right", "S1:left"),
    wire("VB:right", "S2:left"),
    wire("VB:right", "K1:left"),
    wire("S1:right", "LP1:left"),
    wire("S2:right", "LP2:left"),
    wire("K1:right", "M1:left"),
  ];

  return { elements, connections, frequency: BENCH_PRESET_FREQUENCY };
}
