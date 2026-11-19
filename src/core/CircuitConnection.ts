export interface CircuitConnection {
  id: string;

  /*
   * Terminais elétricos reais da conexão.
   *
   * Exemplos:
   *
   * V1:right
   * R1:left
   */
  fromTerminalId: string;

  toTerminalId: string;
}

export function getElementIdFromTerminalId(
  terminalId: string
): string {
  const separatorIndex =
    terminalId.lastIndexOf(
      ":"
    );

  if (separatorIndex === -1) {
    return terminalId;
  }

  return terminalId.slice(
    0,
    separatorIndex
  );
}