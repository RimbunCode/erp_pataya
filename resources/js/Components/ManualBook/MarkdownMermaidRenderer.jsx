import { memo, useEffect, useRef, useState } from "react";

let mermaidInitialized = false;

async function getMermaid() {
  const { default: mermaid } = await import("mermaid");

  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false, theme: "default" });
    mermaidInitialized = true;
  }

  return mermaid;
}

/**
 * Elemen yang benar-benar memegang `dangerouslySetInnerHTML`. Di-memo dan
 * TIDAK PERNAH re-render ulang selama `html` tidak berubah — penting karena
 * blok mermaid di-render jadi SVG lewat manipulasi DOM manual (di luar
 * React) pada elemen ini; kalau React sampai re-render div ini (mis. akibat
 * state lain di parent berubah), DOM manual itu bisa ketimpa balik ke HTML
 * asli sebelum sempat terlihat user.
 */
const RawContent = memo(
  function RawContent({ innerRef, html }) {
    return (
      <div
        ref={innerRef}
        className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-blue-500 [&_a]:underline [&_a]:underline-offset-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
  (prev, next) => prev.html === next.html,
);

/**
 * Render HTML markdown (hasil convert backend) dan generate diagram Mermaid
 * jadi SVG sebelum konten dianggap siap ditampilkan/di-print.
 * @param {object} props
 * @param {string} props.html
 * @param {(ready: boolean) => void} [props.onReadyChange]
 * @param {(headings: Array<{id: string, text: string, level: number}>) => void} [props.onHeadingsChange]
 * @returns {JSX.Element}
 */
export default function MarkdownMermaidRenderer({
  html,
  onReadyChange,
  onHeadingsChange,
}) {
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const headings = Array.from(
      container.querySelectorAll("h2[id], h3[id]"),
    ).map((el) => ({
      id: el.id,
      text: el.textContent ?? "",
      level: el.tagName === "H2" ? 2 : 3,
    }));

    onHeadingsChange?.(headings);
  }, [html, onHeadingsChange]);

  useEffect(() => {
    let cancelled = false;
    onReadyChange?.(false);

    async function renderDiagrams() {
      const container = containerRef.current;
      if (!container) return;

      const codeBlocks = container.querySelectorAll(
        'pre > code[class*="language-mermaid"], pre > code.mermaid',
      );

      if (codeBlocks.length === 0) {
        if (!cancelled) {
          setIsReady(true);
          onReadyChange?.(true);
        }
        return;
      }

      const mermaid = await getMermaid();
      if (cancelled) return;

      for (const [index, codeBlock] of codeBlocks.entries()) {
        const source = codeBlock.textContent ?? "";
        const pre = codeBlock.closest("pre");
        const diagramId = `manual-book-mermaid-${index}-${Date.now()}`;

        try {
          const { svg } = await mermaid.render(diagramId, source);
          const wrapper = document.createElement("div");
          wrapper.className =
            "manual-book-mermaid not-prose my-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-4";
          wrapper.innerHTML = svg;
          pre?.replaceWith(wrapper);
        } catch (error) {
          console.error("Gagal render diagram mermaid:", error, source);
          if (pre) pre.dataset.mermaidError = "true";
        }
      }

      if (!cancelled) {
        setIsReady(true);
        onReadyChange?.(true);
      }
    }

    renderDiagrams();

    return () => {
      cancelled = true;
    };
  }, [html, onReadyChange]);

  return (
    <div data-diagrams-ready={isReady}>
      <RawContent innerRef={containerRef} html={html} />
    </div>
  );
}
