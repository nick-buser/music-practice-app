/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module 'verovio/wasm' {
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(opts: Record<string, unknown>): void;
    getOptions(): Record<string, unknown>;
    loadData(data: string): boolean;
    renderToSVG(pageNo: number): string;
    select(opts: Record<string, unknown>): void;
    getPageCount(): number;
    redoLayout(): void;
  }
}
