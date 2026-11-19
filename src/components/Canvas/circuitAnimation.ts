import type {
  CircuitGraph,
} from "../../core/CircuitGraph";

import {
  isSourceType,
} from "../../core/CircuitElement";

import type {
  MnaElectricalResults,
} from "../../core/MnaElectricalResults";

import type {
  CircuitConnection,
} from "../../core/CircuitConnection";

import type {
  CircuitElement,
} from "../../core/CircuitElement";

/*
 * Animação "estilo Falstad" do Canvas.
 *
 * Os fasores do app são valores eficazes (RMS). Num instante
 * com fase φ = ωt (câmera lenta), cada grandeza vale
 *   x(φ) = √2·|X|·cos(φ + θ).
 *
 * - Fios: cor pela tensão instantânea do nó (verde positivo,
 *   vermelho negativo, cinza perto de zero), em relação à
 *   referência (GND).
 * - Componentes: pontos que andam no sentido da corrente. Em
 *   CA a carga que passou é a integral da corrente, então o
 *   deslocamento é proporcional a sen(φ + θ) e os pontos vão
 *   e voltam; a amplitude é proporcional ao módulo da corrente.
 */

export interface PhasorPeak {
  /* Valor de pico (√2 × eficaz). */
  peak: number;

  /* Ângulo do fasor, em radianos. */
  angle: number;
}

export interface AnimationModel {
  terminalVoltage: Record<string, PhasorPeak>;

  maxVoltagePeak: number;

  elementCurrent: Record<string, PhasorPeak>;
  /* Corrente de cada fio, no sentido fromTerminalId → toTerminalId. */
  connectionCurrent: Record<string, PhasorPeak>;

  maxCurrentPeak: number;
}

export interface FlowState {
  /* Deslocamento dos pontos em px, no sentido esquerda → direita. */
  offset: number;

  /* 0 a 1: intensidade relativa da corrente (some perto de 0). */
  strength: number;
}

export interface AnimationFrame {
  terminalColor: Record<string, string>;

  flow: Record<string, FlowState>;
  /* Pontos nos fios; offset > 0 = de fromTerminalId para toTerminalId. */
  wireFlow: Record<string, FlowState>;
}

/* Amplitude máxima do deslocamento dos pontos, em px. */
export const FLOW_MAX_OFFSET = 18;

/* Duração (s) de um ciclo na tela: câmera lenta. */
export const ANIMATION_CYCLE_SECONDS = 4;

const ZERO_COLOR = [156, 163, 175];

const POSITIVE_COLOR = [22, 163, 74];

const NEGATIVE_COLOR = [220, 38, 38];

function toPeak(
  value: { real: number; imaginary: number }
): PhasorPeak {
  return {
    peak:
      Math.SQRT2 *
      Math.hypot(value.real, value.imaginary),
    angle: Math.atan2(
      value.imaginary,
      value.real
    ),
  };
}

type Cx = { real: number; imaginary: number };

/*
 * Corrente em cada fio pela lei dos nós. Cada componente injeta
 * na rede de fios: +I no terminal direito e -I no esquerdo.
 * Em cada rede toma-se uma árvore geradora e a corrente de cada
 * fio é a soma das injeções da subárvore; fios fora da árvore
 * (laços só de fio) ficam com 0.
 */
export function computeWireCurrents(
  elements: CircuitElement[],
  connections: CircuitConnection[],
  currents: Record<string, Cx>
): Record<string, Cx> {
  const injection = new Map<string, Cx>();

  elements.forEach((element) => {
    const current = currents[element.id];

    if (!current) {
      return;
    }

    element.terminals.forEach((terminal) => {
      const sign =
        terminal.side === "right" ? 1 : -1;

      injection.set(terminal.id, {
        real: sign * current.real,
        imaginary: sign * current.imaginary,
      });
    });
  });

  const adjacency = new Map<
    string,
    { other: string; connection: CircuitConnection }[]
  >();

  const add = (
    a: string,
    b: string,
    connection: CircuitConnection
  ) => {
    const list = adjacency.get(a) ?? [];
    list.push({ other: b, connection });
    adjacency.set(a, list);
  };

  connections.forEach((connection) => {
    add(connection.fromTerminalId, connection.toTerminalId, connection);
    add(connection.toTerminalId, connection.fromTerminalId, connection);
  });

  const result: Record<string, Cx> = {};
  const visited = new Set<string>();

  adjacency.forEach((_list, root) => {
    if (visited.has(root)) {
      return;
    }

    const order: string[] = [];
    const parent = new Map<
      string,
      { id: string; connection: CircuitConnection }
    >();

    visited.add(root);
    const queue = [root];

    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);

      (adjacency.get(id) ?? []).forEach(
        ({ other, connection }) => {
          if (!visited.has(other)) {
            visited.add(other);
            parent.set(other, { id, connection });
            queue.push(other);
          }
        }
      );
    }

    const sum = new Map<string, Cx>();

    order.forEach((id) => {
      sum.set(id, { ...(injection.get(id) ?? { real: 0, imaginary: 0 }) });
    });

    for (let index = order.length - 1; index > 0; index--) {
      const id = order[index];
      const link = parent.get(id)!;
      const total = sum.get(id)!;

      /* total sai do nó `id` em direção ao pai. */
      const forward = link.connection.fromTerminalId === id ? 1 : -1;

      result[link.connection.id] = {
        real: forward * total.real,
        imaginary: forward * total.imaginary,
      };

      const up = sum.get(link.id)!;
      up.real += total.real;
      up.imaginary += total.imaginary;
    }
  });

  connections.forEach((connection) => {
    result[connection.id] ??= { real: 0, imaginary: 0 };
  });

  return result;
}

export function buildAnimationModel(
  graph: CircuitGraph,
  results: MnaElectricalResults,
  elements: CircuitElement[] = [],
  connections: CircuitConnection[] = []
): AnimationModel | null {
  if (!results.available) {
    return null;
  }

  const nodeVoltage: Record<string, PhasorPeak> = {};

  results.nodeVoltages.forEach((node) => {
    nodeVoltage[node.nodeId] = toPeak(node.voltage);
  });

  const terminalVoltage: Record<string, PhasorPeak> =
    {};

  Object.entries(graph.terminalToNodeId).forEach(
    ([terminalId, nodeId]) => {
      const voltage = nodeVoltage[nodeId];

      if (voltage) {
        terminalVoltage[terminalId] = voltage;
      }
    }
  );

  const elementCurrent: Record<string, PhasorPeak> = {};
  const rawCurrent: Record<string, Cx> = {};

  results.elementResults.forEach((result) => {
    if (result.isBypassed) {
      return;
    }

    /*
     * A corrente do ramo de uma fonte é o oposto da que ela
     * entrega; os pontos seguem o sentido entregue.
     */
    const sign = isSourceType(result.elementType)
      ? -1
      : 1;

    const delivered = {
      real: result.current.real * sign,
      imaginary: result.current.imaginary * sign,
    };

    rawCurrent[result.elementId] = delivered;
    elementCurrent[result.elementId] = toPeak(delivered);
  });

  const connectionCurrent: Record<string, PhasorPeak> = {};

  Object.entries(
    computeWireCurrents(elements, connections, rawCurrent)
  ).forEach(([id, value]) => {
    connectionCurrent[id] = toPeak(value);
  });

  return {
    terminalVoltage,
    maxVoltagePeak: Math.max(
      0,
      ...Object.values(terminalVoltage).map(
        (item) => item.peak
      )
    ),
    elementCurrent,
    connectionCurrent,
    maxCurrentPeak: Math.max(
      0,
      ...Object.values(elementCurrent).map(
        (item) => item.peak
      ),
      ...Object.values(connectionCurrent).map(
        (item) => item.peak
      )
    ),
  };
}

/* Cor para um valor normalizado entre -1 e 1. */
export function colorForVoltage(
  normalized: number
): string {
  const value = Math.max(
    -1,
    Math.min(1, normalized)
  );

  const target =
    value >= 0
      ? POSITIVE_COLOR
      : NEGATIVE_COLOR;

  const amount = Math.abs(value);

  const channel = (index: number) =>
    Math.round(
      ZERO_COLOR[index] +
        (target[index] - ZERO_COLOR[index]) *
          amount
    );

  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

export function getAnimationFrame(
  model: AnimationModel,
  phase: number
): AnimationFrame {
  const terminalColor: Record<string, string> = {};

  Object.entries(model.terminalVoltage).forEach(
    ([terminalId, voltage]) => {
      const normalized =
        model.maxVoltagePeak > 1e-9
          ? (voltage.peak *
              Math.cos(phase + voltage.angle)) /
            model.maxVoltagePeak
          : 0;

      terminalColor[terminalId] =
        colorForVoltage(normalized);
    }
  );

  const flow: Record<string, FlowState> = {};

  Object.entries(model.elementCurrent).forEach(
    ([elementId, current]) => {
      const strength =
        model.maxCurrentPeak > 1e-9
          ? current.peak / model.maxCurrentPeak
          : 0;

      flow[elementId] = {
        offset:
          FLOW_MAX_OFFSET *
          strength *
          Math.sin(phase + current.angle),
        strength,
      };
    }
  );

  const wireFlow: Record<string, FlowState> = {};

  Object.entries(model.connectionCurrent).forEach(
    ([connectionId, current]) => {
      const strength =
        model.maxCurrentPeak > 1e-9
          ? current.peak / model.maxCurrentPeak
          : 0;

      wireFlow[connectionId] = {
        offset:
          FLOW_MAX_OFFSET *
          strength *
          Math.sin(phase + current.angle),
        strength,
      };
    }
  );

  return {
    terminalColor,
    flow,
    wireFlow,
  };
}
