import { Component } from "../core/Component";
import { Node } from "../core/Node";
import { Complex } from "../math/Complex";

export class Resistor extends Component {
  resistance: number;

  constructor(
    id: string,
    nodeA: Node,
    nodeB: Node,
    resistance: number
  ) {
    super(
      id,
      nodeA,
      nodeB
    );

    this.resistance =
      resistance;
  }

  getImpedance(
    _frequency: number
  ): Complex {
    return new Complex(
      this.resistance,
      0
    );
  }
}