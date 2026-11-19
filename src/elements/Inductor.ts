import { Component } from "../core/Component";
import { Node } from "../core/Node";
import { Complex } from "../math/Complex";

export class Inductor extends Component {
  inductance: number;

  constructor(
    id: string,
    nodeA: Node,
    nodeB: Node,
    inductance: number
  ) {
    super(id, nodeA, nodeB);

    this.inductance = inductance;
  }

  getImpedance(
    frequency: number
  ): Complex {

    const omega =
      2 * Math.PI * frequency;

    return new Complex(
      0,
      omega * this.inductance
    );

  }
}