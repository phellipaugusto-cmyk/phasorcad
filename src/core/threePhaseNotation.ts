import type { ThreePhaseGroup, ThreePhaseRole } from "./CircuitElement";

/*
 * Notação da apostila (Circuitos Elétricos II, cap. 8 — Boylestad):
 *
 *   Gerador: nós A, B, C, N; tensões E (E_AN, E_AB…).
 *   Carga:   nós a, b, c, n; tensões V (V_an, V_ab…);
 *            impedâncias Z1, Z2, Z3 (Y: Z1 na fase a; Δ: Z1 entre
 *            a e b, Z2 entre b e c, Z3 entre c e a).
 *   Correntes de linha I_Aa, I_Bb, I_Cc; de fase na carga I_an (Y)
 *   ou I_ab (Δ); no gerador em Δ, I_BA, I_CB, I_AC; neutro I_N.
 *
 * Cada nome é { base, sub } para o painel poder subscrever o índice;
 * no PDF sai junto (EAN, Van, IAa).
 */

export interface Symbol {
  base: string;
  sub: string;
}

type Kind = Pick<ThreePhaseGroup, "kind" | "connection">;

const PAIR: Record<ThreePhaseRole, string> = { A: "AB", B: "BC", C: "CA" };
const GEN_DELTA_CURRENT: Record<ThreePhaseRole, string> = { A: "BA", B: "CB", C: "AC" };
const INDEX: Record<ThreePhaseRole, string> = { A: "1", B: "2", C: "3" };

const lower = (s: string) => s.toLowerCase();

export function phaseVoltageSymbol(g: Kind, role: ThreePhaseRole): Symbol {
  const isSource = g.kind === "source";
  const sub = g.connection === "Y" ? `${role}N` : PAIR[role];
  return { base: isSource ? "E" : "V", sub: isSource ? sub : lower(sub) };
}

export function lineVoltageSymbol(g: Kind, role: ThreePhaseRole): Symbol {
  return g.kind === "source"
    ? { base: "E", sub: PAIR[role] }
    : { base: "V", sub: lower(PAIR[role]) };
}

export function phaseCurrentSymbol(g: Kind, role: ThreePhaseRole): Symbol {
  if (g.kind === "source") {
    return g.connection === "Y"
      ? { base: "I", sub: `${role}${lower(role)}` }
      : { base: "I", sub: GEN_DELTA_CURRENT[role] };
  }
  return g.connection === "Y"
    ? { base: "I", sub: `${lower(role)}n` }
    : { base: "I", sub: lower(PAIR[role]) };
}

export function lineCurrentSymbol(role: ThreePhaseRole): Symbol {
  return { base: "I", sub: `${role}${lower(role)}` };
}

export function impedanceSymbol(role: ThreePhaseRole): Symbol {
  return { base: "Z", sub: INDEX[role] };
}

/* Texto corrido (PDF): "EAN", "Van", "IAa", "Z1". */
export function plain(symbol: Symbol): string {
  return `${symbol.base}${symbol.sub}`;
}

/* Fator de potência como na apostila: atrasado (indutivo) / adiantado. */
export function powerFactorText(powerFactor: number, reactivePower: number, digits = 3): string {
  const value = powerFactor.toFixed(digits).replace(".", ",");
  if (Math.abs(reactivePower) < 1e-9) return `${value} (unitário)`;
  return `${value} ${reactivePower > 0 ? "atrasado" : "adiantado"}`;
}
