import {
  MOTOR_DEFAULT_POWER_KW,
  MOTOR_MAX_LOAD_FACTOR,
  getMotorParameters,
  type MotorParameters,
} from "../core/motorModel";
import { LAMP_DEFAULT_POWER_W } from "../core/lampModel";
import {
  CONTACTOR_DEFAULT_HOLDING_VA,
  getContactorParameters,
  type ContactorParameters,
} from "../core/contactorModel";
import type { SwitchControlChange } from "../components/Properties/SwitchFields";
import type { MeasuredReadings } from "../core/CircuitElement";
import { createBenchPreset } from "../data/benchPreset";
import {
  createThreePhasePreset,
  THREE_PHASE_PRESET_IMPEDANCE,
  THREE_PHASE_PRESET_LINE_VOLTAGE,
  type ThreePhasePresetKind,
} from "../data/threePhasePresets";
import {
  createThreePhaseLoad,
  createThreePhaseSource,
  alignGroups,
  enforceBalance,
  getGroupIds,
  syncGroupPositions,
  getGroupMembers,
  rebuildGroup,
} from "../core/threePhase";
import {
  IMPEDANCE_DEFAULTS,
  getImpedanceMagnitude,
  getImpedanceParameters,
  type ImpedanceParameters,
} from "../core/impedanceModel";
import {
  useEffect,
  useCallback,
  useState,
} from "react";

import {
  isSourceType,
} from "../core/CircuitElement";

import type {
  CircuitElement,
} from "../core/CircuitElement";

import type {
  CircuitConnection,
} from "../core/CircuitConnection";

import {
  getElementIdFromTerminalId,
} from "../core/CircuitConnection";

import {
  createCircuitTerminals,
} from "../core/CircuitTerminal";

import {
  defaultCircuitModel,
} from "../data/defaultCircuitModel";

import {
  clearStoredCircuit,
  loadConnections,
  loadElements,
  saveConnections,
  saveElements,
} from "../storage/circuitStorage";

import {
  parseCircuitFile,
  serializeCircuit,
} from "../storage/circuitFile";

import {
  loadShowDebugPanels,
  saveShowDebugPanels,
} from "../storage/uiPreferences";

/*
 * Estado do editor (componentes, conexões, seleção,
 * frequência) e as ações que o alteram.
 */
/* Tempo que a botoeira fica pressionada num toque (ms). */
const PULSE_MS = 500;

export function useCircuitEditor() {
  const [
    elements,
    setRawElements,
  ] =
    useState<CircuitElement[]>(
      () => alignGroups(loadElements())
    );

  /*
   * Toda alteração passa por enforceBalance: um bloco trifásico
   * editado num membro tem os outros dois igualados.
   */
  const setElements = useCallback(
    (
      update:
        | CircuitElement[]
        | ((current: CircuitElement[]) => CircuitElement[])
    ) =>
      setRawElements((current) =>
        enforceBalance(
          current,
          alignGroups(
            syncGroupPositions(
              current,
              typeof update === "function" ? update(current) : update
            )
          )
        )
      ),
    []
  );

  const [
    connections,
    setConnections,
  ] =
    useState<CircuitConnection[]>(
      () =>
        loadConnections(
          elements
        )
    );

  const [
    frequency,
    setFrequency,
  ] =
    useState(
      defaultCircuitModel.frequency
    );

  const initialSource =
    elements.find(
      (element) =>
        element.type === "source"
    );

  const [
    sourceVoltage,
    setSourceVoltage,
  ] =
    useState(
      initialSource?.value ?? 0
    );

  const [
    selectedElementId,
    setSelectedElementId,
  ] =
    useState<string | null>(
      null
    );

  const [
    selectedConnectionId,
    setSelectedConnectionId,
  ] =
    useState<string | null>(
      null
    );

  const [
    editingElementId,
    setEditingElementId,
  ] =
    useState<string | null>(
      null
    );

  const [
    showDebugPanels,
    setShowDebugPanels,
  ] =
    useState(
      loadShowDebugPanels
    );

  useEffect(() => {
    saveElements(
      elements
    );
  }, [elements]);

  useEffect(() => {
    saveConnections(
      connections
    );
  }, [connections]);

  useEffect(() => {
    saveShowDebugPanels(
      showDebugPanels
    );
  }, [showDebugPanels]);

  const selectedElement =
    elements.find(
      (element) =>
        element.id ===
        selectedElementId
    ) ?? null;

  const selectedConnection =
    connections.find(
      (connection) =>
        connection.id ===
        selectedConnectionId
    ) ?? null;

  const sourceElement =
    elements.find(
      (element) =>
        isSourceType(element.type)
    );

  const hasSource =
    sourceElement !== undefined;

  const connectedElementIds =
    new Set<string>();

  connections.forEach(
    (connection) => {
      connectedElementIds.add(
        getElementIdFromTerminalId(
          connection.fromTerminalId
        )
      );

      connectedElementIds.add(
        getElementIdFromTerminalId(
          connection.toTerminalId
        )
      );
    }
  );

  /*
   * Bloco trifásico: protegido só se houver fio externo (os fios
   * internos da estrela/triângulo não contam).
   */
  const selectedGroupMemberIds = selectedElement?.group
    ? new Set(
        getGroupMembers(elements, selectedElement.group.id).map((m) => m.id)
      )
    : null;

  const selectedElementIsProtected =
    selectedElement
      ? selectedGroupMemberIds
        ? connections.some(
            (connection) =>
              selectedGroupMemberIds.has(
                getElementIdFromTerminalId(connection.fromTerminalId)
              ) !==
              selectedGroupMemberIds.has(
                getElementIdFromTerminalId(connection.toTerminalId)
              )
          )
        : connectedElementIds.has(
            selectedElement.id
          )
      : false;

  function newCircuit() {
    const shouldCreate =
      window.confirm(
        "Criar um novo circuito? Todos os componentes e conexões atuais serão removidos."
      );

    if (!shouldCreate) {
      return;
    }

    clearStoredCircuit();

    setElements(
      []
    );

    setConnections(
      []
    );

    setSelectedElementId(
      null
    );

    setSelectedConnectionId(
      null
    );

    setEditingElementId(
      null
    );

    setSourceVoltage(
      0
    );

    setFrequency(
      defaultCircuitModel.frequency
    );
  }

  function saveCircuitToFile() {
    const text =
      serializeCircuit(
        elements,
        connections,
        frequency
      );

    const url =
      URL.createObjectURL(
        new Blob(
          [text],
          {
            type:
              "application/json",
          }
        )
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      "circuito-phasorcad.json";

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  }

  async function openCircuitFile(
    file: File
  ) {
    let text: string;

    try {
      text =
        await file.text();
    } catch {
      window.alert(
        "Não foi possível ler o arquivo."
      );

      return;
    }

    const parsed =
      parseCircuitFile(
        text
      );

    if (!parsed.ok) {
      window.alert(
        `Não foi possível abrir o circuito: ${parsed.error}`
      );

      return;
    }

    const shouldOpen =
      window.confirm(
        "Abrir este circuito? O circuito atual será substituído."
      );

    if (!shouldOpen) {
      return;
    }

    const voltageSource =
      parsed.data.elements.find(
        (element) =>
          element.type ===
          "source"
      );

    setElements(
      parsed.data.elements
    );

    setConnections(
      parsed.data.connections
    );

    setFrequency(
      parsed.data.frequency
    );

    setSourceVoltage(
      voltageSource?.value ?? 0
    );

    setSelectedElementId(
      null
    );

    setSelectedConnectionId(
      null
    );

    setEditingElementId(
      null
    );
  }

  /* Dados de placa do motor selecionado (com os valores padrão). */
  function getSelectedMotor() {
    return selectedElement?.type === "motor"
      ? getMotorParameters(selectedElement)
      : null;
  }

  function updateSelectedMotor(
    changes: Partial<MotorParameters>
  ) {
    if (selectedElement?.type !== "motor") {
      return;
    }

    const elementId = selectedElement.id;
    const current = getMotorParameters(selectedElement);

    const clean = (
      value: number | undefined,
      fallback: number,
      min: number,
      max: number
    ) =>
      value !== undefined && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback;

    const next: MotorParameters = {
      efficiency: clean(changes.efficiency, current.efficiency, 0.05, 1),
      powerFactor: clean(changes.powerFactor, current.powerFactor, 0.05, 1),
      ratedVoltage: clean(changes.ratedVoltage, current.ratedVoltage, 1, 100000),
      loadFactor: clean(changes.loadFactor, current.loadFactor, 0, MOTOR_MAX_LOAD_FACTOR),
    };

    setElements((currentElements) =>
      currentElements.map((element) =>
        element.id === elementId
          ? { ...element, motor: next }
          : element
      )
    );
  }

  /* Liga/desliga o interruptor selecionado. */
  function toggleSelectedSwitch() {
    if (selectedElement?.type !== "switch") {
      return;
    }

    const elementId = selectedElement.id;

    setElements((currentElements) =>
      currentElements.map((element) =>
        element.id === elementId
          ? { ...element, closed: element.closed === false }
          : element
      )
    );
  }

  /* Tensão nominal da lâmpada selecionada (V). */
  function updateSelectedLampVoltage(volts: number) {
    if (
      selectedElement?.type !== "lamp" ||
      !Number.isFinite(volts) ||
      volts <= 0
    ) {
      return;
    }

    const elementId = selectedElement.id;

    setElements((currentElements) =>
      currentElements.map((element) =>
        element.id === elementId
          ? { ...element, lamp: { ratedVoltage: volts } }
          : element
      )
    );
  }

  /*
   * Leitura de bancada do componente selecionado. NaN (campo
   * vazio) apaga a leitura daquela grandeza.
   */
  function updateSelectedMeasured(
    quantity: keyof MeasuredReadings,
    value: number
  ) {
    if (!selectedElement) {
      return;
    }

    const elementId = selectedElement.id;

    setElements((currentElements) =>
      currentElements.map((element) => {
        if (element.id !== elementId) {
          return element;
        }

        const next: MeasuredReadings = { ...element.measured };

        if (Number.isFinite(value)) {
          next[quantity] = value;
        } else {
          delete next[quantity];
        }

        const rest = { ...element };
        delete rest.measured;

        return Object.keys(next).length > 0
          ? { ...rest, measured: next }
          : rest;
      })
    );
  }

  /* Manual ou contato de uma bobina; NA/NF. */
  function updateSelectedSwitchControl(change: SwitchControlChange) {
    if (selectedElement?.type !== "switch") {
      return;
    }

    const elementId = selectedElement.id;

    setElements((currentElements) =>
      currentElements.map((element) => {
        if (element.id !== elementId) {
          return element;
        }

        const next = { ...element };

        if (change.controlledBy !== undefined) {
          if (change.controlledBy === "") {
            delete next.controlledBy;
            delete next.normallyClosed;
          } else {
            next.controlledBy = change.controlledBy;
          }
        }

        if (change.momentary !== undefined) {
          if (change.momentary) {
            next.momentary = true;
          } else {
            delete next.momentary;
            delete next.pressed;
          }
        }

        if (change.normallyClosed !== undefined) {
          if (change.normallyClosed) {
            next.normallyClosed = true;
          } else {
            delete next.normallyClosed;
          }
        }

        return next;
      })
    );
  }

  /*
   * Toque numa botoeira: pressiona e solta depois de um instante.
   * Nesse intervalo a análise roda e a bobina guarda o estado.
   */
  function pulseSwitch(elementId: string) {
    const setPressed = (pressed: boolean) =>
      setElements((currentElements) =>
        currentElements.map((element) =>
          element.id === elementId && element.momentary
            ? { ...element, pressed }
            : element
        )
      );

    setPressed(true);
    window.setTimeout(() => setPressed(false), PULSE_MS);
  }

  /*
   * Guarda nas bobinas o estado calculado (memória para o selo).
   * Sem mudança, devolve a mesma lista e o React não re-renderiza.
   */
  function syncCoilStates(states: Record<string, { energized: boolean }>) {
    setElements((currentElements) => {
      let changed = false;

      const next = currentElements.map((element) => {
        const state = states[element.id];

        if (
          element.type !== "contactor" ||
          !state ||
          (element.energized === true) === state.energized
        ) {
          return element;
        }

        changed = true;
        return { ...element, energized: state.energized };
      });

      return changed ? next : currentElements;
    });
  }

  function updateSelectedContactor(changes: Partial<ContactorParameters>) {
    if (selectedElement?.type !== "contactor") {
      return;
    }

    const elementId = selectedElement.id;
    const current = getContactorParameters(selectedElement);
    const next: ContactorParameters = {
      ratedVoltage:
        changes.ratedVoltage !== undefined &&
        Number.isFinite(changes.ratedVoltage) &&
        changes.ratedVoltage > 0
          ? changes.ratedVoltage
          : current.ratedVoltage,
      powerFactor:
        changes.powerFactor !== undefined &&
        Number.isFinite(changes.powerFactor)
          ? Math.min(1, Math.max(0.05, changes.powerFactor))
          : current.powerFactor,
    };

    setElements((currentElements) =>
      currentElements.map((element) =>
        element.id === elementId ? { ...element, contactor: next } : element
      )
    );
  }

  /* Abre o exemplo da bancada de Circuitos 2. */
  function loadBenchPreset() {
    const shouldOpen = window.confirm(
      "Abrir o exemplo da bancada (fases A e B, lâmpadas, contator e motor)? O circuito atual será substituído."
    );

    if (!shouldOpen) {
      return;
    }

    const preset = createBenchPreset();
    const firstSource = preset.elements.find(
      (element) => element.type === "source"
    );

    setElements(preset.elements);
    setConnections(preset.connections);
    setFrequency(preset.frequency);
    setSourceVoltage(firstSource?.value ?? 0);
    setSelectedElementId(null);
    setSelectedConnectionId(null);
    setEditingElementId(null);
  }

  /* Fase (°) da fonte selecionada; 0 quando não foi informada. */
  function getSelectedPhase(): number {
    return selectedElement?.phase ?? 0;
  }

  function updateSelectedPhase(
    degrees: number
  ) {
    if (
      !selectedElement ||
      !isSourceType(
        selectedElement.type
      ) ||
      !Number.isFinite(degrees)
    ) {
      return;
    }

    const elementId =
      selectedElement.id;

    setElements(
      (currentElements) =>
        currentElements.map(
          (element) =>
            element.id === elementId
              ? {
                  ...element,
                  phase: degrees,
                }
              : element
        )
    );
  }

  function getNextElementId(
    type: CircuitElement["type"]
  ): string {
    const prefixes: Record<
      CircuitElement["type"],
      string
    > = {
      source: "V",
      currentSource: "I",
      resistor: "R",
      capacitor: "C",
      inductor: "L",
      motor: "M",
      lamp: "LP",
      switch: "S",
      contactor: "K",
      impedance: "Z",
    };

    const prefix =
      prefixes[type];

    const existingNumbers =
      elements
        .filter(
          (element) =>
            element.type === type
        )
        .map(
          (element) => {
            const expression =
              new RegExp(
                `^${prefix}`
              );

            const number =
              Number(
                element.id.replace(
                  expression,
                  ""
                )
              );

            return Number.isFinite(
              number
            )
              ? number
              : 0;
          }
        );

    const highestNumber =
      existingNumbers.length > 0
        ? Math.max(
            ...existingNumbers
          )
        : 0;

    return `${prefix}${highestNumber + 1}`;
  }

  function getNewElementPosition(): {
    x: number;
    y: number;
  } {
    /*
     * Novos componentes entram em linhas alinhadas à grade
     * de 20 px, com o mesmo y por linha, como em um
     * esquemático.
     */
    const index =
      elements.length;

    const column =
      index % 5;

    const row =
      Math.floor(
        index / 5
      );

    return {
      x:
        40 +
        column * 140,

      y:
        Math.min(
          120 +
            row * 160,
          360
        ),
    };
  }

  function addElement(
    type: CircuitElement["type"],
    defaultValue: number
  ) {
    const id =
      getNextElementId(
        type
      );

    const position =
      getNewElementPosition();

    const newElement: CircuitElement = {
      id,
      type,
      label:
        id,
      value:
        defaultValue,
      x:
        position.x,
      y:
        position.y,
      terminals:
        createCircuitTerminals(
          id
        ),
    };

    setElements(
      (
        currentElements
      ) => [
        ...currentElements,
        newElement,
      ]
    );

    setSelectedConnectionId(
      null
    );

    setSelectedElementId(
      id
    );

    setEditingElementId(
      null
    );
  }

  function addSource() {
    const initialVoltage =
      220;

    addElement(
      "source",
      initialVoltage
    );

    /* O estado legado guarda a tensão da primeira fonte de tensão. */
    if (
      !elements.some(
        (element) =>
          element.type === "source"
      )
    ) {
      setSourceVoltage(
        initialVoltage
      );
    }
  }

  function addCurrentSource() {
    addElement(
      "currentSource",
      1
    );
  }

  function addResistor() {
    addElement(
      "resistor",
      100
    );
  }

  function addCapacitor() {
    addElement(
      "capacitor",
      100 / 1_000_000
    );
  }

  function addMotor() {
    addElement(
      "motor",
      MOTOR_DEFAULT_POWER_KW
    );
  }

  function addLamp() {
    addElement(
      "lamp",
      LAMP_DEFAULT_POWER_W
    );
  }

  function addSwitch() {
    addElement(
      "switch",
      0
    );
  }

  /* Próximo id livre de bloco trifásico: G1, G2… / CG1, CG2… */
  function getNextGroupId(prefix: string): string {
    const used = new Set(getGroupIds(elements));
    let n = 1;
    while (used.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }

  function addGroup(
    created: { elements: CircuitElement[]; connections: CircuitConnection[] }
  ) {
    setElements((current) => [...current, ...created.elements]);
    setConnections((current) => [...current, ...created.connections]);
    setSelectedConnectionId(null);
    setSelectedElementId(created.elements[0]?.id ?? null);
    setEditingElementId(null);
  }

  /* Gerador trifásico equilibrado (Y, 220 V de linha, ABC). */
  function addThreePhaseSource() {
    const groupId = getNextGroupId("G");
    const position = getNewElementPosition();

    addGroup(
      createThreePhaseSource({
        groupId,
        connection: "Y",
        lineVoltage: THREE_PHASE_PRESET_LINE_VOLTAGE,
        label: `Gerador ${groupId.slice(1)}`,
        ...position,
      })
    );
  }

  /* Carga trifásica equilibrada (Y, 8 + j6 Ω por fase). */
  function addThreePhaseLoad() {
    const groupId = getNextGroupId("CG");
    const position = getNewElementPosition();

    addGroup(
      createThreePhaseLoad({
        groupId,
        connection: "Y",
        impedance: THREE_PHASE_PRESET_IMPEDANCE,
        label: `Carga ${groupId.slice(2)}`,
        ...position,
      })
    );
  }

  function addImpedance() {
    addElement("impedance", getImpedanceMagnitude(IMPEDANCE_DEFAULTS));
  }

  /* R e X (Ω, X em 60 Hz) da impedância selecionada. */
  function updateSelectedImpedance(changes: Partial<ImpedanceParameters>) {
    if (selectedElement?.type !== "impedance") {
      return;
    }

    const elementId = selectedElement.id;
    const current = getImpedanceParameters(selectedElement);
    const next: ImpedanceParameters = {
      resistance:
        changes.resistance !== undefined &&
        Number.isFinite(changes.resistance) &&
        changes.resistance >= 0
          ? changes.resistance
          : current.resistance,
      reactance:
        changes.reactance !== undefined && Number.isFinite(changes.reactance)
          ? changes.reactance
          : current.reactance,
    };

    if (getImpedanceMagnitude(next) === 0) {
      return;
    }

    setElements((currentElements) =>
      currentElements.map((element) =>
        element.id === elementId
          ? { ...element, impedance: next, value: getImpedanceMagnitude(next) }
          : element
      )
    );
  }

  /*
   * Bloco trifásico do componente selecionado: ligação (Y/Δ),
   * sequência e tensão de linha do gerador.
   */
  function updateSelectedGroup(changes: {
    connection?: "Y" | "D";
    sequence?: "ABC" | "ACB";
    lineVoltage?: number;
    balanced?: boolean;
  }) {
    const group = selectedElement?.group;

    if (!group || !selectedElement) {
      return;
    }

    /*
     * Equilibrada ↔ desequilibrada. Ao voltar a equilibrar, as três
     * fases recebem a Z do membro selecionado.
     */
    if (changes.balanced !== undefined && group.kind === "source") {
      /* Voltar a equilibrar: as três com o módulo da selecionada. */
      const volts = selectedElement.value;

      setElements((currentElements) =>
        currentElements.map((element) => {
          if (element.group?.id !== group.id) {
            return element;
          }

          const nextGroup = { ...element.group };

          if (changes.balanced) {
            delete nextGroup.balanced;
            return { ...element, group: nextGroup, value: volts };
          }

          return { ...element, group: { ...nextGroup, balanced: false } };
        })
      );
      return;
    }

    if (changes.balanced !== undefined) {
      const z = getImpedanceParameters(selectedElement);

      setElements((currentElements) =>
        currentElements.map((element) => {
          if (element.group?.id !== group.id) {
            return element;
          }

          const nextGroup = { ...element.group };

          if (changes.balanced) {
            delete nextGroup.balanced;
            return {
              ...element,
              group: nextGroup,
              impedance: { ...z },
              value: getImpedanceMagnitude(z),
            };
          }

          return { ...element, group: { ...nextGroup, balanced: false } };
        })
      );
      return;
    }

    if (changes.lineVoltage !== undefined) {
      const volts = changes.lineVoltage;

      if (!Number.isFinite(volts) || volts <= 0 || group.kind !== "source") {
        return;
      }

      const phaseValue = group.connection === "Y" ? volts / Math.sqrt(3) : volts;

      setElements((currentElements) =>
        currentElements.map((element) =>
          element.group?.id === group.id ? { ...element, value: phaseValue } : element
        )
      );
      return;
    }

    if (changes.connection === undefined && changes.sequence === undefined) {
      return;
    }

    const selectedRole = group.role;
    const rebuilt = rebuildGroup(elements, connections, group.id, changes);
    const newSelected = getGroupMembers(rebuilt.elements, group.id).find(
      (member) => member.group?.role === selectedRole
    );

    setElements(rebuilt.elements);
    setConnections(rebuilt.connections);
    setSelectedElementId(newSelected?.id ?? null);
  }

  /* Abre um exemplo trifásico (Y-Y, Y-Δ, Δ-Y, Δ-Δ). */
  function loadThreePhasePreset(kind: ThreePhasePresetKind) {
    const shouldOpen = window.confirm(
      "Abrir o exemplo trifásico? O circuito atual será substituído."
    );

    if (!shouldOpen) {
      return;
    }

    const preset = createThreePhasePreset(kind);

    setElements(preset.elements);
    setConnections(preset.connections);
    setFrequency(preset.frequency);
    setSourceVoltage(preset.elements[0]?.value ?? 0);
    setSelectedElementId(null);
    setSelectedConnectionId(null);
    setEditingElementId(null);
  }

  /* Botoeira NA (pulso). */
  function addPushButton() {
    const id = getNextElementId("switch");
    const position = getNewElementPosition();

    setElements((currentElements) => [
      ...currentElements,
      {
        id,
        type: "switch",
        label: `B ${id}`,
        value: 0,
        momentary: true,
        x: position.x,
        y: position.y,
        terminals: createCircuitTerminals(id),
      },
    ]);
    setSelectedConnectionId(null);
    setSelectedElementId(id);
    setEditingElementId(null);
  }

  /* Bobina do contator + um contato NA já ligado a ela. */
  function addContactor() {
    const coilId = getNextElementId("contactor");
    const contactId = getNextElementId("switch");
    const position = getNewElementPosition();

    const coil: CircuitElement = {
      id: coilId,
      type: "contactor",
      label: coilId,
      value: CONTACTOR_DEFAULT_HOLDING_VA,
      contactor: getContactorParameters({}),
      x: position.x,
      y: position.y,
      terminals: createCircuitTerminals(coilId),
    };

    const contact: CircuitElement = {
      id: contactId,
      type: "switch",
      label: `Contato ${coilId}`,
      value: 0,
      controlledBy: coilId,
      x: position.x,
      y: position.y + 120,
      terminals: createCircuitTerminals(contactId),
    };

    setElements((currentElements) => [...currentElements, coil, contact]);
    setSelectedConnectionId(null);
    setSelectedElementId(coilId);
    setEditingElementId(null);
  }

  function addInductor() {
    addElement(
      "inductor",
      100 / 1000
    );
  }

  function removeSelectedElement() {
    if (!selectedElement) {
      return;
    }

    /*
     * Membro de bloco trifásico: remove o bloco inteiro (com os
     * fios internos), desde que nenhum fio externo esteja ligado.
     */
    if (selectedElement.group) {
      const groupId = selectedElement.group.id;
      const memberIds = new Set(
        getGroupMembers(elements, groupId).map((member) => member.id)
      );
      const touches = (connection: CircuitConnection) => [
        memberIds.has(getElementIdFromTerminalId(connection.fromTerminalId)),
        memberIds.has(getElementIdFromTerminalId(connection.toTerminalId)),
      ];
      const hasExternal = connections.some((connection) => {
        const [from, to] = touches(connection);
        return from !== to;
      });

      if (hasExternal) {
        return;
      }

      setElements((current) => current.filter((e) => !memberIds.has(e.id)));
      setConnections((current) =>
        current.filter((connection) => {
          const [from, to] = touches(connection);
          return !from && !to;
        })
      );
      setSelectedElementId(null);
      setEditingElementId(null);
      return;
    }

    if (
      connectedElementIds.has(
        selectedElement.id
      )
    ) {
      return;
    }

    const elementId =
      selectedElement.id;

    const removingSource =
      selectedElement.type === "source";

    setElements(
      (
        currentElements
      ) =>
        currentElements.filter(
          (element) =>
            element.id !== elementId
        )
    );

    setConnections(
      (
        currentConnections
      ) =>
        currentConnections.filter(
          (connection) =>
            getElementIdFromTerminalId(
              connection.fromTerminalId
            ) !== elementId &&
            getElementIdFromTerminalId(
              connection.toTerminalId
            ) !== elementId
        )
    );

    if (removingSource) {
      setSourceVoltage(
        0
      );
    }

    setSelectedElementId(
      null
    );

    setSelectedConnectionId(
      null
    );

    setEditingElementId(
      null
    );
  }

  function removeSelectedConnection() {
    if (!selectedConnection) {
      return;
    }

    const connectionId =
      selectedConnection.id;

    setConnections(
      (
        currentConnections
      ) =>
        currentConnections.filter(
          (connection) =>
            connection.id !==
            connectionId
        )
    );

    setSelectedConnectionId(
      null
    );
  }

  function getDisplayValue(): number {
    if (!selectedElement) {
      return 0;
    }

    switch (
      selectedElement.type
    ) {
      case "capacitor":
        return (
          selectedElement.value *
          1_000_000
        );

      case "inductor":
        return (
          selectedElement.value *
          1000
        );

      default:
        return selectedElement.value;
    }
  }

  function getUnit(): string {
    if (!selectedElement) {
      return "";
    }

    switch (
      selectedElement.type
    ) {
      case "source":
        return "V";

      case "currentSource":
        return "A";

      case "resistor":
        return "Ω";

      case "capacitor":
        return "µF";

      case "inductor":
        return "mH";
      case "motor":
        return "kW";

      case "lamp":
        return "W";

      case "contactor":
        return "VA";

      case "impedance":
        return "Ω";

      default:
        return "";
    }
  }

  function updateSelectedElement(
    value: number
  ) {
    if (!selectedElement) {
      return;
    }

    let convertedValue =
      value;

    switch (
      selectedElement.type
    ) {
      case "capacitor":
        convertedValue =
          Math.max(
            value,
            0.000001
          ) / 1_000_000;
        break;

      case "inductor":
        convertedValue =
          Math.max(
            value,
            0.000001
          ) / 1000;
        break;

      case "resistor":
        convertedValue =
          Math.max(
            value,
            0.000001
          );
        break;
      case "motor":
        convertedValue =
          Math.max(
            value,
            0.001
          );
        break;

      case "lamp":
        convertedValue =
          Math.max(
            value,
            0.1
          );

        break;

      case "switch":
        return;

      case "impedance":
        return;

      case "contactor":
        convertedValue =
          Math.max(
            value,
            0.1
          );

        break;

      case "source":
        convertedValue =
          Math.max(
            value,
            0
          );

        setSourceVoltage(
          convertedValue
        );
        break;

      case "currentSource":
        convertedValue =
          Math.max(
            value,
            0
          );
        break;
    }

    setElements(
      (
        currentElements
      ) =>
        currentElements.map(
          (element) =>
            element.id ===
            selectedElement.id
              ? {
                  ...element,

                  value:
                    convertedValue,
                }
              : element
        )
    );
  }

  return {
    elements,
    setElements,
    connections,
    setConnections,
    frequency,
    setFrequency,
    sourceVoltage,
    setSourceVoltage,
    selectedElementId,
    setSelectedElementId,
    selectedConnectionId,
    setSelectedConnectionId,
    editingElementId,
    setEditingElementId,
    showDebugPanels,
    setShowDebugPanels,
    selectedElement,
    selectedConnection,
    hasSource,
    connectedElementIds,
    selectedElementIsProtected,
    newCircuit,
    saveCircuitToFile,
    openCircuitFile,
    addSource,
    addCurrentSource,
    addResistor,
    addCapacitor,
    addInductor,
    addMotor,
    addLamp,
    addSwitch,
    loadBenchPreset,
    toggleSelectedSwitch,
    updateSelectedLampVoltage,
    updateSelectedMeasured,
    updateSelectedSwitchControl,
    updateSelectedContactor,
    addContactor,
    addPushButton,
    addThreePhaseSource,
    addThreePhaseLoad,
    addImpedance,
    updateSelectedImpedance,
    updateSelectedGroup,
    loadThreePhasePreset,
    pulseSwitch,
    syncCoilStates,
    removeSelectedElement,
    removeSelectedConnection,
    getDisplayValue,
    getUnit,
    updateSelectedElement,
    getSelectedPhase,
    updateSelectedPhase,
    getSelectedMotor,
    updateSelectedMotor,
  };
}
