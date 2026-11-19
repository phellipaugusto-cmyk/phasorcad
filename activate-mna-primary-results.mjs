import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const appPath = path.join(projectRoot, "src", "App.tsx");

const sourceFiles = [
  {
    source: "MnaElectricalResultsExtractor.ts",
    target: path.join("src", "solver", "MnaElectricalResultsExtractor.ts"),
  },
  {
    source: "MnaCircuitResultBuilder.ts",
    target: path.join("src", "solver", "MnaCircuitResultBuilder.ts"),
  },
  {
    source: "SolverComparisonPanel.tsx",
    target: path.join("src", "components", "ResultsPanel", "SolverComparisonPanel.tsx"),
  },
];

if (!fs.existsSync(appPath)) {
  throw new Error(`Arquivo não encontrado: ${appPath}`);
}

for (const file of sourceFiles) {
  const sourcePath = path.join(projectRoot, file.source);
  const targetPath = path.join(projectRoot, file.target);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Arquivo não encontrado: ${sourcePath}`);
  }

  fs.mkdirSync(path.dirname(targetPath), {
    recursive: true,
  });

  fs.copyFileSync(sourcePath, targetPath);
}

let app = fs.readFileSync(appPath, "utf8");

const builderImport = `import {\n  MnaCircuitResultBuilder,\n} from "./solver/MnaCircuitResultBuilder";\n`;

const extractorImport = `import {\n  MnaElectricalResultsExtractor,\n} from "./solver/MnaElectricalResultsExtractor";\n`;

if (!app.includes(builderImport)) {
  if (!app.includes(extractorImport)) {
    throw new Error("Não encontrei o import de MnaElectricalResultsExtractor.");
  }

  app = app.replace(
    extractorImport,
    `${extractorImport}\n${builderImport}`
  );
}

const comparisonImport = `import {\n  SolverComparisonPanel,\n} from "./components/ResultsPanel/SolverComparisonPanel";\n`;

const resultsPanelImport = `import {\n  ResultsPanel,\n} from "./components/ResultsPanel/ResultsPanel";\n`;

if (!app.includes(comparisonImport)) {
  if (!app.includes(resultsPanelImport)) {
    throw new Error("Não encontrei o import de ResultsPanel.");
  }

  app = app.replace(
    resultsPanelImport,
    `${resultsPanelImport}\n${comparisonImport}`
  );
}

const oldResultStart = "  const result: CircuitResult =";
const newResultMarker = "  const mnaPrimaryResult =";

if (!app.includes(newResultMarker)) {
  const start = app.indexOf(oldResultStart);
  const end = app.indexOf("  function newCircuit()", start);

  if (start < 0 || end < 0) {
    throw new Error("Não encontrei o bloco do resultado antigo.");
  }

  const oldBlock = app.slice(start, end);
  const legacyBlock = oldBlock.replace(
    "const result: CircuitResult =",
    "const legacyResult: CircuitResult ="
  );

  const newBlock = `${legacyBlock}\n  const mnaPrimaryResult =\n    MnaCircuitResultBuilder.build(\n      circuitIsClosed,\n      sourceVoltage,\n      mnaElectricalResults\n    );\n\n  const result: CircuitResult =\n    mnaPrimaryResult.available\n      ? mnaPrimaryResult.result\n      : createEmptyResult();\n\n`;

  app = app.slice(0, start) + newBlock + app.slice(end);
}

if (!app.includes("<SolverComparisonPanel")) {
  const resultsPanelStart = app.indexOf("        <ResultsPanel");
  const resultsPanelEnd = app.indexOf("        />", resultsPanelStart);

  if (resultsPanelStart < 0 || resultsPanelEnd < 0) {
    throw new Error("Não encontrei o componente ResultsPanel.");
  }

  const insertPosition = resultsPanelEnd + "        />".length;
  const comparisonPanel = `\n\n        <SolverComparisonPanel\n          legacyResult={\n            legacyResult\n          }\n          mnaResult={\n            mnaPrimaryResult.result\n          }\n          mnaAvailable={\n            mnaPrimaryResult.available\n          }\n          mnaErrorMessage={\n            mnaPrimaryResult.errorMessage\n          }\n        />`;

  app =
    app.slice(0, insertPosition) +
    comparisonPanel +
    app.slice(insertPosition);
}

const backupPath = `${appPath}.before-mna-primary.bak`;

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(appPath, backupPath);
}

fs.writeFileSync(appPath, app, "utf8");

console.log("[OK] Resultados principais agora usam o solver MNA.");
console.log("[OK] Potência da fonte normalizada como potência entregue negativa.");
console.log("[OK] Comparação temporária entre série e MNA adicionada.");
console.log(`[OK] Backup: ${backupPath}`);
