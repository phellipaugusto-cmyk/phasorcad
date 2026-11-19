import { useMemo } from "react";

import {
  isSourceType,
} from "../core/CircuitElement";

import {
  buildAnimationModel,
} from "../components/Canvas/circuitAnimation";

import type {
  CircuitElement,
} from "../core/CircuitElement";

import type {
  CircuitConnection,
} from "../core/CircuitConnection";

import type {
  CircuitResult,
} from "../core/CircuitResult";

import {
  Complex,
} from "../math/Complex";

import {
  defaultCircuitModel,
} from "../data/defaultCircuitModel";

import {
  CircuitBuilder,
} from "../solver/CircuitBuilder";

import {
  ACAnalyzer,
} from "../solver/ACAnalyzer";

import {
  getCircuitState,
} from "../solver/CircuitTopology";

import {
  CircuitGraphBuilder,
} from "../solver/CircuitGraphBuilder";

import {
  AdmittanceMatrixBuilder,
} from "../solver/AdmittanceMatrixBuilder";

import {
  ModifiedNodalAnalysisBuilder,
} from "../solver/ModifiedNodalAnalysisBuilder";

import {
  ComplexLinearSolver,
} from "../solver/ComplexLinearSolver";

import {
  MnaElectricalResultsExtractor,
} from "../solver/MnaElectricalResultsExtractor";

import {
  MnaCircuitResultBuilder,
} from "../solver/MnaCircuitResultBuilder";
import {
  resolveContactors,
} from "../solver/contactorResolver";

function createEmptyResult(): CircuitResult {
  return {
    zeq: new Complex(0, 0),
    current: new Complex(0, 0),
    activePower: 0,
    reactivePower: 0,
    apparentPower: 0,
    powerFactor: 0,
  };
}

/*
 * Toda a análise elétrica derivada do circuito atual:
 * estado, grafo, MNA, resultados por componente e o
 * resultado principal. Só recalcula quando um dos
 * quatro insumos muda.
 */
export function useCircuitAnalysis(
  editorElements: CircuitElement[],
  connections: CircuitConnection[],
  frequency: number,
  sourceVoltage: number
) {
  return useMemo(() => {
    /*
     * Contatores: os contatos comandados recebem o estado vindo
     * das bobinas antes de qualquer outra análise.
     */
    const contactorResolution =
      resolveContactors(
        editorElements,
        connections,
        frequency
      );

    const elements =
      contactorResolution.elements;

    const hasSource =
      elements.some(
        (element) =>
          isSourceType(element.type)
      );

  const circuitState =
    getCircuitState(
      elements,
      connections
    );

  const circuitIsClosed =
    circuitState === "closed";

  const circuitStatusStyle =
    circuitState === "closed"
      ? {
          border: "#16a34a",
          background: "#f0fdf4",
          color: "#15803d",
          label: "FECHADO",
          message:
            "Existe um caminho elétrico fechado entre os terminais das fontes (fontes de tensão sem carga apenas não entregam corrente).",
        }
      : circuitState === "short"
        ? {
            border: "#ea580c",
            background: "#fff7ed",
            color: "#c2410c",
            label: "CURTO-CIRCUITO",
            message:
              "Fios ligam diretamente os dois terminais de uma fonte de tensão, sem nenhum componente no caminho. O cálculo foi desativado.",
          }
        : {
            border: "#dc2626",
            background: "#fef2f2",
            color: "#b91c1c",
            label: "ABERTO",
            message:
              "Nenhuma fonte de tensão tem um caminho completo entre seus terminais (ou uma fonte de corrente está em aberto). A corrente é zero.",
          };

  const circuitGraph =
    CircuitGraphBuilder.build(
      elements,
      connections
    );

  const nodalAnalysis =
    AdmittanceMatrixBuilder.build(
      circuitGraph,
      elements,
      frequency
    );

  const modifiedNodalAnalysis =
    ModifiedNodalAnalysisBuilder.build(
      circuitGraph,
      elements,
      frequency
    );

  const mnaSolution =
    ComplexLinearSolver.solve(
      modifiedNodalAnalysis.matrix.map(
        (row) =>
          row.values
      ),
      modifiedNodalAnalysis.rightHandSide
    );

  const mnaElectricalResults =
    MnaElectricalResultsExtractor.extract(
      circuitGraph,
      elements,
      modifiedNodalAnalysis,
      mnaSolution,
      frequency
    );

  const safeFrequency =
    Math.max(
      frequency,
      0.000001
    );


  /*
   * O analisador série recebe somente componentes
   * passivos ligados entre dois nós diferentes.
   * Ramos com origem e destino no mesmo nó estão
   * desviados por um fio e não alteram a impedância.
   */
  const bypassedElementIds =
    new Set<string>(
      circuitGraph.branches
        .filter(
          (branch) =>
            branch.isBypassed
        )
        .map(
          (branch) =>
            branch.elementId
        )
    );

  const analysisElementIds =
    new Set<string>(
      circuitGraph.branches
        .filter(
          (branch) =>
            !isSourceType(branch.elementType) &&
            !branch.isBypassed
        )
        .map(
          (branch) =>
            branch.elementId
        )
    );

  const analysisElements =
    elements.filter(
      (element) =>
        analysisElementIds.has(
          element.id
        )
    );

  const circuitForAnalysis = {
    ...defaultCircuitModel,

    frequency:
      safeFrequency,

    elements:
      analysisElements,

    connections,
  };

  const impedances =
    CircuitBuilder.buildImpedances(
      circuitForAnalysis,
      safeFrequency
    );

  const canAnalyze =
    circuitIsClosed &&
    hasSource &&
    sourceVoltage > 0 &&
    impedances.length > 0;

  const legacyResult: CircuitResult =
    canAnalyze
      ? ACAnalyzer.analyzeSeriesCircuit(
          sourceVoltage,
          impedances
        )
      : createEmptyResult();


  const mnaPrimaryResult =
    MnaCircuitResultBuilder.build(
      circuitState,
      sourceVoltage,
      mnaElectricalResults
    );

  const result: CircuitResult =
    mnaPrimaryResult.available
      ? mnaPrimaryResult.result
      : createEmptyResult();


    const animationModel =
      buildAnimationModel(
        circuitGraph,
        mnaElectricalResults,
        elements,
        connections
      );

    return {
      animationModel,
      circuitState,
      circuitIsClosed,
      circuitStatusStyle,
      circuitGraph,
      nodalAnalysis,
      modifiedNodalAnalysis,
      mnaSolution,
      mnaElectricalResults,
      mnaPrimaryResult,
      legacyResult,
      result,
      bypassedElementIds,
      resolvedElements: elements,
      coilStates: contactorResolution.coilStates,
      contactorsConverged: contactorResolution.converged,
    };
  }, [editorElements, connections, frequency, sourceVoltage]);
}
