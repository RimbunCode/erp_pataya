import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fc from "fast-check";

const state = vi.hoisted(() => ({ allowGlobal: true }));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: {} }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => state.allowGlobal }),
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import TemplateChips, { resolveMaxChips } from "./TemplateChips";
import SemanticTemplate from "../SemanticTemplate";

const makeRow = (count) => ({
  id: 1,
  deliveryNotes: Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    code: `DN-${i + 1}`,
    thisModel: "DeliveryNote",
    templateLink: "<title>JUDUL</title><b>:code</b>",
  })),
});

const column = {
  name: "deliveryNotes",
  type: "relations",
  route: "delivery-notes",
  primaryKey: "id",
};

const chipCount = (container) =>
  container.querySelectorAll('[data-slot="chip"]').length;

beforeEach(() => {
  state.allowGlobal = true;
  window.route = (name, id) => `/${name}/${id}`;
});

describe("resolveMaxChips", () => {
  it("default 3, 0 = semua, selain bilangan bulat >= 0 jatuh ke default", () => {
    expect(resolveMaxChips(undefined)).toBe(3);
    expect(resolveMaxChips("")).toBe(3);
    expect(resolveMaxChips(0)).toBe(0);
    expect(resolveMaxChips("2")).toBe(2);
    expect(resolveMaxChips(-1)).toBe(3);
    expect(resolveMaxChips("abc")).toBe(3);
  });
});

describe("TemplateChips (Property 9)", () => {
  it("n anak dan max m: chip tampil = m===0 ? n : min(n,m); '+k' ada jika k>0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 5 }),
        (n, m) => {
          const { container, unmount } = render(
            <TemplateChips row={makeRow(n)} column={column} max={m} />,
          );
          const shown = m === 0 ? n : Math.min(n, m);
          const k = n - shown;
          const count = chipCount(container);
          const plus = screen.queryByRole("button", { name: /^\+\d+$/ });
          const plusText = plus?.textContent;
          unmount();

          expect(count).toBe(shown);
          if (k > 0) {
            expect(plusText).toBe(`+${k}`);
          } else {
            expect(plus).toBeNull();
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it("default max = 3 dan `column.max` dipakai untuk relasi milik kolom", () => {
    const { container, unmount } = render(
      <TemplateChips row={makeRow(5)} column={column} />,
    );
    expect(chipCount(container)).toBe(3);
    unmount();

    const withMax = render(
      <TemplateChips row={makeRow(5)} column={{ ...column, max: 0 }} />,
    );
    expect(chipCount(withMax.container)).toBe(5);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("anak kosong atau bukan array tidak merender apa pun", () => {
    const empty = render(<TemplateChips row={makeRow(0)} column={column} />);
    expect(empty.container.textContent).toBe("");
    empty.unmount();

    const missing = render(<TemplateChips row={{ id: 1 }} column={column} />);
    expect(missing.container.textContent).toBe("");
  });

  it("isi chip memakai templateLink anak tanpa <title>", () => {
    render(<TemplateChips row={makeRow(2)} column={column} />);

    expect(screen.getByText("DN-1")).toBeInTheDocument();
    expect(screen.queryByText("JUDUL")).toBeNull();
  });

  it("isi chip memakai template kolom bila ada", () => {
    render(
      <TemplateChips
        row={makeRow(1)}
        column={{ ...column, template: "<muted>no. :code</muted>" }}
      />,
    );

    expect(screen.getByText("no. DN-1")).toBeInTheDocument();
  });

  it("klik chip menavigasi ke record anak", () => {
    render(<TemplateChips row={makeRow(2)} column={column} />);

    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/delivery-notes/1",
      "/delivery-notes/2",
    ]);
  });

  it("tanpa izin chip dirender tanpa tautan", () => {
    state.allowGlobal = false;
    render(<TemplateChips row={makeRow(2)} column={column} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("DN-1")).toBeInTheDocument();
  });

  it("chip '+N' membuka popover berisi sisa chip yang bisa diklik", async () => {
    const user = userEvent.setup();
    render(<TemplateChips row={makeRow(5)} column={column} />);

    expect(screen.queryByText("DN-4")).toBeNull();
    await user.click(screen.getByRole("button", { name: "+2" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("DN-4").closest("a")).toHaveAttribute(
      "href",
      "/delivery-notes/4",
    );
    expect(screen.getByText("DN-5")).toBeInTheDocument();
  });

  it("<chips of max> di template kolom lain: atribut max dan of dipakai", () => {
    const { container } = render(
      <SemanticTemplate
        template='<chips of="deliveryNotes" max="2"></chips>'
        row={makeRow(4)}
        column={{ name: "other", route: "orders", primaryKey: "id" }}
      />,
    );

    expect(chipCount(container)).toBe(2);
    expect(screen.getByRole("button", { name: "+2" })).toBeInTheDocument();
  });

  it("<chips> tanpa max di kolom lain memakai default 3 (bukan max kolom host)", () => {
    const { container } = render(
      <SemanticTemplate
        template='<chips of="deliveryNotes"></chips>'
        row={makeRow(5)}
        column={{ name: "other", max: 0 }}
      />,
    );

    expect(chipCount(container)).toBe(3);
  });
});
