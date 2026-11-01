// Server-only: emitted in the SSR HTML so it runs synchronously before first paint.
// Avoid next/script here — it renders the <script> from a client component, which
// React 19 warns about ("Encountered a script tag while rendering React component").
export function InlineScript({ id, html }: { id: string; html: string }) {
  return <script id={id} dangerouslySetInnerHTML={{ __html: html }} />;
}
