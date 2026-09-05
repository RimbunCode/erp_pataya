import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

let formPageSeed = {};
let formPageIsCreate = true;
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
      return { data, setData, isCreate: formPageIsCreate, dataBefore: {} };
    },
    FormPageContent: ({ children }) => <div>{children}</div>,
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/FormTable", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="stub-form-table">
      <span data-testid="tz-rows">{JSON.stringify(value)}</span>
      <button
        type="button"
        onClick={() =>
          onValueChange([{ tz: "Asia/Jakarta" }, { tz: "Asia/Makassar" }])
        }
      >
        simulate-change
      </button>
    </div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Settings Countries Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageIsCreate = true;
  });

  it("mengetik code otomatis di-uppercase", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const codeInput = screen
      .getByTestId("forminput-code")
      .querySelector("input");
    await user.type(codeInput, "id");

    expect(codeInput).toHaveValue("ID");
  });

  it("field code TIDAK disabled saat isCreate=true", () => {
    formPageIsCreate = true;
    renderForm(<Form />);

    expect(
      screen.getByTestId("forminput-code").querySelector("input"),
    ).not.toBeDisabled();
  });

  it("field code disabled saat isCreate=false (edit mode, code immutable)", () => {
    formPageIsCreate = false;
    renderForm(<Form />);

    expect(
      screen.getByTestId("forminput-code").querySelector("input"),
    ).toBeDisabled();
  });

  it("mengetik name/lang_code/url_flag memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    const nameInput = screen
      .getByTestId("forminput-name")
      .querySelector("input");
    await user.type(nameInput, "Indonesia");

    expect(nameInput).toHaveValue("Indonesia");
  });

  it("toTableValue mengonversi data.timezones (array string) jadi array object {tz}", () => {
    formPageSeed = { timezones: ["Asia/Jakarta", "Asia/Makassar"] };
    renderForm(<Form />);

    const rows = JSON.parse(screen.getByTestId("tz-rows").textContent);
    expect(rows).toEqual([{ tz: "Asia/Jakarta" }, { tz: "Asia/Makassar" }]);
  });

  it("toTableValue menghasilkan array kosong saat data.timezones undefined", () => {
    renderForm(<Form />);

    const rows = JSON.parse(screen.getByTestId("tz-rows").textContent);
    expect(rows).toEqual([]);
  });

  it("fromTableValue mengonversi balik array object {tz} ke array string saat FormTable berubah", async () => {
    const user = userEvent.setup({ delay: null });
    renderForm(<Form />);

    await user.click(screen.getByText("simulate-change"));

    const rows = JSON.parse(screen.getByTestId("tz-rows").textContent);
    expect(rows).toEqual([{ tz: "Asia/Jakarta" }, { tz: "Asia/Makassar" }]);
  });
});
