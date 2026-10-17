import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import fc from "fast-check";
import { highlightText } from "./highlight";

const renderHighlight = (text, search) =>
  render(<span>{highlightText(text, search)}</span>);

describe("highlightText", () => {
  it("menyorot setiap kemunculan kata secara case-insensitive", () => {
    const { container } = renderHighlight("Foo bar foo BAZ", "foo");

    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveTextContent("Foo");
    expect(marks[1]).toHaveTextContent("foo");
    expect(container.textContent).toBe("Foo bar foo BAZ");
  });

  it("menyorot setiap kata pada pencarian multi-kata", () => {
    const { container } = renderHighlight("Foo bar foo BAZ", "foo  baz");

    expect(container.querySelectorAll("mark")).toHaveLength(3);
    expect(container.textContent).toBe("Foo bar foo BAZ");
  });

  it("tidak melempar error untuk karakter khusus regex", () => {
    const { container } = renderHighlight("a.b (c) axb", "a.b (");

    const marks = [...container.querySelectorAll("mark")].map(
      (mark) => mark.textContent,
    );
    expect(marks).toEqual(["a.b", "("]);
    expect(container.textContent).toBe("a.b (c) axb");
  });

  it.each([
    ["", "kosong"],
    ["   ", "whitespace"],
    [null, "null"],
    [undefined, "undefined"],
  ])("tidak menyorot apa pun saat pencarian %s", (search) => {
    const { container } = renderHighlight("Foo bar", search);

    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("Foo bar");
  });

  it("mengembalikan teks apa adanya saat teks kosong", () => {
    const { container } = renderHighlight("", "foo");

    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("mempertahankan textContent asli untuk teks dan pencarian acak", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (text, search) => {
        const { container, unmount } = renderHighlight(text, search);
        try {
          expect(container.textContent).toBe(text);
        } finally {
          unmount();
        }
      }),
    );
  });
});
