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
let formPageIsCreate = false;
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
      return {
        data,
        setData,
        defaultData: formPageDefaultData,
        isCreate: formPageIsCreate,
      };
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
  Slider: ({ value, onValueChange, children }) => (
    <div>
      <input
        type="range"
        data-testid="progress-slider"
        min={0}
        max={100}
        value={value?.[0] ?? 0}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
      />
      {children}
    </div>
  ),
  SliderThumb: () => <span data-testid="progress-slider-thumb" />,
}));

vi.mock("@/Pages/Users/ManageUsers/AssignableLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="assignable-link-model">
      assign_to:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="datetime-picker"
      data-value={value ? new Date(value).getTime() : ""}
      onClick={() => onValueChange?.(new Date(2030, 5, 20, 8, 0))}
    />
  ),
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
    formPageIsCreate = false;
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

  it("slider progress menyertakan SliderThumb (Radix hanya menggambar pegangan yang diberikan)", () => {
    renderForm(<Form />);

    expect(screen.getByTestId("progress-slider-thumb")).toBeInTheDocument();
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
  describe("default tiket dari setting Helpdesk", () => {
    const startPicker = () => screen.getAllByTestId("datetime-picker")[0];
    const duePicker = () => screen.getAllByTestId("datetime-picker")[1];
    const mount = (defaults, seed = {}) => {
      formPageIsCreate = true;
      formPageSeed = seed;
      usePageMock.mockReturnValue({ props: { ticket: null, defaults } });
      renderForm(<Form />);
    };
    const selectValue = (name) =>
      within(screen.getByTestId(`forminput-${name}`)).getByRole("combobox");

    it("tipe dan prioritas diisi dari setting pada tiket baru", () => {
      mount({ type: "bug_problem", priority: "critical", due_days: null });

      expect(selectValue("type")).toHaveValue("bug_problem");
      expect(selectValue("priority")).toHaveValue("critical");
    });

    it("tanpa setting tetap memakai default bawaan form", () => {
      mount({ type: null, priority: null, due_days: null });

      expect(selectValue("type")).toHaveValue("task");
      expect(selectValue("priority")).toHaveValue("medium");
      expect(duePicker()).toHaveAttribute("data-value", "");
    });

    it("hanya satu dari tipe/prioritas diisi: yang lain tetap bawaan", () => {
      mount({ type: "question", priority: null, due_days: null });

      expect(selectValue("type")).toHaveValue("question");
      expect(selectValue("priority")).toHaveValue("medium");
    });

    it("due_date kosong selama start_date belum dipilih, walau ada setting hari", () => {
      mount({ type: null, priority: null, due_days: 3 });

      expect(duePicker()).toHaveAttribute("data-value", "");
    });

    it("start_date yang dipilih kemudian mengisi due_date, dan edit manual menghentikan pengisian", async () => {
      const user = userEvent.setup({ delay: null });
      mount({ type: null, priority: null, due_days: 2 });

      await user.click(startPicker());
      expect(duePicker()).toHaveAttribute(
        "data-value",
        String(new Date(2030, 5, 22, 8, 0).getTime()),
      );

      await user.click(duePicker());
      expect(duePicker()).toHaveAttribute(
        "data-value",
        String(new Date(2030, 5, 20, 8, 0).getTime()),
      );
    });

    it("due_date yang sudah ada tidak ditimpa saat start_date dipilih", async () => {
      const user = userEvent.setup({ delay: null });
      const existing = new Date(2031, 0, 5, 9, 0);
      mount(
        { type: null, priority: null, due_days: 3 },
        { due_date: existing },
      );

      await user.click(startPicker());

      expect(duePicker()).toHaveAttribute(
        "data-value",
        String(existing.getTime()),
      );
    });

    it("tanpa setting hari, memilih start_date tidak mengisi due_date", async () => {
      const user = userEvent.setup({ delay: null });
      mount({ type: null, priority: null, due_days: null });

      await user.click(startPicker());

      expect(duePicker()).toHaveAttribute("data-value", "");
    });

    it("start_date pada tiket yang sudah ada tidak mengisi due_date", async () => {
      const user = userEvent.setup({ delay: null });
      formPageIsCreate = false;
      formPageDefaultData = { id: 1 };
      usePageMock.mockReturnValue({
        props: { ticket: { id: 1 }, defaults: { due_days: 3 } },
      });
      renderForm(<Form />);

      await user.click(startPicker());

      expect(duePicker()).toHaveAttribute("data-value", "");
    });

    it("tiket yang sudah ada (bukan create) tidak diubah oleh setting", () => {
      formPageIsCreate = false;
      formPageDefaultData = { id: 1 };
      formPageSeed = {
        type: "other",
        priority: "low",
        start_date: new Date(2030, 5, 10, 9, 0),
      };
      usePageMock.mockReturnValue({
        props: {
          ticket: { id: 1 },
          defaults: { type: "bug_problem", priority: "critical", due_days: 3 },
        },
      });
      renderForm(<Form />);

      expect(selectValue("type")).toHaveValue("other");
      expect(selectValue("priority")).toHaveValue("low");
      expect(duePicker()).toHaveAttribute("data-value", "");
    });
  });
});
