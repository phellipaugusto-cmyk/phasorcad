import type { ReportInput } from "./circuitReport";

/* Gera o PDF e dispara o download no navegador. */
export async function downloadCircuitReport(
  input: Omit<ReportInput, "generatedAt">
): Promise<void> {
  const { buildCircuitReport } = await import("./circuitReport");

  const generatedAt = new Date();
  const bytes = await buildCircuitReport({ ...input, generatedAt });

  const two = (value: number) => String(value).padStart(2, "0");

  const stamp =
    `${generatedAt.getFullYear()}-${two(generatedAt.getMonth() + 1)}-${two(generatedAt.getDate())}` +
    `_${two(generatedAt.getHours())}h${two(generatedAt.getMinutes())}`;

  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `PhasorCAD-relatorio-${stamp}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
