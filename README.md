# PhasorCAD

Editor de circuitos CA com análise fasorial, direto no navegador (celular, tablet e computador).

**Acesse:** https://phellipaugusto-cmyk.github.io/phasorcad/

## O que faz

- Monte circuitos com fonte de tensão CA, fonte de corrente, resistor, capacitor e indutor, ligando terminais com fios.
- Várias fontes, cada uma com fase própria (padrão 0°).
- Resultados: Zeq, corrente, P, Q, S e fator de potência; tensões e correntes por componente e por nó.
- Diagrama fasorial (origem comum e soma ponta a ponta), ondas v(t), i(t) e p(t), resposta em frequência.
- Animação (câmera lenta): fios coloridos pela tensão, pontos de corrente nos fios e componentes, fasores girando e cursor nas ondas.
- Relatório em PDF da análise.
- Salvar e abrir circuitos em arquivo `.json`; funciona offline como app instalável (PWA).

## Rodar no computador

```
npm install
npm run dev
```

No Windows/PowerShell, use `npm.cmd` no lugar de `npm`.

Para gerar um arquivo único (`dist-single/PhasorCAD.html`): `npm run build` e depois `npm run single`.

Documentação em `docs/`.

## Licença

MIT.
