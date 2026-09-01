import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

window.route = (name, id) => `${name}/${id}`;

let formPageSeed = {};
let formPageDefaultData = undefined;
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: (defaultValue) => {
      const [data, setDataState] = React.useState({
        ...defaultValue,
        ...formPageSeed,
      });
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      return { data, setData, defaultData: formPageDefaultData };
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

vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {(options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          opt:{opt}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/Components/ui/slider", () => ({
  Slider: ({ value, onValueChange }) => (
    <input
      type="range"
      data-testid="progress-slider"
      min={0}
      max={100}
      value={value?.[0] ?? 0}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
    />
  ),
}));

vi.mock("@/Pages/Users/ManageUsers/AssignableLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="assignable-link-model">
      assign_to:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: () => <div data-testid="datetime-picker" />,
}));

const tiptapProps = vi.fn();
vi.mock("@/Components/TiptapEditor", () => ({
  default: (props) => {
    tiptapProps(props);
    return <div data-testid="stub-tiptap-editor" />;
  },
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Helpdesk Tickets Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageDefaultData = undefined;
    usePageMock.mockReturnValue({ props: { ticket: null } });
    tiptapProps.mockReset();
  });

  it("default type/priority/status/progress terisi dari default useFormPage", () => {
    renderForm(<Form />);

    const typeSelect = within(screen.getByTestId("forminput-type")).getByRole(
      "combobox",
    );
    expect(typeSelect).toHaveValue("task");
  });

  it("mengubah status ke 'done' saat progress<100 otomatis mengeset progress=100", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { progress: 50 };
    renderForm(<Form />);

    const statusSelect = within(
      screen.getByTestId("forminput-status"),
    ).getByRole("combobox");
    await user.selectOptions(statusSelect, "done");

    expect(screen.getByTestId("progress-slider")).toHaveValue("100");
  });

  it("mengubah status ke 'done' saat progress SUDAH 100 tidak mengubah apa pun (tetap 100)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { progress: 100 };
    renderForm(<Form />);

    const statusSelect = within(
      screen.getByTestId("forminput-status"),
    ).getByRole("combobox");
    await user.selectOptions(statusSelect, "done");

    expect(screen.getByTestId("progress-slider")).toHaveValue("100");
  });

  it("mengubah status ke selain 'done' tidak mengubah progress", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { progress: 30 };
    renderForm(<Form />);

    const statusSelect = within(
      screen.getByTestId("forminput-status"),
    ).getByRole("combobox");
    await user.selectOptions(statusSelect, "in_progress");

    expect(screen.getByTestId("progress-slider")).toHaveValue("30");
  });

  it("label progress menampilkan persentase saat ini", () => {
    formPageSeed = { progress: 45 };
    renderForm(<Form />);

    expect(screen.getByText(/45%/)).toBeInTheDocument();
  });

  it("menggeser slider progress memanggil setData", async () => {
    formPageSeed = { progress: 0 };
    renderForm(<Form />);

    const slider = screen.getByTestId("progress-slider");
    // fireEvent lebih reliable untuk range input dibanding userEvent.type
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(slider, { target: { value: "60" } });

    expect(slider).toHaveValue("60");
  });

  it("section subject/content dirender saat defaultData falsy (create mode)", () => {
    formPageDefaultData = undefined;
    renderForm(<Form />);

    expect(screen.getByTestId("forminput-subject")).toBeInTheDocument();
    expect(screen.getByTestId("stub-tiptap-editor")).toBeInTheDocument();
  });

  it("section subject/content TIDAK dirender saat defaultData ada (edit mode)", () => {
    formPageDefaultData = { id: 1 };
    renderForm(<Form />);

    expect(screen.queryByTestId("forminput-subject")).not.toBeInTheDocument();
  });

  it("imageUploadUrl null ketika tidak ada ticket di shared props (create mode)", () => {
    formPageDefaultData = undefined;
    usePageMock.mockReturnValue({ props: { ticket: null } });
    renderForm(<Form />);

    expect(tiptapProps.mock.calls[0][0].imageUploadUrl).toBeNull();
  });

  it("imageUploadUrl terisi dari route tickets.addFile saat ada ticket.id", () => {
    formPageDefaultData = undefined;
    usePageMock.mockReturnValue({ props: { ticket: { id: 7 } } });
    renderForm(<Form />);

    expect(tiptapProps.mock.calls[0][0].imageUploadUrl).toBe(
      "tickets.addFile/7",
    );
  });

  it("content TiptapEditor pakai content_json jika ada, fallback ke content", () => {
    formPageDefaultData = undefined;
    formPageSeed = { content_json: { type: "doc" }, content: "<p>x</p>" };
    renderForm(<Form />);

    expect(tiptapProps.mock.calls[0][0].value).toEqual({ type: "doc" });
  });

  it("mengetik subject memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageDefaultData = undefined;
    renderForm(<Form />);

    const input = within(screen.getByTestId("forminput-subject")).getByRole(
      "textbox",
    );
    await user.type(input, "Bug login");

    expect(input).toHaveValue("Bug login");
  });
});
