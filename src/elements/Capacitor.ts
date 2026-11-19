import { Component } from "../core/Component";
import { Node } from "../core/Node";
import { Complex } from "../math/Complex";

export class Capacitor extends Component {
  capacitance: number;

  constructor(
    id: string,
    nodeA: Node,
    nodeB: Node,
    capacitance: number
  ) {
    super(id, nodeA, nodeB);

    this.capacitance = capacitance;
  }

  getImpedance(
    frequency: number
  ): Complex {

    const omega =
      2 * Math.PI * frequency;

    return new Complex(
      0,
      -1 / (
        omega *
        this.capacitance
      )
    );

  }
}