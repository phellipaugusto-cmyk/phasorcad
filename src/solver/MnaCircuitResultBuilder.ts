import type { CircuitState } from "./CircuitTopology";

import type {
  CircuitResult,
} from "../core/CircuitResult";

import type {
  MnaElectricalResults,
} from "../core/MnaElectricalResults";

import type {
  ComplexValue,
} from "../core/NodalAnalysis";

import {
  Complex,
} from "../math/Complex";

export interface MnaPrimaryResult {
  result: CircuitResult;

  available: boolean;

  errorMessage: string | null;

  sourceCurrent: ComplexValue;

  equivalentImpedance: ComplexValue;
}

function createComplexValue(
  real = 0,
  imaginary = 0
): ComplexValue {
  return {
    real,
    imaginary,
  };
}

function magnitude(
  value: ComplexValue
): number {
  return Math.hypot(
    value.real,
    value.imaginary
  );
}

function divide(
  numerator: ComplexValue,
  denominator: ComplexValue
): ComplexValue | null {
  const denominatorMagnitudeSquared =
    denominator.real * denominator.real +
    denominator.imaginary * denominator.imaginary;

  if (denominatorMagnitudeSquared < 1e-24) {
    return null;
  }

  return {
    real:
      (
        numerator.real * denominator.real +
        numerator.imaginary * denominator.imaginary
      ) /
      denominatorMagnitudeSquared,

    imaginary:
      (
        numerator.imaginary * denominator.real -
        numerator.real * denominator.imaginary
      ) /
      denominatorMagnitudeSquared,
  };
}

function createEmptyCircuitResult(): CircuitResult {
  return {
    zeq:
      new Complex(
        0,
        0
      ),

    current:
      new Complex(
        0,
        0
      ),

    activePower:
      0,

    reactivePower:
      0,

    apparentPower:
      0,

    powerFactor:
      0,
  };
}

function createUnavailableResult(
  errorMessage: string | null
): MnaPrimaryResult {
  return {
    result:
      createEmptyCircuitResult(),

    available:
      false,

    errorMessage,

    sourceCurrent:
      createComplexValue(),

    equivalentImpedance:
      createComplexValue(),
  };
}

export class MnaCircuitResultBuilder {
  static build(
    circuitState: CircuitState,
    _sourceVoltage: number,
    electricalResults:
      MnaElectricalResults
  ): MnaPrimaryResult {
    if (circuitState === "short") {
      return createUnavailableResult(
        "Curto-circuito na fonte: existe um caminho só de fios entre os dois terminais."
      );
    }

    if (circuitState === "open") {
      return createUnavailableResult(
        "O circuito está aberto."
      );
    }

    if (!electricalResults.available) {
      return createUnavailableResult(
        electricalResults.errorMessage
      );
    }

    const sourceResults =
      electricalResults.elementResults.filter(
        (elementResult) =>
          elementResult.isSource
      );

    if (sourceResults.length === 0) {
      return createUnavailableResult(
        "Nenhuma fonte resolvida foi encontrada."
      );
    }

    /* Potência absorvida pelas cargas (soma dos componentes). */
    const loadPower =
      electricalResults.elementResults
        .filter(
          (elementResult) =>
            !elementResult.isSource &&
            !elementResult.isBypassed
        )
        .reduce(
          (total, elementResult) => ({
            real:
              total.real +
              elementResult.complexPower.real,

            imaginary:
              total.imaginary +
              elementResult.complexPower.imaginary,
          }),
          createComplexValue()
        );

    const apparentPower =
      magnitude(
        loadPower
      );

    const powerFactor =
      apparentPower > 1e-12
        ? Math.abs(
            loadPower.real
          ) /
          apparentPower
        : 0;

    /*
     * Potência entregue por cada fonte. O MNA mostra a
     * potência da fonte com sinal negativo quando ela entrega;
     * aqui invertemos para valores positivos de "entregue".
     */
    const sourcePowers =
      sourceResults.map(
        (sourceResult) => ({
          elementId:
            sourceResult.elementId,

          activePower:
            -sourceResult.complexPower.real,

          reactivePower:
            -sourceResult.complexPower.imaginary,
        })
      );

    /*
     * Com várias fontes não existe uma impedância equivalente
     * única nem uma corrente total: o resultado principal traz
     * só as potências (a soma entregue = a soma absorvida).
     */
    if (sourceResults.length > 1) {
      return {
        result: {
          zeq:
            new Complex(0, 0),

          current:
            new Complex(0, 0),

          activePower:
            loadPower.real,

          reactivePower:
            loadPower.imaginary,

          apparentPower,
          powerFactor,

          sourceCount:
            sourceResults.length,

          sourcePowers,
        },

        available:
          true,

        errorMessage:
          null,

        sourceCurrent:
          createComplexValue(),

        equivalentImpedance:
          createComplexValue(),
      };
    }

    const sourceResult =
      sourceResults[0];

    /*
     * A variável MNA da fonte segue a orientação
     * matemática from → to. Para o painel principal,
     * usamos a corrente fornecida ao circuito, que é
     * o sentido oposto.
     */
    const sourceCurrent = {
      real:
        -sourceResult.current.real,

      imaginary:
        -sourceResult.current.imaginary,
    };

    const currentMagnitude =
      magnitude(
        sourceCurrent
      );

    if (currentMagnitude < 1e-12) {
      return createUnavailableResult(
        "A corrente total da fonte é zero."
      );
    }

    /*
     * Tensão nos terminais em convenção de gerador:
     * V(to) - V(from) = -(tensão do ramo). Vale para fonte de
     * tensão ou de corrente e para qualquer ângulo de fase.
     */
    const terminalVoltage = {
      real:
        -sourceResult.voltage.real,

      imaginary:
        -sourceResult.voltage.imaginary,
    };

    const equivalentImpedance =
      divide(
        terminalVoltage,
        sourceCurrent
      );

    if (!equivalentImpedance) {
      return createUnavailableResult(
        "Não foi possível calcular a impedância equivalente."
      );
    }

    return {
      result: {
        zeq:
          new Complex(
            equivalentImpedance.real,
            equivalentImpedance.imaginary
          ),

        current:
          new Complex(
            sourceCurrent.real,
            sourceCurrent.imaginary
          ),

        activePower:
          loadPower.real,

        reactivePower:
          loadPower.imaginary,

        apparentPower,
        powerFactor,

        sourceCount: 1,

        sourcePowers,
      },

      available:
        true,

      errorMessage:
        null,

      sourceCurrent,
      equivalentImpedance,
    };
  }
}
