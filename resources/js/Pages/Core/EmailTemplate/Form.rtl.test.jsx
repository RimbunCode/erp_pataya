import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerPost = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: { post: (...a) => routerPost(...a) },
}));

const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...a) => axiosGet(...a) },
}));

const toastSuccess = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { success: (...a) => toastSuccess(...a) },
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

// useFormPage dibaca dari React Context asli -- Form di sini adalah
// `export default function Form()` biasa (bukan memo, zero props), tapi tetap
// pakai context reaktif (bukan vi.fn statis) supaya setData benar-benar
// mentrigger rerender saat interaksi user diuji.
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
    FormPageContent: ({ title, children }) => (
      <div data-testid={`form-page-content-${title ?? "untitled"}`}>
        {children}
      </div>
    ),
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

vi.mock("../PermissionLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="permission-link-model"
      onClick={() =>
        onValueChange?.({ id: 1, model: "App\\Models\\Core\\Todo" })
      }
    >
      permission:{value?.model ?? "none"}
    </button>
  ),
}));

vi.mock("@/Components/Mention", () => ({
  Mention: () => null,
  MentionsInput: ({ value, onChange, disabled }) => (
    <input
      data-testid="mentions-input"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange?.(e, e.target.value)}
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

import Form from "./Form";

describe("EmailTemplate Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    routerPost.mockReset();
    axiosGet.mockReset();
    toastSuccess.mockReset();
    tiptapProps.mockReset();
    axiosGet.mockResolvedValue({ data: [] });
  });

  it("model belum dipilih: MentionsInput disabled dan TiptapEditor tidak dirender (placeholder muncul)", () => {
    formPageSeed = { permission: null };
    render(<Form />);

    expect(screen.getByTestId("mentions-input")).toBeDisabled();
    expect(screen.queryByTestId("stub-tiptap-editor")).not.toBeInTheDocument();
    expect(
      screen.getByText("core.emailTemplate.columns.model.placeholder"),
    ).toBeInTheDocument();
  });

  it("memilih model (permission) mengisi data.model dan mengaktifkan MentionsInput + TiptapEditor", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { permission: null };
    render(<Form />);

    await user.click(screen.getByTestId("permission-link-model"));

    expect(screen.getByTestId("mentions-input")).not.toBeDisabled();
    expect(screen.getByTestId("stub-tiptap-editor")).toBeInTheDocument();
  });

  it("tombol test-send disabled ketika data.id belum ada (create mode)", () => {
    formPageSeed = { id: undefined };
    render(<Form />);

    expect(
      screen.getByRole("button", { name: "core.emailTemplate.testSend.button" }),
    ).toBeDisabled();
  });

  it("klik tombol test-send memanggil router.post ke emailTemplates.testSend dengan id", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { id: 42 };
    render(<Form />);

    await user.click(
      screen.getByRole("button", { name: "core.emailTemplate.testSend.button" }),
    );

    expect(routerPost).toHaveBeenCalledWith(
      "emailTemplates.testSend/42",
      {},
      expect.objectContaining({ preserveScroll: true }),
    );
  });

  it("sukses test-send memicu toast success", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { id: 42 };
    routerPost.mockImplementation((_url, _data, options) => {
      options?.onSuccess?.();
    });
    render(<Form />);

    await user.click(
      screen.getByRole("button", { name: "core.emailTemplate.testSend.button" }),
    );

    expect(toastSuccess).toHaveBeenCalledWith(
      "core.emailTemplate.testSend.success",
    );
  });

  it("mengetik subject via MentionsInput memanggil setData('subject', ...)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      permission: { id: 1, model: "App\\Models\\Core\\Todo" },
      subject: "",
    };
    render(<Form />);

    await user.type(screen.getByTestId("mentions-input"), "Halo");

    expect(screen.getByTestId("mentions-input")).toHaveValue("Halo");
  });

  it("toggle checkbox is_default memanggil setData('is_default', ...)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { is_default: false };
    render(<Form />);

    const checkbox = screen.getByRole("forminput");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");

    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("TiptapEditor menerima mentionSource yang fetch field via axios berdasarkan permission.model", async () => {
    formPageSeed = {
      permission: { id: 1, model: "App\\Models\\Core\\Todo" },
    };
    axiosGet.mockResolvedValue({
      data: [{ name: "title", titleTrans: null }],
    });
    render(<Form />);

    const { mentionSource } = tiptapProps.mock.calls[0][0];
    const result = await mentionSource("");

    expect(axiosGet).toHaveBeenCalledWith(
      "emailTemplates.fields",
      expect.objectContaining({
        params: { model: "App\\Models\\Core\\Todo" },
      }),
    );
    expect(result).toEqual([{ id: "doc.title", label: "title", name: "title" }]);
  });

  it("mentionSource memfilter hasil berdasarkan query (label atau name, case-insensitive)", async () => {
    formPageSeed = {
      permission: { id: 1, model: "App\\Models\\Core\\Todo" },
    };
    axiosGet.mockResolvedValue({
      data: [
        { name: "title", titleTrans: null },
        { name: "description", titleTrans: null },
      ],
    });
    render(<Form />);

    const { mentionSource } = tiptapProps.mock.calls[0][0];
    const result = await mentionSource("TIT");

    expect(result).toEqual([{ id: "doc.title", label: "title", name: "title" }]);
  });

  it("fetchFieldColumns tanpa permission.model resolve array kosong tanpa axios call", async () => {
    formPageSeed = { permission: null };
    render(<Form />);

    // TiptapEditor tidak dirender saat model kosong, jadi tiptapProps kosong --
    // verifikasi tak langsung: axios.get tak pernah terpanggil sepanjang render.
    expect(axiosGet).not.toHaveBeenCalled();
  });
});
