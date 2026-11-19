import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

/*
 * Pequena camada sobre o pdf-lib: fontes padrão do PDF (sem
 * incorporar arquivos de fonte). Letras latinas vêm da Helvetica;
 * símbolos como Ω, ∠, →, −, φ vêm da fonte Symbol do PDF.
 */

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN = 40;
export const CONTENT_W = PAGE_W - MARGIN * 2;

export function hex(color: string) {
  const value = parseInt(color.slice(1), 16);

  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255
  );
}

export interface TextOptions {
  size?: number;
  bold?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
}

export class Pdf {
  doc!: PDFDocument;
  page!: PDFPage;
  /* Posição vertical atual (de cima para baixo, em pontos do topo). */
  cursor = MARGIN;

  private regular!: PDFFont;
  private bold!: PDFFont;
  private symbol!: PDFFont;
  private regularSet!: Set<number>;
  private boldSet!: Set<number>;
  private symbolSet!: Set<number>;

  static async create(): Promise<Pdf> {
    const pdf = new Pdf();

    pdf.doc = await PDFDocument.create();
    pdf.regular = await pdf.doc.embedFont(StandardFonts.Helvetica);
    pdf.bold = await pdf.doc.embedFont(StandardFonts.HelveticaBold);
    pdf.symbol = await pdf.doc.embedFont(StandardFonts.Symbol);
    pdf.regularSet = new Set(pdf.regular.getCharacterSet());
    pdf.boldSet = new Set(pdf.bold.getCharacterSet());
    pdf.symbolSet = new Set(pdf.symbol.getCharacterSet());
    pdf.newPage();

    return pdf;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.cursor = MARGIN + 18;
  }

  /* Garante `height` pontos livres; senão abre uma página nova. */
  ensure(height: number) {
    if (this.cursor + height > PAGE_H - MARGIN - 14) {
      this.newPage();
    }
  }

  /* y do PDF (origem embaixo) a partir da posição "do topo". */
  py(fromTop: number) {
    return PAGE_H - fromTop;
  }

  private runs(text: string, bold: boolean) {
    const main = bold ? this.bold : this.regular;
    const mainSet = bold ? this.boldSet : this.regularSet;
    const out: { text: string; font: PDFFont }[] = [];

    for (const original of text) {
      /* O "µ" da Helvetica falha em alguns leitores; usa o μ da Symbol. */
      const char = original === "\u00b5" ? "\u03bc" : original;
      const code = char.codePointAt(0)!;
      let font = main;

      if (!mainSet.has(code) || code === 0x3bc) {
        if (this.symbolSet.has(code)) {
          font = this.symbol;
        } else {
          font = main;
          continue;
        }
      }

      const last = out[out.length - 1];

      if (last && last.font === font) {
        last.text += char;
      } else {
        out.push({ text: char, font });
      }
    }

    return out;
  }

  width(text: string, size = 10, bold = false) {
    return this.runs(text, bold).reduce(
      (sum, run) => sum + run.font.widthOfTextAtSize(run.text, size),
      0
    );
  }

  /* Escreve texto com a linha de base em `baselineFromTop`. */
  text(
    text: string,
    x: number,
    baselineFromTop: number,
    options: TextOptions = {},
    page: PDFPage = this.page
  ) {
    const size = options.size ?? 10;
    const bold = options.bold ?? false;
    const total = this.width(text, size, bold);

    let cursorX = x;

    if (options.align === "center") {
      cursorX = x - total / 2;
    } else if (options.align === "right") {
      cursorX = x - total;
    }

    this.runs(text, bold).forEach((run) => {
      page.drawText(run.text, {
        x: cursorX,
        y: this.py(baselineFromTop),
        size,
        font: run.font,
        color: hex(options.color ?? "#111827"),
      });

      cursorX += run.font.widthOfTextAtSize(run.text, size);
    });
  }

  /* Quebra o texto em linhas que cabem em `maxWidth`. */
  wrap(text: string, maxWidth: number, size = 10, bold = false) {
    const lines: string[] = [];
    let current = "";

    text.split(/\s+/).forEach((word) => {
      const attempt = current ? `${current} ${word}` : word;

      if (this.width(attempt, size, bold) <= maxWidth || !current) {
        current = attempt;
      } else {
        lines.push(current);
        current = word;
      }
    });

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  paragraph(
    text: string,
    options: TextOptions & { width?: number; leading?: number } = {}
  ) {
    const size = options.size ?? 10;
    const leading = options.leading ?? size * 1.4;
    const lines = this.wrap(
      text,
      options.width ?? CONTENT_W,
      size,
      options.bold
    );

    lines.forEach((line) => {
      this.ensure(leading);
      this.cursor += leading;
      this.text(line, MARGIN, this.cursor - (leading - size) / 2 - 1, options);
    });
  }

  heading(text: string) {
    this.ensure(40);
    this.cursor += 14;
    this.text(text, MARGIN, this.cursor + 12, {
      size: 13,
      bold: true,
      color: "#1e3a8a",
    });
    this.cursor += 18;
    this.line(MARGIN, this.cursor + 2, PAGE_W - MARGIN, this.cursor + 2, {
      color: "#93c5fd",
      width: 1,
    });
    this.cursor += 8;
  }

  line(
    x1: number,
    y1FromTop: number,
    x2: number,
    y2FromTop: number,
    options: { color?: string; width?: number; dash?: number[] } = {},
    page: PDFPage = this.page
  ) {
    page.drawLine({
      start: { x: x1, y: this.py(y1FromTop) },
      end: { x: x2, y: this.py(y2FromTop) },
      thickness: options.width ?? 1,
      color: hex(options.color ?? "#111827"),
      dashArray: options.dash,
    });
  }

  polyline(
    points: [number, number][],
    options: { color?: string; width?: number } = {},
    page: PDFPage = this.page
  ) {
    for (let i = 1; i < points.length; i++) {
      this.line(
        points[i - 1][0],
        points[i - 1][1],
        points[i][0],
        points[i][1],
        options,
        page
      );
    }
  }

  circle(
    x: number,
    yFromTop: number,
    radius: number,
    options: { stroke?: string; fill?: string; width?: number } = {},
    page: PDFPage = this.page
  ) {
    page.drawCircle({
      x,
      y: this.py(yFromTop),
      size: radius,
      borderColor: options.stroke ? hex(options.stroke) : undefined,
      borderWidth: options.stroke ? (options.width ?? 1) : 0,
      color: options.fill ? hex(options.fill) : undefined,
    });
  }

  rect(
    x: number,
    yFromTop: number,
    w: number,
    h: number,
    options: { stroke?: string; fill?: string; width?: number } = {},
    page: PDFPage = this.page
  ) {
    page.drawRectangle({
      x,
      y: this.py(yFromTop + h),
      width: w,
      height: h,
      borderColor: options.stroke ? hex(options.stroke) : undefined,
      borderWidth: options.stroke ? (options.width ?? 1) : 0,
      color: options.fill ? hex(options.fill) : undefined,
    });
  }

  /* Ponta de seta em (x2,y2) vindo de (x1,y1). */
  arrow(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: { color?: string; width?: number } = {},
    page: PDFPage = this.page
  ) {
    const color = options.color ?? "#111827";
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = 7;
    const spread = 0.42;

    this.line(x1, y1, x2, y2, { color, width: options.width ?? 1.4 }, page);

    const p1: [number, number] = [
      x2 - head * Math.cos(angle - spread),
      y2 - head * Math.sin(angle - spread),
    ];
    const p2: [number, number] = [
      x2 - head * Math.cos(angle + spread),
      y2 - head * Math.sin(angle + spread),
    ];

    /* Triângulo preenchido por linhas bem próximas. */
    page.drawSvgPath(
      `M ${x2} ${y2} L ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} Z`,
      {
        x: 0,
        y: PAGE_H,
        color: hex(color),
        borderColor: hex(color),
        borderWidth: 0.5,
      }
    );
  }

  /* Tabela com cabeçalho repetido a cada página. */
  table(
    columns: { title: string; width: number; align?: "left" | "right" | "center" }[],
    rows: string[][],
    size = 8.5
  ) {
    const rowH = size + 8;

    const drawHeader = () => {
      this.rect(MARGIN, this.cursor, CONTENT_W, rowH + 2, { fill: "#e0e7ff" });

      let x = MARGIN;

      columns.forEach((column) => {
        const tx =
          column.align === "right"
            ? x + column.width - 4
            : column.align === "center"
              ? x + column.width / 2
              : x + 4;

        this.text(column.title, tx, this.cursor + rowH - 2, {
          size,
          bold: true,
          align: column.align ?? "left",
          color: "#1e3a8a",
        });

        x += column.width;
      });

      this.cursor += rowH + 2;
    };

    this.ensure(rowH * 3 + 6);
    drawHeader();

    rows.forEach((row, index) => {
      if (this.cursor + rowH > PAGE_H - MARGIN - 14) {
        this.newPage();
        drawHeader();
      }

      if (index % 2 === 1) {
        this.rect(MARGIN, this.cursor, CONTENT_W, rowH, { fill: "#f8fafc" });
      }

      let x = MARGIN;

      columns.forEach((column, i) => {
        const tx =
          column.align === "right"
            ? x + column.width - 4
            : column.align === "center"
              ? x + column.width / 2
              : x + 4;

        this.text(row[i] ?? "", tx, this.cursor + rowH - 3, {
          size,
          align: column.align ?? "left",
        });

        x += column.width;
      });

      this.cursor += rowH;
    });

    this.line(MARGIN, this.cursor, PAGE_W - MARGIN, this.cursor, {
      color: "#cbd5e1",
      width: 0.6,
    });
    this.cursor += 6;
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

/* Número no formato brasileiro (vírgula decimal). */
export function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const rounded = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;

  return rounded
    .toFixed(digits)
    .replace(".", ",")
    .replace("-", "−");
}
