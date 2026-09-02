import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderAsync } from "@/test-utils/renderAsync";

const mermaidRender = vi.fn();
const mermaidInitialize = vi.fn();
vi.mock("mermaid", () => ({
  default: {
    initialize: (...a) => mermaidInitialize(...a),
    render: (...a) => mermaidRender(...a),
  },
}));

import MarkdownMermaidRenderer from "./MarkdownMermaidRenderer";

describe("MarkdownMermaidRenderer", () => {
  beforeEach(() => {
    mermaidRender.mockReset();
    mermaidInitialize.mockReset();
  });

  it("HTML tanpa blok mermaid langsung ready tanpa memanggil mermaid.render", async () => {
    const onReadyChange = vi.fn();
    await renderAsync(
      <MarkdownMermaidRenderer
        html="<p>Halo dunia</p>"
        onReadyChange={onReadyChange}
      />,
    );

    await vi.waitFor(() =>
      expect(onReadyChange).toHaveBeenLastCalledWith(true),
    );
    expect(mermaidRender).not.toHaveBeenCalled();
    expect(screen.getByText("Halo dunia")).toBeInTheDocument();
  });

  it("HTML dengan blok mermaid memanggil mermaid.render dan mengganti <pre> dengan hasil SVG", async () => {
    mermaidRender.mockResolvedValue({ svg: "<svg>diagram</svg>" });
    const onReadyChange = vi.fn();
    const html =
      '<pre><code class="language-mermaid">graph TD; A-->B;</code></pre>';

    const { container } = await renderAsync(
      <MarkdownMermaidRenderer html={html} onReadyChange={onReadyChange} />,
    );

    await vi.waitFor(() =>
      expect(onReadyChange).toHaveBeenLastCalledWith(true),
    );
    expect(mermaidRender).toHaveBeenCalledWith(
      expect.stringContaining("manual-book-mermaid-0-"),
      "graph TD; A-->B;",
    );
    expect(container.querySelector(".manual-book-mermaid")).toBeInTheDocument();
    expect(container.querySelector("pre")).not.toBeInTheDocument();
  });

  it("mermaid.render gagal: menandai <pre> dengan data-mermaid-error, tetap ready", async () => {
    mermaidRender.mockRejectedValue(new Error("syntax error"));
    const onReadyChange = vi.fn();
    const html =
      '<pre><code class="language-mermaid">invalid syntax</code></pre>';

    const { container } = await renderAsync(
      <MarkdownMermaidRenderer html={html} onReadyChange={onReadyChange} />,
    );

    await vi.waitFor(() =>
      expect(onReadyChange).toHaveBeenLastCalledWith(true),
    );
    expect(container.querySelector("pre")).toHaveAttribute(
      "data-mermaid-error",
      "true",
    );
  });

  it("onHeadingsChange dipanggil dengan daftar h2/h3 (id + text + level) dari HTML", async () => {
    const onHeadingsChange = vi.fn();
    const html =
      '<h2 id="sec-1">Bagian 1</h2><h3 id="sec-1-a">Sub A</h3><p>teks</p>';

    await renderAsync(
      <MarkdownMermaidRenderer
        html={html}
        onHeadingsChange={onHeadingsChange}
      />,
    );

    await vi.waitFor(() =>
      expect(onHeadingsChange).toHaveBeenCalledWith([
        { id: "sec-1", text: "Bagian 1", level: 2 },
        { id: "sec-1-a", text: "Sub A", level: 3 },
      ]),
    );
  });

  it("heading tanpa atribut id diabaikan (tidak masuk daftar headings)", async () => {
    const onHeadingsChange = vi.fn();
    const html = "<h2>Tanpa ID</h2>";

    await renderAsync(
      <MarkdownMermaidRenderer
        html={html}
        onHeadingsChange={onHeadingsChange}
      />,
    );

    await vi.waitFor(() => expect(onHeadingsChange).toHaveBeenCalledWith([]));
  });

  it("data-diagrams-ready pada wrapper mencerminkan state isReady", async () => {
    const { container } = await renderAsync(
      <MarkdownMermaidRenderer html="<p>x</p>" />,
    );

    await vi.waitFor(() =>
      expect(container.firstChild).toHaveAttribute(
        "data-diagrams-ready",
        "true",
      ),
    );
  });
});
