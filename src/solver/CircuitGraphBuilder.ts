import type { CircuitConnection } from "../core/CircuitConnection";
import { isSourceType } from "../core/CircuitElement";
import type { CircuitElement } from "../core/CircuitElement";
import type {
  CircuitGraph,
  CircuitGraphBranch,
  CircuitGraphNode,
} from "../core/CircuitGraph";

interface UnionFindItem {
  parent: string;
  rank: number;
}

function createUnionFind(
  terminalIds: string[]
): Map<string, UnionFindItem> {
  const items = new Map<string, UnionFindItem>();

  terminalIds.forEach((terminalId) => {
    items.set(terminalId, {
      parent: terminalId,
      rank: 0,
    });
  });

  return items;
}

function findRoot(
  items: Map<string, UnionFindItem>,
  terminalId: string
): string {
  const item = items.get(terminalId);

  if (!item) {
    return terminalId;
  }

  if (item.parent === terminalId) {
    return terminalId;
  }

  const root = findRoot(items, item.parent);
  item.parent = root;
  return root;
}

function unionTerminals(
  items: Map<string, UnionFindItem>,
  firstTerminalId: string,
  secondTerminalId: string
): void {
  const firstRoot = findRoot(items, firstTerminalId);
  const secondRoot = findRoot(items, secondTerminalId);

  if (firstRoot === secondRoot) {
    return;
  }

  const firstItem = items.get(firstRoot);
  const secondItem = items.get(secondRoot);

  if (!firstItem || !secondItem) {
    return;
  }

  if (firstItem.rank < secondItem.rank) {
    firstItem.parent = secondRoot;
    return;
  }

  if (firstItem.rank > secondItem.rank) {
    secondItem.parent = firstRoot;
    return;
  }

  secondItem.parent = firstRoot;
  firstItem.rank += 1;
}

function getAllTerminalIds(
  elements: CircuitElement[]
): string[] {
  return elements.flatMap((element) =>
    element.terminals.map((terminal) => terminal.id)
  );
}

function connectWireTerminals(
  unionFind: Map<string, UnionFindItem>,
  connections: CircuitConnection[]
): void {
  connections.forEach((connection) => {
    const fromExists = unionFind.has(connection.fromTerminalId);
    const toExists = unionFind.has(connection.toTerminalId);

    if (!fromExists || !toExists) {
      return;
    }

    unionTerminals(
      unionFind,
      connection.fromTerminalId,
      connection.toTerminalId
    );
  });
}

function createNodes(
  terminalIds: string[],
  unionFind: Map<string, UnionFindItem>
): {
  nodes: CircuitGraphNode[];
  terminalToNodeId: Record<string, string>;
} {
  const terminalsByRoot = new Map<string, string[]>();

  terminalIds.forEach((terminalId) => {
    const root = findRoot(unionFind, terminalId);
    const group = terminalsByRoot.get(root) ?? [];
    group.push(terminalId);
    terminalsByRoot.set(root, group);
  });

  const orderedGroups = Array.from(terminalsByRoot.values())
    .map((group) => [...group].sort())
    .sort((firstGroup, secondGroup) =>
      firstGroup[0].localeCompare(secondGroup[0])
    );

  const nodes: CircuitGraphNode[] = [];
  const terminalToNodeId: Record<string, string> = {};

  orderedGroups.forEach((terminalIdsInNode, index) => {
    const nodeId = `N${index}`;

    nodes.push({
      id: nodeId,
      terminalIds: terminalIdsInNode,
    });

    terminalIdsInNode.forEach((terminalId) => {
      terminalToNodeId[terminalId] = nodeId;
    });
  });

  return {
    nodes,
    terminalToNodeId,
  };
}

function createBranches(
  elements: CircuitElement[],
  terminalToNodeId: Record<string, string>
): CircuitGraphBranch[] {
  return elements
    .map((element): CircuitGraphBranch | null => {
      const leftTerminal = element.terminals.find(
        (terminal) => terminal.side === "left"
      );
      const rightTerminal = element.terminals.find(
        (terminal) => terminal.side === "right"
      );

      if (!leftTerminal || !rightTerminal) {
        return null;
      }

      const fromNodeId = terminalToNodeId[leftTerminal.id];
      const toNodeId = terminalToNodeId[rightTerminal.id];

      if (!fromNodeId || !toNodeId) {
        return null;
      }

      return {
        id: `branch-${element.id}`,
        elementId: element.id,
        elementType: element.type,
        fromNodeId,
        toNodeId,
        isBypassed:
          fromNodeId === toNodeId,
      };
    })
    .filter(
      (branch): branch is CircuitGraphBranch => branch !== null
    );
}

function findReferenceTerminalId(
  elements: CircuitElement[]
): string | null {
  const source = elements.find(
    (element) => isSourceType(element.type)
  );

  if (!source) {
    return null;
  }

  const leftTerminal = source.terminals.find(
    (terminal) => terminal.side === "left"
  );

  return leftTerminal?.id ?? null;
}

function findReferenceNodeId(
  elements: CircuitElement[],
  nodes: CircuitGraphNode[],
  terminalToNodeId: Record<string, string>
): {
  referenceNodeId: string | null;
  referenceTerminalId: string | null;
} {
  const referenceTerminalId = findReferenceTerminalId(elements);

  if (referenceTerminalId) {
    const referenceNodeId = terminalToNodeId[referenceTerminalId];

    if (referenceNodeId) {
      return {
        referenceNodeId,
        referenceTerminalId,
      };
    }
  }

  return {
    referenceNodeId: nodes[0]?.id ?? null,
    referenceTerminalId: null,
  };
}

export class CircuitGraphBuilder {
  static build(
    elements: CircuitElement[],
    connections: CircuitConnection[]
  ): CircuitGraph {
    const terminalIds = getAllTerminalIds(elements);
    const unionFind = createUnionFind(terminalIds);

    connectWireTerminals(unionFind, connections);

    const { nodes, terminalToNodeId } = createNodes(
      terminalIds,
      unionFind
    );

    const branches = createBranches(elements, terminalToNodeId);

    const { referenceNodeId, referenceTerminalId } =
      findReferenceNodeId(elements, nodes, terminalToNodeId);

    return {
      nodes,
      branches,
      terminalToNodeId,
      referenceNodeId,
      referenceTerminalId,
    };
  }
}
