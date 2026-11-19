import { Complex } from "../math/Complex";

export interface CircuitResult {

  zeq: Complex;

  current: Complex;

  activePower: number;

  reactivePower: number;

  apparentPower: number;

  powerFactor: number;

  /* Quantas fontes o circuito tem (ausente em resultados vazios). */
  sourceCount?: number;

  /* Potência entregue por cada fonte (positiva = entrega). */
  sourcePowers?: {
    elementId: string;
    activePower: number;
    reactivePower: number;
  }[];

}
