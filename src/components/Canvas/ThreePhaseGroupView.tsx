import type { MouseEvent, ReactNode } from "react";
import type { CircuitElement } from "../../core/CircuitElement";
import type { CircuitTerminal } from "../../core/CircuitTerminal";
import { getGroupTerminals, getSourceLineVoltage, type ThreePhaseTerminalRole } from "../../core/threePhase";
import { formatImpedanceCompact, getImpedanceParameters } from "../../core/impedanceModel";
import { CircuitTerminalButton } from "./CircuitTerminalButton";
import {
  GROUP_HEIGHT,
  GROUP_WIDTH,
  getGroupTips,
  getMemberSegment,
  getMemberSymbolLabel,
  getNodeLabel,
} from "./threePhaseLayout";

interface ThreePhaseGroupViewProps {
  members: CircuitElement[];
  selectedElementId: string | null;
  selectedOriginTerminalId: string | null;
  connectedTerminalIds: ReadonlySet<string>;
  onStartDrag: (event: MouseEvent<HTMLDivElement>, element: CircuitElement) => void;
  onSelectElement: (elementId: string) => void;
  onSelectTerminal: (
    event: MouseEvent<HTMLButtonElement>,
    element: CircuitElement,
    terminal: CircuitTerminal | undefined
  ) => void;
}

const SYMBOL_LENGTH = 46;
const INK = "#111827";
const SELECTED = "#2563eb";
const Z_FILL = "#bfe3f2";

/* Texto com índice: "EAN" → E com "AN" subscrito. */
function Indexed({ text, x, y, color, size = 13 }: { text: string; x: number; y: number; color: string; size?: number }) {
  const head = text.slice(0, 1);
  const tail = text.slice(1);

  return (
    <text x={x} y={y} fill={color} fontSize={size} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fontStyle="italic">
      {head}
      <tspan fontSize={size * 0.72} dy={size * 0.3} fontStyle="italic">
        {tail}
      </tspan>
    </text>
  );
}

/*
 * Bloco trifásico desenhado como na apostila: estrela (Y) ou
 * triângulo (Δ), com bobinas no gerador e caixas Z na carga.
 */
export function ThreePhaseGroupView({
  members,
  selectedElementId,
  selectedOriginTerminalId,
  connectedTerminalIds,
  onStartDrag,
  onSelectElement,
  onSelectTerminal,
}: ThreePhaseGroupViewProps) {
  const first = members.find((m) => m.group?.role === "A") ?? members[0];
  const group = first?.group;

  if (!first || !group) {
    return null;
  }

  const isSource = group.kind === "source";
  const tips = getGroupTips(group);
  const canonical = getGroupTerminals(members);
  const anySelected = members.some((m) => m.id === selectedElementId);
  const name = first.label.replace(/\s+\S+$/, "");
  const balanced = group.balanced !== false;

  const caption = isSource
    ? balanced
      ? `${Number(getSourceLineVoltage(members).toPrecision(4))} V (linha), ${group.sequence ?? "ABC"}`
      : "desequilibrado"
    : balanced
      ? formatImpedanceCompact(getImpedanceParameters(first))
      : "desequilibrada";

  const symbols: ReactNode[] = [];

  members.forEach((member) => {
    const memberGroup = member.group!;
    const { from, to } = getMemberSegment(memberGroup);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const ux = dx / length;
    const uy = dy / length;
    const mid = { x: from.x + dx * 0.55, y: from.y + dy * 0.55 };
    const half = SYMBOL_LENGTH / 2;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const color = member.id === selectedElementId ? SELECTED : INK;

    /* Rótulo do lado de fora do desenho (normal apontando para fora). */
    let nx = -uy;
    let ny = ux;
    const centerX = GROUP_WIDTH / 2;
    const centerY = group.connection === "Y" ? 100 : 107;
    if ((mid.x + nx * 10 - centerX) ** 2 + (mid.y + ny * 10 - centerY) ** 2 < (mid.x - centerX) ** 2 + (mid.y - centerY) ** 2) {
      nx = -nx;
      ny = -ny;
    }
    const labelOffset = isSource ? 22 : 26;
    const label = getMemberSymbolLabel(memberGroup);
    const memberValue = !balanced
      ? isSource
        ? `${Number(member.value.toPrecision(4))}∠${Number((member.phase ?? 0).toFixed(1))}°`
        : formatImpedanceCompact(getImpedanceParameters(member))
      : "";

    symbols.push(
      <g key={member.id}>
        <line x1={from.x} y1={from.y} x2={mid.x - ux * half} y2={mid.y - uy * half} stroke={color} strokeWidth={2} />
        <line x1={mid.x + ux * half} y1={mid.y + uy * half} x2={to.x} y2={to.y} stroke={color} strokeWidth={2} />
        <g transform={`translate(${mid.x} ${mid.y}) rotate(${angle})`}>
          {isSource ? (
            <path
              d={`M ${-half} 0 ${[0, 1, 2, 3, 4]
                .map(() => `a 4.6 7 0 1 1 ${SYMBOL_LENGTH / 5} 0`)
                .join(" ")}`}
              fill="none"
              stroke={color}
              strokeWidth={2}
            />
          ) : (
            <rect x={-20} y={-11} width={40} height={22} fill={Z_FILL} stroke={color} strokeWidth={1.5} />
          )}
        </g>
        {isSource ? (
          <Indexed text={label} x={mid.x + nx * labelOffset} y={mid.y + ny * labelOffset} color={color} />
        ) : (
          <Indexed text={label} x={mid.x} y={mid.y - 2} color={color} size={12} />
        )}
        {memberValue ? (
          <text
            x={mid.x + nx * (isSource ? labelOffset + 14 : 18)}
            y={mid.y + ny * (isSource ? labelOffset + 14 : 18)}
            fontSize={10}
            fill="#374151"
            textAnchor={nx > 0.3 ? "start" : nx < -0.3 ? "end" : "middle"}
            dominantBaseline="middle"
          >
            {memberValue}
          </text>
        ) : null}
        {/* Área de toque: selecionar / arrastar o bloco por esta fase. */}
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="transparent"
          strokeWidth={22}
          style={{ pointerEvents: "stroke", cursor: "move" }}
          onPointerDown={(event) => onStartDrag(event as unknown as MouseEvent<HTMLDivElement>, member)}
          onClick={(event) => {
            event.stopPropagation();
            onSelectElement(member.id);
          }}
        >
          <title>{`${member.label} — toque para selecionar, arraste para mover o bloco`}</title>
        </line>
      </g>
    );
  });

  const roles: ThreePhaseTerminalRole[] = group.connection === "Y" ? ["A", "B", "C", "N"] : ["A", "B", "C"];

  return (
    <div
      style={{
        position: "absolute",
        left: first.x,
        top: first.y,
        width: GROUP_WIDTH,
        height: GROUP_HEIGHT,
        zIndex: 1,
        pointerEvents: "none",
        outline: anySelected ? `2px dashed ${SELECTED}` : "none",
        outlineOffset: 8,
        borderRadius: 6,
      }}
    >
      <svg width={GROUP_WIDTH} height={GROUP_HEIGHT} style={{ overflow: "visible", position: "absolute", left: 0, top: 0 }}>
        {symbols}
        {roles.map((role) => {
          const tip = tips[role];
          if (!tip) return null;
          const label = getNodeLabel(group, role);
          const node = tip.node;
          const lx = role === "N" ? node.x + (isSource ? -12 : 12) : role === "A" ? node.x - 12 : node.x + (role === "B" ? 12 : -12);
          const ly = role === "N" ? node.y - 10 : role === "A" ? node.y - 4 : node.y - 6;
          return (
            <g key={role}>
              {node.x !== tip.x || node.y !== tip.y ? (
                <line x1={node.x} y1={node.y} x2={tip.x} y2={tip.y} stroke={INK} strokeWidth={2} />
              ) : null}
              <circle cx={node.x} cy={node.y} r={3} fill={INK} />
              <text x={lx} y={ly} fontSize={13} fontStyle="italic" fill={INK} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
        <text x={GROUP_WIDTH / 2} y={GROUP_HEIGHT + 56} fontSize={12} fontWeight={700} fill={anySelected ? SELECTED : INK} textAnchor="middle">
          {name} ({group.connection === "Y" ? "Y" : "Δ"})
        </text>
        <text x={GROUP_WIDTH / 2} y={GROUP_HEIGHT + 70} fontSize={11} fill="#374151" textAnchor="middle">
          {caption}
        </text>
      </svg>

      {roles.map((role) => {
        const tip = tips[role];
        const terminalId = canonical[role];
        if (!tip || !terminalId) return null;
        const owner = members.find((m) => m.terminals.some((t) => t.id === terminalId))!;
        const terminal = owner.terminals.find((t) => t.id === terminalId);
        return (
          <div
            key={role}
            style={{ position: "absolute", left: tip.x, top: tip.y - 6, width: 0, height: 12, pointerEvents: "auto" }}
          >
            <CircuitTerminalButton
              terminalId={terminalId}
              side="left"
              elementLabel={`${name} ${getNodeLabel(group, role)}`}
              isSelected={selectedOriginTerminalId === terminalId}
              isConnected={connectedTerminalIds.has(terminalId)}
              onClick={(event) => onSelectTerminal(event, owner, terminal)}
            />
          </div>
        );
      })}
    </div>
  );
}

