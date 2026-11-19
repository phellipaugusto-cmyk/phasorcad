import type { CircuitConnection } from "../core/CircuitConnection";
import type { CircuitElement } from "../core/CircuitElement";
import { isSourceType } from "../core/CircuitElement";
import type { CircuitGraph } from "../core/CircuitGraph";
import type { CircuitResult } from "../core/CircuitResult";
import type { MnaElectricalResults } from "../core/MnaElectricalResults";
import type { CircuitState } from "../solver/CircuitTopology";
import {
  COMPONENT_HEIGHT,
  COMPONENT_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GRID_SIZE,
  getTerminalPosition,
} from "../components/Canvas/circuitGeometry";
import { routeConnections } from "../components/Canvas/wireRouter";
import { formatElementValue } from "../components/Canvas/circuitValues";
import {
  buildPhasorEntries,
  type PhasorEntry,
} from "../components/PhasorDiagram/phasorDiagramData";
import {
  buildPowerWave,
  buildWaveform,
  getPhaseRelation,
} from "../components/Waveform/waveformData";
import {
  computeFrequencySweep,
  SWEEP_MAX_HZ,
  SWEEP_MIN_HZ,
} from "../components/FrequencySweep/frequencySweepData";
import {
  CONTENT_W,
  MARGIN,
  PAGE_H,
  PAGE_W,
  Pdf,
  fmt,
} from "./pdfKit";

export interface ReportInput {
  elements: CircuitElement[];
  connections: CircuitConnection[];
  frequency: number;
  result: CircuitResult;
  circuitState: CircuitState;
  graph: CircuitGraph;
  results: MnaElectricalResults;
  generatedAt: Date;
  /* Nome opcional do projeto/autor, impresso no cabeçalho. */
  title?: string;
}

const TYPE_NAMES: Record<string, string> = {
  source: "Fonte de tensão",
  currentSource: "Fonte de corrente",
  resistor: "Resistor",
  capacitor: "Capacitor",
  inductor: "Indutor",
  motor: "Motor monofásico",
  lamp: "Lâmpada",
  switch: "Interruptor",
  contactor: "Bobina de contator",
};

const COLORS: Record<string, string> = {
  source: "#15803d",
  currentSource: "#0d9488",
  resistor: "#2563eb",
  capacitor: "#ea580c",
  inductor: "#9333ea",
  motor: "#b45309",
  lamp: "#ca8a04",
  switch: "#475569",
  contactor: "#7c3aed",
};

const STATE_TEXT: Record<string, string> = {
  closed: "FECHADO",
  open: "ABERTO",
  short: "CURTO-CIRCUITO",
};

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceScale(maximum: number): number {
  if (maximum <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(maximum));
  const base = 10 ** exponent;

  for (const step of NICE) {
    if (step * base >= maximum * 1.02) {
      return step * base;
    }
  }

  return 10 * base;
}

function si(value: number, unit: string, digits = 3): string {
  const abs = Math.abs(value);

  if (abs === 0) {
    return `0 ${unit}`;
  }

  const table: [number, string][] = [
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
  ];

  const [factor, prefix] = table.find(([f]) => abs >= f) ?? [1e-9, "n"];

  return `${fmt(value / factor, digits)} ${prefix}${unit}`;
}

const polar = (re: number, im: number) => ({
  magnitude: Math.hypot(re, im),
  angle: (Math.atan2(im, re) * 180) / Math.PI,
});

/* ------------------------------------------------------------------ */
/* Esquema do circuito                                                 */
/* ------------------------------------------------------------------ */

/*
 * Valor do componente com vírgula decimal e sinal de menos
 * tipográfico, como no resto do relatório ("129.1 V ∠-120°" →
 * "129,1 V ∠−120°").
 */
function reportValue(element: CircuitElement): string {
  return formatElementValue(element)
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/∠-/g, "∠−");
}

/*
 * Largura livre (unidades do Canvas) para os rótulos de um
 * componente: distância até o vizinho mais próximo cujos rótulos
 * ficam na mesma faixa de altura, limitada a 120.
 */
function labelRoomFor(
  element: CircuitElement,
  elements: CircuitElement[]
): number {
  let room = 120;

  elements.forEach((other) => {
    if (other.id === element.id || Math.abs(other.y - element.y) >= 60) {
      return;
    }

    const distance = Math.abs(other.x - element.x);

    if (distance > 0) {
      room = Math.min(room, distance - 6);
    }
  });

  return Math.max(room, 60);
}

/*
 * "B0:left, B0:right, K1:left" → "B0 (e, d), K1 (e)": cada
 * componente uma vez, com os lados (esquerdo/direito) ligados ao nó.
 */
function compactTerminals(terminalIds: string[]): string {
  const sides = new Map<string, string[]>();

  terminalIds.forEach((terminalId) => {
    const separator = terminalId.lastIndexOf(":");
    const elementId =
      separator >= 0 ? terminalId.slice(0, separator) : terminalId;
    const side = terminalId.slice(separator + 1);
    const list = sides.get(elementId) ?? [];
    list.push(side === "left" ? "e" : side === "right" ? "d" : side);
    sides.set(elementId, list);
  });

  return Array.from(sides.entries())
    .map(([elementId, list]) => `${elementId} (${list.sort((a, b) => (a === "e" ? -1 : b === "e" ? 1 : a.localeCompare(b))).join(", ")})`)
    .join(", ");
}

/* Altura da caixa do esquema seguindo a proporção do circuito. */
function schematicHeightFor(elements: CircuitElement[]): number {
  if (elements.length === 0) {
    return 120;
  }

  const w =
    Math.max(...elements.map((e) => e.x)) -
    Math.min(...elements.map((e) => e.x)) +
    COMPONENT_WIDTH +
    80;
  const h =
    Math.max(...elements.map((e) => e.y)) -
    Math.min(...elements.map((e) => e.y)) +
    COMPONENT_HEIGHT +
    60;

  return Math.min(440, Math.max(140, (CONTENT_W * h) / w));
}

function drawSchematic(
  pdf: Pdf,
  input: ReportInput,
  box: { x: number; top: number; w: number; h: number }
) {
  const { elements, connections } = input;

  if (elements.length === 0) {
    return;
  }

  const minX = Math.min(...elements.map((e) => e.x)) - 14;
  const maxX = Math.max(...elements.map((e) => e.x + COMPONENT_WIDTH)) + 14;
  const minY = Math.min(...elements.map((e) => e.y)) - 6;
  const maxY = Math.max(...elements.map((e) => e.y + COMPONENT_HEIGHT)) + 6;

  /* Fios roteados como no Canvas (precisa de um Canvas que caiba tudo). */
  const canvas = {
    width:
      Math.max(CANVAS_WIDTH, Math.ceil((maxX + 40) / GRID_SIZE) * GRID_SIZE),
    height:
      Math.max(CANVAS_HEIGHT, Math.ceil((maxY + 40) / GRID_SIZE) * GRID_SIZE),
  };

  const routes = routeConnections(elements, connections, canvas);

  /* Os fios podem sair um pouco da caixa dos componentes. */
  let wMinX = minX;
  let wMaxX = maxX;
  let wMinY = minY;
  let wMaxY = maxY;

  const wirePoints = routes.map((route) => {
    const numbers = route.pathData.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const points: [number, number][] = [];

    for (let i = 0; i + 1 < numbers.length; i += 2) {
      points.push([numbers[i], numbers[i + 1]]);
      wMinX = Math.min(wMinX, numbers[i] - 6);
      wMaxX = Math.max(wMaxX, numbers[i] + 6);
      wMinY = Math.min(wMinY, numbers[i + 1] - 6);
      wMaxY = Math.max(wMaxY, numbers[i + 1] + 6);
    }

    return points;
  });

  const scale = Math.min(
    box.w / (wMaxX - wMinX),
    box.h / (wMaxY - wMinY),
    1.25
  );

  const offsetX = box.x + (box.w - (wMaxX - wMinX) * scale) / 2;
  const offsetY = box.top + (box.h - (wMaxY - wMinY) * scale) / 2;

  const X = (x: number) => offsetX + (x - wMinX) * scale;
  const Y = (y: number) => offsetY + (y - wMinY) * scale;

  pdf.rect(box.x, box.top, box.w, box.h, { stroke: "#cbd5e1", width: 0.6 });

  const wire = { color: "#374151", width: Math.max(0.9, 1.4 * scale) };

  wirePoints.forEach((points) => {
    pdf.polyline(
      points.map(([x, y]) => [X(x), Y(y)] as [number, number]),
      wire
    );
  });

  elements.forEach((element) => {
    const color = COLORS[element.type] ?? "#111827";
    const left = getTerminalPosition(element, element.terminals[0].id);
    const cy = left.y;
    const x0 = element.x;
    const st = { color, width: Math.max(1, 1.6 * scale) };

    const seg = (a: number, b: number, v1 = 0, v2 = 0) =>
      pdf.line(X(x0 + a), Y(cy + v1), X(x0 + b), Y(cy + v2), st);

    switch (element.type) {
      case "resistor": {
        seg(0, 18);
        const zig: [number, number][] = [
          [18, 0], [24, -9], [32, 9], [40, -9], [48, 9], [56, -9], [62, 0],
        ];
        pdf.polyline(
          zig.map(([u, v]) => [X(x0 + u), Y(cy + v)] as [number, number]),
          st
        );
        seg(62, 80);
        break;
      }
      case "capacitor": {
        seg(0, 35);
        seg(35, 35, -16, 16);
        seg(45, 45, -16, 16);
        seg(45, 80);
        break;
      }
      case "inductor": {
        seg(0, 14);
        const pts: [number, number][] = [];

        for (let loop = 0; loop < 4; loop++) {
          for (let k = 0; k <= 12; k++) {
            const t = Math.PI - (k / 12) * Math.PI;
            pts.push([
              X(x0 + 14 + loop * 13 + 6.5 + Math.cos(t) * 6.5),
              Y(cy - Math.sin(t) * 11),
            ]);
          }
        }

        pdf.polyline(pts, st);
        seg(66, 80);
        break;
      }
      case "motor": {
        seg(0, 22);
        seg(58, 80);
        pdf.circle(X(x0 + 40), Y(cy), 18 * scale, {
          stroke: color,
          width: st.width,
        });
        pdf.polyline(
          ([[32, 9], [32, -9], [40, 2], [48, -9], [48, 9]] as [number, number][]).map(
            ([u, v]) => [X(x0 + u), Y(cy + v)] as [number, number]
          ),
          st
        );
        break;
      }
      case "lamp": {
        /* Círculo com um X (lâmpada). */
        seg(0, 26);
        seg(54, 80);
        pdf.circle(X(x0 + 40), Y(cy), 14 * scale, {
          stroke: color,
          width: st.width,
        });
        seg(30, 50, -10, 10);
        seg(30, 50, 10, -10);
        break;
      }
      case "switch": {
        /* Lâmina: fechada na horizontal, aberta inclinada. */
        seg(0, 24);
        seg(56, 80);
        seg(24, 56, 0, element.closed === false ? -16 : 0);
        break;
      }
      case "contactor": {
        /* Bobina: retângulo com a diagonal. */
        seg(0, 26);
        seg(54, 80);
        seg(26, 54, -10, -10);
        seg(26, 54, 10, 10);
        seg(26, 26, -10, 10);
        seg(54, 54, -10, 10);
        seg(30, 50, 10, -10);
        break;
      }
      default: {
        /* Fontes: círculo com senoide (tensão) ou seta (corrente). */
        seg(0, 24);
        seg(56, 80);
        pdf.circle(X(x0 + 40), Y(cy), 16 * scale, {
          stroke: color,
          width: st.width,
        });

        if (element.type === "source") {
          const pts: [number, number][] = [];

          for (let k = 0; k <= 20; k++) {
            const u = -9 + (k / 20) * 18;
            pts.push([X(x0 + 40 + u), Y(cy - Math.sin((k / 20) * 2 * Math.PI) * 6)]);
          }

          pdf.polyline(pts, st);
        } else {
          pdf.arrow(X(x0 + 31), Y(cy), X(x0 + 49), Y(cy), { color, width: st.width });
        }
      }
    }

    /* Terminais. */
    element.terminals.forEach((terminal) => {
      const point = getTerminalPosition(element, terminal.id);
      pdf.circle(X(point.x), Y(point.y), Math.max(1.8, 2.6 * scale), {
        fill: "#ffffff",
        stroke: "#111827",
        width: 0.8,
      });
    });

    const fontSize = Math.max(7, 9.5 * Math.min(scale, 1.1));
    const centerX = X(x0 + 40);

    /*
     * Rótulos cabem no espaço até o vizinho mais próximo na mesma
     * linha (no máximo ~1,5 componente), para não se sobreporem.
     */
    const labelWidth = labelRoomFor(element, elements) * scale;
    const name = pdf.fit(element.label, labelWidth, fontSize, true);
    const value = pdf.fit(reportValue(element), labelWidth, fontSize - 0.5);

    pdf.text(name.text, centerX, Y(cy - 25), {
      size: name.size,
      bold: true,
      align: "center",
      color,
    });

    pdf.text(
      value.text,
      centerX,
      Y(cy + 34),
      { size: value.size, align: "center", color: "#374151" }
    );
  });
}

/* ------------------------------------------------------------------ */
/* Diagrama fasorial                                                   */
/* ------------------------------------------------------------------ */

function drawPhasors(
  pdf: Pdf,
  entries: PhasorEntry[],
  unit: string,
  title: string,
  box: { x: number; top: number; size: number }
) {
  const cx = box.x + box.size / 2;
  const cy = box.top + box.size / 2 + 6;
  const radius = box.size / 2 - 26;
  const active = entries.filter((entry) => entry.magnitude > 1e-9);

  pdf.text(title, cx, box.top + 8, { size: 9.5, bold: true, align: "center" });

  const scale = niceScale(Math.max(0, ...active.map((e) => e.magnitude)));
  const unitLen = radius / scale;

  [0.5, 1].forEach((fraction) => {
    pdf.circle(cx, cy, radius * fraction, { stroke: "#d1d5db", width: 0.6 });
    pdf.text(`${fmt(scale * fraction, scale >= 10 ? 0 : 1)} ${unit}`, cx + 3, cy + radius * fraction + 9, {
      size: 7,
      color: "#6b7280",
    });
  });

  pdf.line(cx - radius - 10, cy, cx + radius + 10, cy, { color: "#6b7280", width: 0.7 });
  pdf.line(cx, cy + radius + 10, cx, cy - radius - 10, { color: "#6b7280", width: 0.7 });
  pdf.text("Re", cx + radius + 10, cy - 3, { size: 7.5, color: "#6b7280", align: "right" });
  pdf.text("Im", cx + 4, cy - radius - 8, { size: 7.5, color: "#6b7280" });

  /*
   * Na ponta de cada seta vai só um número; o nome e o valor ficam
   * na legenda abaixo do diagrama. Assim nomes longos e fasores
   * quase na mesma direção não se sobrepõem.
   */
  const placed: { x: number; y: number; w: number; h: number }[] = [
    /* Rótulos dos eixos. */
    { x: cx + radius - 8, y: cy - 10, w: 24, h: 10 },
    { x: cx, y: cy - radius - 16, w: 20, h: 10 },
  ];
  const overlaps = (x: number, y: number, w: number, h: number) =>
    placed.some(
      (p) =>
        Math.abs(p.x + p.w / 2 - (x + w / 2)) < (p.w + w) / 2 + 1 &&
        Math.abs(p.y + p.h / 2 - (y + h / 2)) < (p.h + h) / 2 + 1
    );

  active.forEach((entry, index) => {
    const tipX = cx + entry.real * unitLen;
    const tipY = cy - entry.imaginary * unitLen;
    const color = COLORS[entry.type] ?? "#111827";

    pdf.arrow(cx, cy, tipX, tipY, { color, width: 1.5 });

    const tag = String(index + 1);
    const w = pdf.width(tag, 8, true) + 4;
    const h = 10;
    const length = Math.hypot(tipX - cx, tipY - cy) || 1;
    const ux = (tipX - cx) / length;
    const uy = (tipY - cy) / length;

    /* Tenta ao longo da seta e, se ocupado, para os lados. */
    let x = tipX + ux * 9 - w / 2;
    let y = tipY + uy * 9 - h / 2;

    for (let step = 1; step < 40 && overlaps(x, y, w, h); step++) {
      const side = step % 2 === 0 ? 1 : -1;
      const amount = Math.ceil(step / 2) * 9;
      x = tipX + ux * 9 - w / 2 + -uy * side * amount;
      y = tipY + uy * 9 - h / 2 + ux * side * amount;
    }

    x = Math.min(box.x + box.size - w, Math.max(box.x, x));
    placed.push({ x, y, w, h });
    pdf.text(tag, x + w / 2, y + h - 2, { size: 8, bold: true, color, align: "center" });
  });

  /* Legenda: número, nome, módulo e ângulo. */
  let legendY = box.top + box.size + 4;

  active.forEach((entry, index) => {
    const color = COLORS[entry.type] ?? "#111827";
    const value = `${fmt(entry.magnitude, entry.magnitude >= 10 ? 1 : 3)} ${unit} ∠${fmt(entry.angleDegrees, 1)}°`;
    const tag = `${index + 1}`;
    const valueWidth = pdf.width(value, 7.5);
    const nameRoom = box.size - 16 - valueWidth - 8;
    const name = pdf.fit(entry.label, nameRoom, 7.5, true);

    pdf.text(tag, box.x + 6, legendY, { size: 7.5, bold: true, color, align: "center" });
    pdf.text(name.text, box.x + 14, legendY, { size: name.size, bold: true, color });
    pdf.text(value, box.x + box.size, legendY, { size: 7.5, color: "#374151", align: "right" });
    legendY += LEGEND_ROW;
  });
}

const LEGEND_ROW = 10.5;

/* ------------------------------------------------------------------ */
/* Gráficos de linhas                                                  */
/* ------------------------------------------------------------------ */

interface PlotSeries {
  points: [number, number][];
  color: string;
  width?: number;
}

function drawPlot(
  pdf: Pdf,
  box: { x: number; top: number; w: number; h: number },
  options: {
    title: string;
    series: PlotSeries[];
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    xLog?: boolean;
    yLog?: boolean;
    xTicks: { value: number; label: string }[];
    yTicks: { value: number; label: string; color?: string }[];
    xLabel: string;
    zeroLine?: boolean;
    hLines?: { value: number; color: string; dash?: number[] }[];
    vLines?: { value: number; color: string; label?: string }[];
  }
) {
  const left = box.x + 46;
  const right = box.x + box.w - 10;
  const top = box.top + 16;
  const bottom = box.top + box.h - 24;

  const fx = (v: number) => {
    const a = options.xLog ? Math.log10(options.xMin) : options.xMin;
    const b = options.xLog ? Math.log10(options.xMax) : options.xMax;
    const t = ((options.xLog ? Math.log10(v) : v) - a) / (b - a || 1);
    return left + t * (right - left);
  };

  const fy = (v: number) => {
    const a = options.yLog ? Math.log10(options.yMin) : options.yMin;
    const b = options.yLog ? Math.log10(options.yMax) : options.yMax;
    const t = ((options.yLog ? Math.log10(Math.max(v, 1e-300)) : v) - a) / (b - a || 1);
    return bottom - Math.min(1.05, Math.max(-0.05, t)) * (bottom - top);
  };

  pdf.text(options.title, box.x, box.top + 8, { size: 9.5, bold: true });
  pdf.rect(left, top, right - left, bottom - top, { stroke: "#cbd5e1", width: 0.6 });

  options.yTicks.forEach((tick) => {
    const y = fy(tick.value);
    pdf.line(left, y, right, y, { color: "#eef2f7", width: 0.5 });
    pdf.text(tick.label, left - 4, y + 2.5, {
      size: 7,
      align: "right",
      color: tick.color ?? "#6b7280",
    });
  });

  options.xTicks.forEach((tick) => {
    const x = fx(tick.value);
    pdf.line(x, top, x, bottom, { color: "#eef2f7", width: 0.5 });
    pdf.text(tick.label, x, bottom + 9, { size: 7, align: "center", color: "#6b7280" });
  });

  pdf.text(options.xLabel, (left + right) / 2, bottom + 19, {
    size: 7.5,
    align: "center",
    color: "#374151",
  });

  if (options.zeroLine) {
    pdf.line(left, fy(0), right, fy(0), { color: "#9ca3af", width: 0.7 });
  }

  (options.hLines ?? []).forEach((line) => {
    pdf.line(left, fy(line.value), right, fy(line.value), {
      color: line.color,
      width: 0.8,
      dash: line.dash ?? [3, 3],
    });
  });

  (options.vLines ?? []).forEach((line, index) => {
    const x = fx(line.value);
    pdf.line(x, top, x, bottom, { color: line.color, width: 0.8, dash: [3, 3] });

    if (line.label) {
      pdf.text(line.label, x + 3, top + 9 + index * 9, { size: 7, color: line.color });
    }
  });

  options.series.forEach((serie) => {
    pdf.polyline(
      serie.points.map(([x, y]) => [fx(x), fy(y)] as [number, number]),
      { color: serie.color, width: serie.width ?? 1.4 }
    );
  });
}

/* ------------------------------------------------------------------ */
/* Relatório                                                           */
/* ------------------------------------------------------------------ */

export async function buildCircuitReport(
  input: ReportInput
): Promise<Uint8Array> {
  const pdf = await Pdf.create();
  const { elements, results, result } = input;
  const closed = input.circuitState === "closed" && results.available;
  const sources = elements.filter((e) => isSourceType(e.type));
  const omega = 2 * Math.PI * input.frequency;

  /* ---------- Cabeçalho ---------- */
  pdf.rect(0, 0, PAGE_W, 74, { fill: "#1e3a8a" });
  pdf.text("PhasorCAD", MARGIN, 32, { size: 20, bold: true, color: "#ffffff" });
  pdf.text("Relatório de análise de circuito CA em regime permanente senoidal", MARGIN, 50, {
    size: 10.5,
    color: "#dbeafe",
  });
  pdf.text(
    input.generatedAt.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" }),
    PAGE_W - MARGIN,
    32,
    { size: 9.5, color: "#dbeafe", align: "right" }
  );

  if (input.title) {
    pdf.text(input.title, PAGE_W - MARGIN, 50, {
      size: 10.5,
      bold: true,
      color: "#ffffff",
      align: "right",
    });
  }

  pdf.cursor = 92;

  /* ---------- Dados gerais ---------- */
  const stateColor =
    input.circuitState === "closed" ? "#15803d" : input.circuitState === "short" ? "#c2410c" : "#b91c1c";

  const info: [string, string][] = [
    ["Frequência", `${fmt(input.frequency, 3)} Hz   (ω = ${fmt(omega, 2)} rad/s)`],
    ["Componentes", `${elements.length}  (${sources.length} ${sources.length === 1 ? "fonte" : "fontes"})`],
    ["Conexões", `${input.connections.length}`],
  ];

  info.forEach(([label, value]) => {
    pdf.ensure(14);
    pdf.cursor += 14;
    pdf.text(label, MARGIN, pdf.cursor, { size: 9.5, bold: true, color: "#374151" });
    pdf.text(value, MARGIN + 90, pdf.cursor, { size: 9.5 });
  });

  pdf.ensure(14);
  pdf.cursor += 14;
  pdf.text("Estado", MARGIN, pdf.cursor, { size: 9.5, bold: true, color: "#374151" });
  pdf.text(STATE_TEXT[input.circuitState] ?? input.circuitState, MARGIN + 90, pdf.cursor, {
    size: 9.5,
    bold: true,
    color: stateColor,
  });

  /* ---------- 1. Circuito ---------- */
  pdf.heading("1. Circuito analisado");

  const schemaHeight = schematicHeightFor(elements);
  pdf.ensure(schemaHeight + 6);
  drawSchematic(pdf, input, { x: MARGIN, top: pdf.cursor, w: CONTENT_W, h: schemaHeight });
  pdf.cursor += schemaHeight + 6;

  if (!closed) {
    pdf.heading("Resultados");
    pdf.paragraph(
      input.circuitState === "short"
        ? "O circuito está em curto-circuito: fios ligam diretamente os dois terminais de uma fonte de tensão, sem nenhum componente no caminho. O cálculo foi desativado."
        : "O circuito está aberto: não existe um caminho completo entre os dois terminais de cada fonte. Todas as correntes são zero e não há fasores, ondas nem potência a reportar.",
      { size: 10 }
    );
  } else {
    /* ---------- 2. Resumo ---------- */
    pdf.heading("2. Resultados globais");

    const several = (result.sourceCount ?? 1) > 1;
    const summary: [string, string][] = [];

    if (!several) {
      const zeq = polar(result.zeq.real, result.zeq.imag);
      const cur = polar(result.current.real, result.current.imag);

      summary.push(
        ["Impedância equivalente Zeq", `${fmt(result.zeq.real)} ${result.zeq.imag < 0 ? "−" : "+"} j${fmt(Math.abs(result.zeq.imag))} Ω   =   ${fmt(zeq.magnitude)} Ω ∠ ${fmt(zeq.angle)}°`],
        ["Corrente da fonte", `${fmt(cur.magnitude, 4)} A ∠ ${fmt(cur.angle)}°  (eficaz)`]
      );
    } else {
      summary.push([
        "Várias fontes",
        `${result.sourceCount} fontes: não existe uma Zeq única nem uma corrente total única.`,
      ]);

      (result.sourcePowers ?? []).forEach((source) => {
        summary.push([
          `${source.elementId} entrega`,
          `${fmt(source.activePower)} W  /  ${fmt(source.reactivePower)} var`,
        ]);
      });
    }

    summary.push(
      ["Potência ativa P", `${si(result.activePower, "W")}`],
      ["Potência reativa Q", `${si(result.reactivePower, "var")}`],
      ["Potência aparente S", `${si(result.apparentPower, "VA")}`],
      ["Fator de potência", `${fmt(result.powerFactor, 3)}`]
    );

    summary.forEach(([label, value]) => {
      pdf.ensure(15);
      pdf.cursor += 15;
      pdf.text(label, MARGIN, pdf.cursor, { size: 9.5, bold: true, color: "#374151" });
      pdf.text(value, MARGIN + 150, pdf.cursor, { size: 9.5 });
    });

    /* ---------- 3. Componentes ---------- */
    pdf.heading("3. Tensões, correntes e potências por componente");

    const voltages = buildPhasorEntries(results, elements, "voltage");
    const currents = buildPhasorEntries(results, elements, "current");

    const rows = elements.map((element) => {
      const v = voltages.find((e) => e.elementId === element.id);
      const c = currents.find((e) => e.elementId === element.id);
      const power = results.elementResults.find((r) => r.elementId === element.id);

      return [
        element.label,
        TYPE_NAMES[element.type] ?? element.type,
        reportValue(element),
        v ? fmt(v.magnitude, 3) : "—",
        v ? fmt(v.angleDegrees, 2) : "—",
        c ? fmt(c.magnitude, 4) : "—",
        c ? fmt(c.angleDegrees, 2) : "—",
        power ? fmt(power.complexPower.real, 2) : "—",
        power ? fmt(power.complexPower.imaginary, 2) : "—",
      ];
    });

    pdf.table(
      [
        { title: "Componente", width: 78 },
        { title: "Tipo", width: 80 },
        { title: "Valor", width: 80, align: "right" },
        { title: "|V| (V)", width: 46, align: "right" },
        { title: "∠V (°)", width: 40, align: "right" },
        { title: "|I| (A)", width: 46, align: "right" },
        { title: "∠I (°)", width: 42, align: "right" },
        { title: "P (W)", width: 50, align: "right" },
        { title: "Q (var)", width: 50, align: "right" },
      ],
      rows
    );

    pdf.paragraph(
      "Módulos em valor eficaz (RMS). Tensão = V(origem) − V(destino), no sentido do terminal esquerdo para o direito; nas fontes, tensão e corrente são as que ela entrega ao circuito. P e Q seguem S = V·I*: positivo = absorve, negativo = entrega.",
      { size: 8, color: "#6b7280" }
    );

    /* ---------- 4. Nós ---------- */
    pdf.heading("4. Tensões nos nós");

    const terminalsByNode = new Map<string, string[]>();

    Object.entries(input.graph.terminalToNodeId).forEach(([terminal, node]) => {
      terminalsByNode.set(node, [...(terminalsByNode.get(node) ?? []), terminal]);
    });

    pdf.table(
      [
        { title: "Nó", width: 40 },
        { title: "Componentes (e = terminal esq., d = dir.)", width: 215 },
        { title: "|V| (V)", width: 80, align: "right" },
        { title: "∠V (°)", width: 70, align: "right" },
        { title: "Obs.", width: 110 },
      ],
      results.nodeVoltages.map((node) => {
        const p = polar(node.voltage.real, node.voltage.imaginary);

        return [
          node.nodeId,
          compactTerminals(terminalsByNode.get(node.nodeId) ?? []),
          fmt(p.magnitude, 3),
          fmt(p.magnitude < 1e-9 ? 0 : p.angle, 2),
          node.isReference ? "referência (GND)" : "",
        ];
      })
    );

    /* ---------- 5. Fasores ---------- */
    pdf.ensure(320);
    pdf.heading("5. Diagramas fasoriais");

    const half = CONTENT_W / 2;
    const size = Math.min(half - 8, 250);

    const legendRows = Math.max(
      voltages.filter((e) => e.magnitude > 1e-9).length,
      currents.filter((e) => e.magnitude > 1e-9).length
    );
    const legendHeight = legendRows * LEGEND_ROW + 6;

    pdf.ensure(size + legendHeight + 8);
    drawPhasors(pdf, voltages, "V", "Tensões (V eficaz)", { x: MARGIN, top: pdf.cursor, size });
    drawPhasors(pdf, currents, "A", "Correntes (A eficaz)", { x: MARGIN + half + 4, top: pdf.cursor, size });
    pdf.cursor += size + legendHeight + 8;

    /* ---------- 6. Ondas ---------- */
    const mainSource = sources[0];
    const mainV = voltages.find((e) => e.elementId === mainSource?.id);
    const mainC = currents.find((e) => e.elementId === mainSource?.id);
    const wave = mainV && mainC ? buildWaveform(mainV, mainC, input.frequency) : null;

    if (mainSource && wave) {
      pdf.ensure(240);
      pdf.heading(`6. Formas de onda no tempo — ${mainSource.label}`);

      const relation = getPhaseRelation(mainV!.angleDegrees, mainC!.angleDegrees, input.frequency);

      const period = wave.period * 1000;
      const durationMs = wave.duration * 1000;

      pdf.ensure(170);
      drawPlot(
        pdf,
        { x: MARGIN, top: pdf.cursor, w: CONTENT_W, h: 160 },
        {
          title: `v(t) e i(t) — ${mainSource.label}`,
          series: [
            { points: wave.points.map((p) => [p.time * 1000, p.voltage / (wave.voltagePeak || 1)]), color: "#2563eb", width: 1.6 },
            { points: wave.points.map((p) => [p.time * 1000, p.current / (wave.currentPeak || 1)]), color: "#dc2626", width: 1.6 },
          ],
          xMin: 0,
          xMax: durationMs,
          yMin: -1.1,
          yMax: 1.1,
          xTicks: [0, 0.5, 1, 1.5, 2].map((k) => ({ value: k * period, label: fmt(k * period, 1) })),
          yTicks: [
            { value: 1, label: `+${fmt(wave.voltagePeak, 1)} V`, color: "#2563eb" },
            { value: 0, label: "0" },
            { value: -1, label: `−${fmt(wave.voltagePeak, 1)} V`, color: "#2563eb" },
          ],
          xLabel: "t (ms) — azul: v(t) (pico √2·V); vermelho: i(t) (cada onda na própria escala)",
          zeroLine: true,
        }
      );
      pdf.cursor += 166;

      pdf.paragraph(
        `Pico de tensão ${fmt(wave.voltagePeak, 2)} V; pico de corrente ${fmt(wave.currentPeak, 3)} A. ` +
          (relation.kind === "in-phase"
            ? "Tensão e corrente estão em fase."
            : relation.kind === "current-lags"
              ? `A corrente está atrasada ${fmt(Math.abs(relation.differenceDegrees), 2)}° (${fmt(relation.lagSeconds * 1000, 3)} ms) em relação à tensão.`
              : `A corrente está adiantada ${fmt(Math.abs(relation.differenceDegrees), 2)}° (${fmt(Math.abs(relation.lagSeconds) * 1000, 3)} ms) em relação à tensão.`),
        { size: 9 }
      );

      const power = buildPowerWave(mainV!, mainC!, input.frequency);

      if (power && power.apparent > 1e-9) {
        const peak = Math.max(Math.abs(power.peakMax), Math.abs(power.peakMin)) || 1;

        pdf.ensure(160);
        drawPlot(
          pdf,
          { x: MARGIN, top: pdf.cursor, w: CONTENT_W, h: 140 },
          {
            title: `p(t) = v(t)·i(t) — ${mainSource.label}`,
            series: [
              { points: power.points.map((p) => [p.time * 1000, p.power]), color: "#7c3aed", width: 1.6 },
            ],
            xMin: 0,
            xMax: durationMs,
            yMin: -peak * 1.1,
            yMax: peak * 1.1,
            xTicks: [0, 0.5, 1, 1.5, 2].map((k) => ({ value: k * period, label: fmt(k * period, 1) })),
            yTicks: [
              { value: peak, label: `${fmt(peak, 0)} W` },
              { value: 0, label: "0" },
              { value: -peak, label: `−${fmt(peak, 0)} W` },
            ],
            xLabel: "t (ms) — linha tracejada: potência ativa média P",
            zeroLine: true,
            hLines: [{ value: power.average, color: "#7c3aed" }],
          }
        );
        pdf.cursor += 146;

        pdf.paragraph(
          `Potência média P = ${fmt(power.average, 2)} W, S = ${fmt(power.apparent, 2)} VA. ` +
            (power.peakMin < -1e-6 * power.apparent
              ? "p(t) fica negativa em parte do ciclo: há troca de energia (potência reativa) entre a fonte e os elementos armazenadores."
              : "p(t) nunca fica negativa: toda a energia é absorvida (carga resistiva)."),
          { size: 9 }
        );
      }
    }

    /* ---------- 7. Varredura ---------- */
    const lowHz = Math.max(SWEEP_MIN_HZ, input.frequency / 100);
    const highHz = Math.min(SWEEP_MAX_HZ, input.frequency * 100);
    const sweep =
      sources.length === 1
        ? computeFrequencySweep(elements, input.connections, lowHz, highHz)
        : null;

    if (sweep && sweep.points.length > 1) {
      pdf.ensure(240);
      pdf.heading("7. Resposta em frequência");

      const maxZ = Math.max(...sweep.points.map((p) => p.zeqMagnitude));
      const minZ = Math.max(1e-6, Math.min(...sweep.points.map((p) => p.zeqMagnitude)));
      const decadeLow = Math.floor(Math.log10(minZ));
      const decadeHigh = Math.ceil(Math.log10(maxZ));
      const decades: { value: number; label: string }[] = [];

      for (let d = decadeLow; d <= decadeHigh; d++) {
        decades.push({ value: 10 ** d, label: si(10 ** d, "Ω", 0) });
      }

      const freqTicks: { value: number; label: string }[] = [];

      for (let d = Math.ceil(Math.log10(lowHz)); d <= Math.floor(Math.log10(highHz)); d++) {
        freqTicks.push({ value: 10 ** d, label: si(10 ** d, "Hz", 0) });
      }

      const vLines = [
        { value: input.frequency, color: "#6b7280", label: "f atual" },
        ...(sweep.resonanceHz
          ? [{ value: sweep.resonanceHz, color: "#dc2626", label: `ressonância ${si(sweep.resonanceHz, "Hz")}` }]
          : []),
      ];

      pdf.ensure(160);
      drawPlot(
        pdf,
        { x: MARGIN, top: pdf.cursor, w: CONTENT_W, h: 150 },
        {
          title: "|Zeq| em função da frequência (escala log–log)",
          series: [
            { points: sweep.points.map((p) => [p.frequency, Math.max(p.zeqMagnitude, 1e-6)]), color: "#2563eb", width: 1.6 },
          ],
          xMin: lowHz,
          xMax: highHz,
          yMin: 10 ** decadeLow,
          yMax: 10 ** decadeHigh === 10 ** decadeLow ? 10 ** (decadeLow + 1) : 10 ** decadeHigh,
          xLog: true,
          yLog: true,
          xTicks: freqTicks,
          yTicks: decades,
          xLabel: "f (Hz)",
          vLines,
        }
      );
      pdf.cursor += 156;

      pdf.ensure(150);
      drawPlot(
        pdf,
        { x: MARGIN, top: pdf.cursor, w: CONTENT_W, h: 140 },
        {
          title: "Fase de Zeq (graus) em função da frequência",
          series: [
            { points: sweep.points.map((p) => [p.frequency, p.zeqPhaseDegrees]), color: "#9333ea", width: 1.6 },
          ],
          xMin: lowHz,
          xMax: highHz,
          yMin: -90,
          yMax: 90,
          xLog: true,
          xTicks: freqTicks,
          yTicks: [-90, -45, 0, 45, 90].map((v) => ({ value: v, label: `${v}°` })),
          xLabel: "f (Hz)",
          zeroLine: true,
          vLines,
        }
      );
      pdf.cursor += 146;

      pdf.paragraph(
        sweep.resonanceHz
          ? `Ressonância (fase de Zeq = 0°) em ${si(sweep.resonanceHz, "Hz")}.`
          : "Não há cruzamento de fase por zero nesta faixa de frequência.",
        { size: 9 }
      );
    }
  }

  /* ---------- Notas ---------- */
  pdf.heading("Notas e convenções");
  pdf.paragraph(
    "Análise no domínio fasorial (regime permanente senoidal) pelo método dos nós modificado. Os módulos dos fasores são valores eficazes (RMS); o valor de pico é √2 vezes o eficaz. O nó de referência (GND) é o terminal esquerdo da primeira fonte. Ângulos em graus, positivo no sentido anti-horário a partir do eixo real. Relatório gerado automaticamente pelo PhasorCAD; confira os valores antes de usá-los em documentos técnicos.",
    { size: 8.5, color: "#4b5563" }
  );

  /* ---------- Rodapé em todas as páginas ---------- */
  const pages = pdf.doc.getPages();

  pages.forEach((page, index) => {
    pdf.line(MARGIN, PAGE_H - 30, PAGE_W - MARGIN, PAGE_H - 30, { color: "#d1d5db", width: 0.5 }, page);
    pdf.text("PhasorCAD — relatório de análise de circuito", MARGIN, PAGE_H - 19, { size: 7.5, color: "#6b7280" }, page);
    pdf.text(`Página ${index + 1} de ${pages.length}`, PAGE_W - MARGIN, PAGE_H - 19, { size: 7.5, color: "#6b7280", align: "right" }, page);
  });

  pdf.doc.setTitle("PhasorCAD — Relatório de análise de circuito");
  pdf.doc.setProducer("PhasorCAD");
  pdf.doc.setCreator("PhasorCAD");

  return pdf.save();
}
