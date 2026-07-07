declare module "katex/dist/contrib/auto-render.js" {
  export default function renderMathInElement(
    element: HTMLElement,
    options?: {
      delimiters?: Array<{ left: string; right: string; display: boolean }>;
      throwOnError?: boolean;
    }
  ): void;
}
