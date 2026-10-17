import { describe, expect, it } from "vitest";
import {
  SEMANTIC_TAGS,
  normalizeSelfClosing,
  prepareTemplate,
  sanitizeTemplate,
} from "./templateEngine";

// Environment jsdom: hasil sanitizer allowlist (tanpa DOM) diparsing oleh parser
// HTML browser untuk memastikan struktur yang dihasilkan aman dan setara.

const parse = (html) => {
  const root = document.createElement("div");
  root.innerHTML = html;

  return root;
};

describe("sanitizeTemplate setelah diparsing browser", () => {
  it("tidak menghasilkan script/iframe/img dan atribut berbahaya", () => {
    const root = parse(
      sanitizeTemplate(
        '<b onclick="x()">a</b><script>alert(1)</script><iframe src="x"></iframe><img src=x onerror=alert(1)><span style="color:red" href="/a" id="i">t</span>',
      ),
    );
    expect(root.querySelector("script,iframe,img")).toBeNull();
    expect(root.querySelector("[onclick],[onerror],[style],[href],[id]")).toBe(
      null,
    );
    expect(root.textContent).toBe("at");
  });

  it("mempertahankan atribut allowlist pada tag semantik", () => {
    const html =
      '<chips of="deliveryNotes" max="3"></chips><progress value=":p" shape="bar"></progress><avatar src=":img" name=":n"></avatar><when field="x">a</when><badge color="red">b</badge><nav-link to="customer">c</nav-link>';
    const root = parse(sanitizeTemplate(html));
    expect(root.querySelector("chips").getAttribute("of")).toBe(
      "deliveryNotes",
    );
    expect(root.querySelector("progress").getAttribute("shape")).toBe("bar");
    expect(root.querySelector("avatar").getAttribute("src")).toBe(":img");
    expect(root.querySelector("when").getAttribute("field")).toBe("x");
    expect(root.querySelector("badge").getAttribute("color")).toBe("red");
    expect(root.querySelector("nav-link").getAttribute("to")).toBe("customer");
  });

  it("mempertahankan seluruh tag semantik", () => {
    for (const tag of SEMANTIC_TAGS) {
      expect(sanitizeTemplate(`<${tag} class="c">x</${tag}>`)).toBe(
        `<${tag} class="c">x</${tag}>`,
      );
    }
  });
});

describe("prepareTemplate", () => {
  it("<title> dibuang di context cell, dipertahankan di selected", () => {
    const template = "<title>Judul</title><b>:code</b>";
    expect(prepareTemplate(template, {}, { context: "cell" })).toBe(
      "<b>:code</b>",
    );
    expect(prepareTemplate(template, {}, { context: "selected" })).toContain(
      "<title>Judul</title>",
    );
  });
});

describe("normalizeSelfClosing setara setelah parse (Property 8)", () => {
  it("<x a=1/> sama dengan <x a=1></x> untuk setiap tag semantik", () => {
    for (const tag of SEMANTIC_TAGS) {
      const normalized = normalizeSelfClosing(`<${tag} class="a"/>after`);
      const explicit = `<${tag} class="a"></${tag}>after`;
      expect(parse(normalized).innerHTML).toBe(parse(explicit).innerHTML);
      // Anak setelah tag tidak ikut tertelan sebagai isi.
      expect(parse(normalized).querySelector(tag).textContent).toBe("");
    }
  });
});
