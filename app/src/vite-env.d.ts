/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Backend origin, e.g. "http://localhost:8000". Unset on the public
   * (Cloudflare) build → backend features disabled. See src/config.ts.
   */
  readonly VITE_API_BASE_URL?: string;
}

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
    renderToTimemap(opts?: Record<string, unknown>): unknown;
    renderToMIDI(): string;
    getElementsAtTime(ms: number): { notes?: string[]; page?: number; measure?: string };
    select(opts: Record<string, unknown>): void;
    getPageCount(): number;
    redoLayout(): void;
  }
}
