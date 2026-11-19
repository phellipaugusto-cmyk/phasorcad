# Sprint 04 - Editor Visual

## Objetivo

Transformar o Canvas em um editor gráfico de circuitos.

---

## Escopo

Esta sprint é dedicada exclusivamente à infraestrutura visual.

Nenhuma mudança será feita no solver elétrico.

O objetivo é preparar a interface para futuras funcionalidades:

- Componentes dinâmicos
- Conexões livres
- CircuitGraph
- Novo solver

---

# Estado Atual

## Concluído

✅ Seleção de componentes

✅ Painel de propriedades

✅ Edição pelo painel lateral

✅ Edição direta no Canvas

✅ Proteção contra NaN

✅ Proteção contra Infinity

✅ Drag & Drop básico

---

# Backlog

## 4.1 SVG Connections

Status:
Em andamento

Objetivo:
Substituir linhas fixas por conexões SVG.

Problema atual:

- As conexões não acompanham corretamente todas as posições.
- O desenho atual não se comporta como um editor gráfico.

Critérios de aceite:

- Arrastar V1
- Arrastar R1
- Arrastar C1
- Arrastar L1

Resultado esperado:

As conexões acompanham corretamente os componentes.

---

## 4.1.1 Linhas Ortogonais

Status:
Não iniciado

Objetivo:

Substituir linhas diagonais por linhas em 90°.

Exemplo:

ERRADO

V1
 \
  \
   R1

CORRETO

V1 ─────┐
         │
         │
         └──── R1

Critérios de aceite:

- Sem linhas diagonais
- Conexões acompanham os componentes
- Aparência semelhante a CAD elétrico

---

## 4.2 Snap To Grid

Status:
Não iniciado

Objetivo:

Alinhar automaticamente os componentes na grade.

Configuração inicial:

20 px

Critérios de aceite:

- Arrastar componente
- Soltar componente

Resultado esperado:

O componente encaixa automaticamente na grade.

---

## 4.3 Limites do Canvas

Status:
Não iniciado

Objetivo:

Impedir que componentes saiam da área útil.

Critérios de aceite:

- Não permitir coordenadas negativas
- Não permitir coordenadas fora do Canvas

---

## 4.4 Persistência de Posição

Status:
Não iniciado

Objetivo:

Salvar posições dos componentes dentro do estado React.

Critérios de aceite:

- Posição atualizada no estado
- Layout preservado durante a sessão

Preparação para:

- Salvar projeto
- Abrir projeto
- Exportar JSON

---

# Fora do Escopo

Os itens abaixo NÃO fazem parte do Sprint 04.

## Sprint 05

- Adicionar componentes
- Remover componentes
- IDs automáticos

## Sprint 06

- Criar conexões
- Remover conexões
- Terminais visíveis

## Sprint 07

- CircuitGraph

## Sprint 08

- Novo Solver

## Sprint 09

- Estilo Falstad

---

# Definição de Concluído

O Sprint 04 será considerado concluído quando:

✅ SVG Connections

✅ Linhas Ortogonais

✅ Snap To Grid

✅ Limites do Canvas

✅ Persistência de Posição

estiverem funcionando.