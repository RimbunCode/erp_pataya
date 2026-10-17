import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// Uji performa (spec datatable-semantic-templates, Risiko R3): 100 baris x 10
// kolom template. Asersi dibuat LONGGAR agar tidak flaky di CI: yang dijaga
// adalah parse HTML per STRING template (bukan per baris), durasi hanya
// dicatat + batas atas sangat longgar.

const counters = vi.hoisted(() => ({ parse: 0, htmlToDOM: 0 }));

vi.mock("html-react-parser", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    default: (...args) => {
      counters.parse += 1;

      return actual.default(...args);
    },
    htmlToDOM: (...args) => {
      counters.htmlToDOM += 1;

      return actual.htmlToDOM(...args);
    },
  };
});

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: {} }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import SemanticTemplate from "./SemanticTemplate";

const ROW_COUNT = 100;
const RUNS = 3;

const TEMPLATES = [
  "<stack><strong>:code</strong><muted>:name</muted></stack>",
  "<nav-link><strong>:code</strong></nav-link>",
  '<inline><badge color="blue">:status</badge><muted>:note</muted></inline>',
  "<status>:status</status>",
  '<progress value=":per" shape="bar"/>',
  '<progress value=":per"/>',
  '<chips of="items" max="2"></chips>',
  '<stack><nav-link to="customer"><b>:customer.name</b></nav-link><muted>:created_at|date</muted></stack>',
  '<when field="note"><i>:note</i></when><truncate>:name</truncate>',
  '<dot color="green">:code</dot> <span class="font-bold">:name</span>',
];
const UNIQUE_TEMPLATES = new Set(TEMPLATES).size;

const column = {
  name: "status",
  route: "orders.show",
  primaryKey: "id",
  badgeColors: { open: "green" },
};

const rows = Array.from({ length: ROW_COUNT }, (_, index) => ({
  id: index + 1,
  code: `SO-${index + 1}`,
  name: `Customer order number ${index + 1}`,
  status: index % 2 ? "open" : "draft",
  note: index % 3 ? `Catatan ${index}` : "",
  per: (index * 7) % 101,
  created_at: "2026-10-17T12:00:00",
  customer: { id: index + 1, thisModel: "Customer", name: `Budi ${index}` },
  items: [
    { id: 1, thisModel: "Item", templateLink: "<b>:code</b>", code: "I-1" },
    { id: 2, thisModel: "Item", templateLink: "<b>:code</b>", code: "I-2" },
    { id: 3, thisModel: "Item", templateLink: "<b>:code</b>", code: "I-3" },
  ],
}));

const Grid = () => (
  <table>
    <tbody>
      {rows.map((row) => (
        <tr key={row.id}>
          {TEMPLATES.map((template, col) => (
            <td key={col}>
              <SemanticTemplate template={template} row={row} column={column} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

describe("SemanticTemplate - performa 100 baris x 10 kolom", () => {
  beforeEach(() => {
    window.route = (name, id) => `/${name}/${id}`;
    counters.parse = 0;
    counters.htmlToDOM = 0;
  });

  it("render grid lengkap benar dan HTML per string template diparsing sekali, bukan per baris", () => {
    const { container, unmount } = render(<Grid />);

    expect(container.querySelectorAll("tr")).toHaveLength(ROW_COUNT);
    expect(container.querySelectorAll("td")).toHaveLength(
      ROW_COUNT * TEMPLATES.length,
    );
    expect(container.textContent).toContain("SO-100");
    expect(container.querySelectorAll("a").length).toBeGreaterThan(ROW_COUNT);
    unmount();

    // Tanpa cache: 1.000 parse. Dengan cache AST: <= jumlah template unik
    // (+ chip: templateLink anak dipakai ulang antar baris).
    const parses = counters.parse + counters.htmlToDOM;
    expect(parses).toBeLessThanOrEqual(UNIQUE_TEMPLATES + 2);
  });

  it("mencatat durasi render (median) dengan batas atas longgar", () => {
    const durations = [];
    for (let run = 0; run < RUNS; run++) {
      const start = performance.now();
      const { unmount } = render(<Grid />);
      durations.push(performance.now() - start);
      unmount();
    }
    const med = median(durations);
    console.info(
      `[perf] SemanticTemplate ${ROW_COUNT}x${TEMPLATES.length}: median ${med.toFixed(1)} ms (runs: ${durations
        .map((d) => d.toFixed(1))
        .join(", ")})`,
    );

    // Batas sangat longgar -- hanya menangkap regresi besar, bukan mengukur CI.
    expect(med).toBeLessThan(10000);
  }, 60000);

  it("kontrol: 1.000 sel React polos (markup setara tanpa renderer) sebagai pembanding", () => {
    const Plain = () => (
      <table>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {TEMPLATES.map((_, col) => (
                <td key={col}>
                  <div className="flex flex-col">
                    <strong>{row.code}</strong>
                    <span>{row.name}</span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
    const durations = [];
    for (let run = 0; run < RUNS; run++) {
      const start = performance.now();
      const { unmount } = render(<Plain />);
      durations.push(performance.now() - start);
      unmount();
    }
    console.info(
      `[perf] kontrol ${ROW_COUNT}x${TEMPLATES.length} sel polos: median ${median(durations).toFixed(1)} ms`,
    );

    expect(median(durations)).toBeLessThan(10000);
  }, 60000);
});
