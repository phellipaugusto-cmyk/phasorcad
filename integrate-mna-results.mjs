import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const appPath = path.join(projectRoot, "src", "App.tsx");
const panelSourcePath = path.join(projectRoot, "MnaElectricalResultsPanel.tsx");
const panelTargetPath = path.join(
  projectRoot,
  "src",
  "components",
  "ResultsPanel",
  "MnaElectricalResultsPanel.tsx"
);

if (!fs.existsSync(appPath)) {
  throw new Error(`Arquivo não encontrado: ${appPath}`);
}

if (!fs.existsSync(panelSourcePath)) {
  throw new Error(`Arquivo não encontrado: ${panelSourcePath}`);
}

let app = fs.readFileSync(appPath, "utf8");

const extractorImport = `import {\n  MnaElectricalResultsExtractor,\n} from "./solver/MnaElectricalResultsExtractor";\n`;

const solverImport = `import {\n  ComplexLinearSolver,\n} from "./solver/ComplexLinearSolver";\n`;

if (!app.includes(extractorImport)) {
  if (!app.includes(solverImport)) {
    throw new Error("Não encontrei o import de ComplexLinearSolver no App.tsx.");
  }

  app = app.replace(
    solverImport,
    `${solverImport}\n${extractorImport}`
  );
}

const panelImport = `import {\n  MnaElectricalResultsPanel,\n} from "./components/ResultsPanel/MnaElectricalResultsPanel";\n`;

const resultsPanelImport = `import {\n  ResultsPanel,\n} from "./components/ResultsPanel/ResultsPanel";\n`;

if (!app.includes(panelImport)) {
  if (!app.includes(resultsPanelImport)) {
    throw new Error("Não encontrei o import de ResultsPanel no App.tsx.");
  }

  app = app.replace(
    resultsPanelImport,
    `${resultsPanelImport}\n${panelImport}`
  );
}

const solutionBlock = `  const mnaSolution =\n    ComplexLinearSolver.solve(\n      modifiedNodalAnalysis.matrix.map(\n        (row) =>\n          row.values\n      ),\n      modifiedNodalAnalysis.rightHandSide\n    );\n`;

const extractionBlock = `\n  const mnaElectricalResults =\n    MnaElectricalResultsExtractor.extract(\n      circuitGraph,\n      elements,\n      modifiedNodalAnalysis,\n      mnaSolution,\n      frequency\n    );\n`;

if (!app.includes("const mnaElectricalResults =")) {
  if (!app.includes(solutionBlock)) {
    throw new Error("Não encontrei o bloco mnaSolution no App.tsx.");
  }

  app = app.replace(
    solutionBlock,
    `${solutionBlock}${extractionBlock}`
  );
}

const solutionTitle = "            Solução MNA Complexa\n          </summary>";

if (!app.includes("<MnaElectricalResultsPanel")) {
  const solutionStart = app.indexOf(solutionTitle);

  if (solutionStart < 0) {
    throw new Error("Não encontrei a seção Solução MNA Complexa no App.tsx.");
  }

  const detailsClose = app.indexOf("        </details>", solutionStart);

  if (detailsClose < 0) {
    throw new Error("Não encontrei o fechamento da seção Solução MNA Complexa.");
  }

  const insertPosition = detailsClose + "        </details>".length;
  const resultPanel = `\n\n        <MnaElectricalResultsPanel\n          results={\n            mnaElectricalResults\n          }\n        />`;

  app =
    app.slice(0, insertPosition) +
    resultPanel +
    app.slice(insertPosition);
}

fs.mkdirSync(path.dirname(panelTargetPath), {
  recursive: true,
});

fs.copyFileSync(panelSourcePath, panelTargetPath);

const backupPath = `${appPath}.before-mna-results.bak`;

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(appPath, backupPath);
}

fs.writeFileSync(appPath, app, "utf8");

console.log("[OK] App.tsx integrado com Resultados Elétricos MNA.");
console.log(`[OK] Painel criado em: ${panelTargetPath}`);
console.log(`[OK] Backup preservado em: ${backupPath}`);
