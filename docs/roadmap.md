# PhasorCAD Roadmap

> Atualizado em 19/11/2026 após as Sprints 09.6 a 10 (parte visual).

## Fase 1 - Simulador Interativo ✅

- Fonte, frequência, R1, C1 e L1 editáveis
- Recálculo automático
- Seleção de componentes e painel de propriedades
- Edição pelo painel e direta no Canvas
- Proteção contra NaN e Infinity
- Drag & Drop básico

---

## Sprint 04 - Editor Visual ✅

- 4.1 SVG Connections (`CircuitConnectionsSvg.tsx`)
- 4.1.1 Linhas ortogonais (`createOrthogonalPath`)
- 4.2 Snap To Grid (`snapElementPosition`, `GRID_SIZE`)
- 4.3 Limites do Canvas (`clampElementPosition`)
- 4.4 Persistência de posição (`localStorage`)

---

## Sprint 05 - Componentes Dinâmicos ✅

- Adicionar componentes pela Toolbox
- Remover componentes selecionados (e suas conexões)
- IDs automáticos

---

## Sprint 06 - Conexões Reais ✅

- 6.1 Terminais tipados (`CircuitTerminal`, `terminals` em `CircuitElement`)
- 6.1C Migração do `localStorage` (elementos e conexões) em `storage/circuitStorage.ts`
- 6.1D Conexões por terminal (`fromTerminalId`, `toTerminalId`)
- 6.2 Terminais visíveis no Canvas
- 6.3 / 6.4 Seleção de terminal de origem e destino
- 6.5 Criar conexão (bloqueia duplicatas)
- 6.6 Remover conexão
- 6.7 Detectar circuito aberto, fechado ou em curto (`getCircuitState`)
- Curto-circuito direto na fonte é um estado próprio ("short"), com aviso

Pendência herdada (resolvida na Sprint 09.6):

- ~~Remover os campos temporários `from` / `to` de `CircuitConnection`~~ ✅
  (o Canvas, o roteador e o App usam só `fromTerminalId` / `toTerminalId`;
  arquivos salvos antigos continuam abrindo)

---

## Sprint 07 - CircuitGraph ✅

- `CircuitGraph` e `CircuitGraphBuilder` (nós, ramos, terminal → nó, nó de referência, bypass por fio)
- Separação entre ligação visual e elétrica validada nos testes de topologia

---

## Sprint 08 - Novo Solver (MNA) ✅

- Análise nodal (`AdmittanceMatrixBuilder`) e MNA (`ModifiedNodalAnalysisBuilder`, `ComplexLinearSolver`)
- Extração de resultados por componente (`MnaElectricalResultsExtractor`)
- `TestMnaTopologies`: 8 casos conferidos com cálculo à mão (série, paralelo, misto, R‖C, R em bypass com L, terminal solto, curto, aberto)
- Painel de comparação com o solver série antigo movido para o modo desenvolvedor

---

## Sprint 08.5 - Organização do código ✅

- `App.tsx` reduzido (de ~58 KB para ~24 KB): painéis de depuração e módulo de `localStorage` extraídos
- Modo desenvolvedor (painéis de depuração escondidos por padrão, preferência salva)
- Testes de console carregados só em desenvolvimento (`import.meta.env.DEV`)

---

## Sprint 09 - Esquemático e Diagrama Fasorial ✅

- Roteador de fios ortogonal com desvio de componentes e pontos de junção (`wireRouter.ts`)
- Símbolos de circuito em SVG (resistor, capacitor, indutor, fonte CA)
- Canvas 720 × 480 com folga nas bordas e posicionamento inicial alinhado
- Diagrama fasorial de tensões e correntes (`components/PhasorDiagram`), com escala automática e tabela módulo ∠ ângulo
- `TestPhasorDiagram`: RL série conferido com cálculo à mão, nas duas orientações da fonte
- Modo "Soma (ponta a ponta)" do diagrama: setas entre os potenciais dos nós, fechando na tensão da fonte
- Ondas no tempo v(t) e i(t) do componente selecionado (ou da fonte), com defasagem em graus e em ms (`components/Waveform`)
- `TestWaveform`: picos, período e defasagem (atrasada, adiantada e em fase) conferidos com cálculo à mão
- Validado na tela: RC paralelo+série e R‖R + C + L (soma de Kirchhoff fecha em 220 V)

---

## Sprint 09.5 - Espaço de trabalho ✅

- Layout em tela inteira (colunas 220 px | Canvas | 380 px de resultados)
- Canvas dinâmico: ocupa o espaço livre, nunca fica menor que o circuito e rola quando a janela é pequena
- Barras de frequência e de estado compactadas; botão "Centralizar circuito"


---

## Sprint 09.6 - Organização e arquivos ✅

- `App.tsx` dividido em hooks: `useCircuitEditor` (estado, persistência e ações) e
  `useCircuitAnalysis` (grafo, MNA, resultados e animação, memoizados); de ~1360 para ~550 linhas
- `TestCircuitGraph` e `TestMnaElectricalResults` incluídos nos imports de desenvolvimento
- Salvar e abrir circuitos em `.json` (`storage/circuitFile.ts`), com validação (formato, versão,
  ids duplicados, uma única fonte, terminais inexistentes) e `TestCircuitFile`
- `npm run single`: gera `dist-single/PhasorCAD.html`, o app inteiro em um arquivo (roda com dois
  cliques, sem Node, sem servidor)

---

## Sprint 09.7 - Fonte de corrente ✅

- Novo elemento `currentSource` (símbolo em círculo com seta, valor em A eficaz, fase 0°)
- Uma única fonte por circuito, de tensão **ou** de corrente
- MNA: injeção direta no vetor de termos independentes (sem variável extra de corrente)
- Impedância equivalente = V(terminais) / Is; fasorial, ondas, potências e resposta em frequência
  funcionam com os dois tipos de fonte
- `TestCurrentSource`: série RL (VR, VL, V da fonte 125,24 V ∠37,02°, Zeq, P, Q) e paralelo R‖C
  (V = 76,92 V ∠-75,14°, IR, IC) conferidos com cálculo à mão; circuito aberto

---

## Sprint 09.8 - Análises e zoom ✅

- Potência instantânea p(t) = v·i sob as ondas, com média P, pico e vale (`PowerWave`);
  `TestPowerWave` (RL série: P = 423,7 W, picos 876,6 e -29,12 W; resistor puro)
- Resposta em frequência (`FrequencySweep`): |Zeq|, |I| ou |V| da fonte, tensão e corrente de cada
  componente, fase de Zeq, ressonância (fase = 0°) e marcador da frequência atual; escala
  logarítmica; faixa editável; só calcula com o painel aberto
- `TestFrequencySweep`: RLC série (f₀ = 50,33 Hz, |Z| = R, |I| = 22 A) e RLC paralelo com fonte de
  corrente (|Z| máximo = R)
- Zoom do Canvas: botões −/+, 100%, "Ajustar", Ctrl + roda ancorada no ponteiro; arraste, grade e
  roteador continuam em coordenadas lógicas; zoom lembrado entre sessões; `TestCanvasZoom`

---

## Sprint 09.9 - Várias fontes e ângulo de fase ✅

- Qualquer número de fontes de tensão e de corrente no mesmo circuito (mesma frequência)
- Cada fonte tem **ângulo de fase** (campo "Fase" no painel do componente; padrão 0° quando vazio); o rótulo
  no Canvas mostra "módulo ∠fase" quando a fase não é 0°
- MNA com fasores complexos nas fontes; referência (GND) = terminal esquerdo da primeira fonte
- Estado do circuito por fonte: curto só em fonte de tensão ligada só por fios; fechado quando todas as
  fontes têm caminho (uma fonte em série com a outra não impede o fechamento)
- Resultados: com uma fonte, Zeq e corrente como antes (agora válidos com fase); com várias, potência
  entregue por fonte e P, Q, S, FP das cargas (não existe Zeq única)
- Diagrama fasorial e ondas respeitam a fase de cada fonte
- Arquivos `.json` guardam a fase e aceitam várias fontes
- A resposta em frequência exige uma única fonte
- `TestMultipleSources`: V ∠0° + V ∠90° em série (I = 1,414 A ∠45°, 200 W), V em série com I (20 W + 20 W =
  40 W), V ‖ I ∠90° (V1: 200 W / +100 var; I1: 0 W / −100 var) e fonte única com fase 30°

---

## Sprint 10 - Estilo Falstad (em andamento)

Feito:

- Animação "Animar": fios coloridos pela tensão instantânea do nó (verde +, vermelho −, cinza ≈ 0) e
  pontos de corrente que vão e voltam em cada componente, em câmera lenta (`circuitAnimation`,
  `TestCircuitAnimation`)
- Circuitos arbitrários validados: ponte de Wheatstone desbalanceada (Req = 239,44 Ω,
  I(R5) = 11,76 mA) e escada RC conferida por fórmula independente (`TestArbitraryTopologies`)

Falta:

- Construção livre: ligar um fio a outro fio (ponto de junção livre)
- Conexões livres: arrastar um terminal até outro, sem passar pela barra de seleção
- Corrente nos fios (hoje os pontos andam só nos componentes)

---

## Próximas ideias

- Fontes de frequências diferentes (superposição no tempo)
- Desfazer / refazer, copiar e colar componentes
- Diagrama de Bode em dB e exportação de gráficos (PNG / SVG)
- Mostrar os valores no formato de engenharia (k, m, µ) nas caixas de edição

- [x] Relatório em PDF da análise (esquema, resultados, tabelas, fasores, ondas, varredura) — `src/report/`, gerado no navegador com pdf-lib (`npm install` instala a dependência).
