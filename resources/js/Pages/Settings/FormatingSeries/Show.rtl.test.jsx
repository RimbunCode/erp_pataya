import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

let formPageSeed = {};
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: () => {
      const [data, setDataState] = React.useState(formPageSeed);
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      return { data, setData };
    },
    FormPageContent: ({ children }) => <div>{children}</div>,
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ label, error, children }) => (
    <div data-testid={`forminput-${label}`}>
      <label>{label}</label>
      {error && <span data-testid="forminput-error">{error}</span>}
      {children}
    </div>
  ),
}));

// MentionsInput di-stub jadi <input> sederhana -- fokus test ada di logic
// checkError/formatingCode/getData Show.jsx sendiri, bukan detail react-mentions.
vi.mock("@/Components/Mention", () => ({
  Mention: () => null,
  MentionsInput: ({ value, onChange }) => (
    <input
      data-testid="format-input"
      value={value ?? ""}
      onChange={(e) => onChange?.(e, e.target.value)}
    />
  ),
}));

import Show from "./Show";

describe("FormatingSeries Show", () => {
  beforeEach(() => {
    formPageSeed = {};
    usePageMock.mockReturnValue({ props: { codeFormats: [] } });
  });

  it("format kosong: tidak ada error, resultCode kosong", () => {
    formPageSeed = { format: "" };
    render(<Show />);

    expect(screen.queryByTestId("forminput-error")).not.toBeInTheDocument();
  });

  it("format tanpa placeholder increment @[i] menampilkan error increment_notfound", () => {
    render(<Show />);

    fireEvent.change(screen.getByTestId("format-input"), {
      target: { value: "PO-@[yyyy]-@[mm]" },
    });

    expect(screen.getByTestId("forminput-error")).toHaveTextContent(
      "core.formatingSeries.errors.increment_notfound",
    );
  });

  it("format dengan mm TANPA yy/yyyy pendamping menampilkan error month_invalid", () => {
    render(<Show />);

    fireEvent.change(screen.getByTestId("format-input"), {
      target: { value: "@[mm]-@[iii]" },
    });

    expect(screen.getByTestId("forminput-error")).toHaveTextContent(
      "core.formatingSeries.errors.month_invalid",
    );
  });

  it("format valid (yyyy+mm+increment) tidak menampilkan error", () => {
    render(<Show />);

    fireEvent.change(screen.getByTestId("format-input"), {
      target: { value: "PO-@[yyyy]-@[mm]-@[iii]" },
    });

    expect(screen.queryByTestId("forminput-error")).not.toBeInTheDocument();
  });

  it("format dengan yyyy sendirian (tanpa mm) tidak error month_invalid", () => {
    render(<Show />);

    fireEvent.change(screen.getByTestId("format-input"), {
      target: { value: "PO-@[yyyy]-@[iii]" },
    });

    expect(screen.queryByTestId("forminput-error")).not.toBeInTheDocument();
  });

  it("format tanpa referensi bulan/tahun sama sekali (hanya increment) tidak error", () => {
    render(<Show />);

    fireEvent.change(screen.getByTestId("format-input"), {
      target: { value: "PO-@[iii]" },
    });

    expect(screen.queryByTestId("forminput-error")).not.toBeInTheDocument();
  });

  it("resultCode mengganti @[yyyy] dengan tahun saat ini", () => {
    const year = new Date().getFullYear().toString();
    formPageSeed = { format: "PO-@[yyyy]" };
    render(<Show />);

    const resultInput = screen
      .getByTestId(`forminput-core.formatingSeries.columns.example_result`)
      .querySelector("input");
    expect(resultInput).toHaveValue(`PO-${year}`);
  });

  it("resultCode mengganti @[yy] dengan 2 digit terakhir tahun", () => {
    const yy = new Date().getFullYear().toString().slice(-2);
    formPageSeed = { format: "PO-@[yy]" };
    render(<Show />);

    const resultInput = screen
      .getByTestId(`forminput-core.formatingSeries.columns.example_result`)
      .querySelector("input");
    expect(resultInput).toHaveValue(`PO-${yy}`);
  });

  it("resultCode mengganti @[mm] dengan bulan 2-digit saat ini", () => {
    const mm = (new Date().getMonth() + 1).toString().padStart(2, "0");
    formPageSeed = { format: "PO-@[mm]" };
    render(<Show />);

    const resultInput = screen
      .getByTestId(`forminput-core.formatingSeries.columns.example_result`)
      .querySelector("input");
    expect(resultInput).toHaveValue(`PO-${mm}`);
  });

  it("resultCode mengganti @[iii] dengan angka acak 3 digit (dipadding nol)", () => {
    formPageSeed = { format: "PO-@[iii]" };
    render(<Show />);

    const resultInput = screen
      .getByTestId(`forminput-core.formatingSeries.columns.example_result`)
      .querySelector("input");
    expect(resultInput.value).toMatch(/^PO-\d{3}$/);
  });

  it("resultCode mengganti custom codeFormats via lookup id (dengan recursion)", () => {
    usePageMock.mockReturnValue({
      props: {
        codeFormats: [{ id: "branch", value: "JKT" }],
      },
    });
    formPageSeed = { format: "PO-@[branch]" };
    render(<Show />);

    const resultInput = screen
      .getByTestId(`forminput-core.formatingSeries.columns.example_result`)
      .querySelector("input");
    expect(resultInput).toHaveValue("PO-JKT");
  });

  it("resultCode fallback ke placeholder mentah saat custom codeFormats tidak ditemukan", () => {
    usePageMock.mockReturnValue({ props: { codeFormats: [] } });
    formPageSeed = { format: "PO-@[unknown]" };
    render(<Show />);

    const resultInput = screen
      .getByTestId(`forminput-core.formatingSeries.columns.example_result`)
      .querySelector("input");
    expect(resultInput).toHaveValue("PO-unknown");
  });

  it("example_result field selalu disabled (read-only preview)", () => {
    formPageSeed = { format: "PO-@[yyyy]" };
    render(<Show />);

    const resultInput = screen
      .getByTestId(`forminput-core.formatingSeries.columns.example_result`)
      .querySelector("input");
    expect(resultInput).toBeDisabled();
  });
});
