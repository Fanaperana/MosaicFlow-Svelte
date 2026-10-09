declare module '@susisu/mte-kernel' {
  export type AlignmentValue = 'none' | 'left' | 'right' | 'center';

  export const Alignment: Readonly<{
    NONE: AlignmentValue;
    LEFT: AlignmentValue;
    RIGHT: AlignmentValue;
    CENTER: AlignmentValue;
  }>;

  export interface Point {
    row: number;
    column: number;
  }

  export interface Range {
    start: Point;
    end: Point;
  }

  export interface ITextEditor {
    getCursorPosition(): Point;
    setCursorPosition(pos: Point): void;
    setSelectionRange(range: Range): void;
    getLastRow(): number;
    acceptsTableEdit(row: number): boolean;
    getLine(row: number): string;
    insertLine(row: number, line: string): void;
    deleteLine(row: number): void;
    replaceLines(startRow: number, endRow: number, lines: string[]): void;
    transact(fn: () => void): void;
  }

  export interface TableOptions {
    smartCursor?: boolean;
    [key: string]: unknown;
  }

  export function options(obj?: TableOptions): TableOptions;

  export class TableEditor {
    constructor(textEditor: ITextEditor);
    cursorIsInTable(opts: TableOptions): boolean;
    resetSmartCursor(): void;
    format(opts: TableOptions): void;
    formatAll(opts: TableOptions): void;
    nextCell(opts: TableOptions): void;
    previousCell(opts: TableOptions): void;
    nextRow(opts: TableOptions): void;
    escape(opts: TableOptions): void;
    alignColumn(alignment: AlignmentValue, opts: TableOptions): void;
    insertRow(opts: TableOptions): void;
    deleteRow(opts: TableOptions): void;
    insertColumn(opts: TableOptions): void;
    deleteColumn(opts: TableOptions): void;
    moveRow(offset: number, opts: TableOptions): void;
    moveColumn(offset: number, opts: TableOptions): void;
  }
}
