import { Component } from "../core/Component";
import { Node } from "../core/Node";
import { Complex } from "../math/Complex";

export class ACSource extends Component {
  voltage: number;
  frequency: number;

  constructor(
    id: string,
    nodeA: Node,
    nodeB: Node,
    voltage: number,
    frequency: number
  ) {
    super(
      id,
      nodeA,
      nodeB
    );

    this.voltage =
      voltage;

    this.frequency =
      frequency;
  }

  getImpedance(
    _frequency: number
  ): Complex {
    return new Complex(
      0,
      0
    );
  }
}