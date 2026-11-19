import { Node } from "./Node";
import { Complex } from "../math/Complex";

export abstract class Component {
  id: string;
  nodeA: Node;
  nodeB: Node;

  constructor(
    id: string,
    nodeA: Node,
    nodeB: Node
  ) {
    this.id = id;
    this.nodeA = nodeA;
    this.nodeB = nodeB;
  }

  abstract getImpedance(
    frequency: number
  ): Complex;
}