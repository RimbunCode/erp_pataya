import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// FormPageDialog (375 baris) membungkus FormChildren + SidebarChildren lewat
// useDraftForm (form dialog, isDialog:true) -- permukaan mock mirip
// FormPage.rtl.test.jsx (fake useForm minimal, AppLayout tidak dipakai di
// sini karena FormPageDialog tidak merender AppLayout). Fokus hanya pada
// perilaku kunci: render saat open, submit memanggil form.submit dengan
// method+route benar, dan tombol batal memicu onOpenChange/close. Cabang
// draft-alert (useAlertDraftForm/useIsDirtyForm dirty-confirm) TIDAK dites
// di sini -- itu concern useDraftForm/useIsDirtyForm sendiri (sudah ada
// test terpisah di useIsDirtyForm.dom.test.js), bukan logic FormPageDialog.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

let formErrorsOverride = {};
const submitSpy = vi.fn();

function useFormFake(seed) {
  const [data, setDataState] = useState(seed ?? {});
  const setData = (...args) => {
    if (typeof args[0] === "function") {
      setDataState((prev) => args[0](prev));
    } else if (typeof args[0] === "string") {
      setDataState((prev) => ({ ...prev, [args[0]]: args[1] }));
    } else {
      setDataState((prev) => ({ ...prev, ...args[0] }));
    }
  };
  return {
    data,
    setData,
    errors: formErrorsOverride,
    processing: false,
    isDirty: false,
    recentlySuccessful: false,
    reset: () => {},
    setDefaults: () => {},
    clearErrors: () => {},
    transform: () => {},
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    submit: (...a) => submitSpy(...a),
  };
}

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  useForm: (seed) => useFormFake(seed),
  Head: ({ title }) => <title>{title}</title>,
  Deferred: ({ children, fallback }) => children ?? fallback ?? null,
  WhenVisible: ({ children, fallback }) => children ?? fallback ?? null,
  router: { visit: vi.fn() },
}));

import { FormPageDialog, FormPageContent } from "./FormPage";

function basePageProps(overrides = {}) {
  return {
    auth: { user: { id: 1, name: "Tester" } },
    permissions: {},
    ignorePermissionModels: [],
    ...overrides,
  };
}

describe("FormPageDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formErrorsOverride = {};
    window.route = (name, params) =>
      params ? `${name}/${JSON.stringify(params)}` : name;
    usePageMock.mockReturnValue({ props: basePageProps() });
  });

  it("open=true merender title, badge, dan children di dalam dialog", () => {
    render(
      <FormPageDialog
        name="purchaseOrder"
        title="Buat Purchase Order"
        badge={<span>Draft</span>}
        open={true}
        onOpenChange={() => {}}
      >
        <FormPageContent value="detail" title="Detail">
          <p>Isi dialog</p>
        </FormPageContent>
      </FormPageDialog>,
    );

    expect(
      screen.getByRole("heading", { name: /Buat Purchase Order/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Isi dialog")).toBeInTheDocument();
  });

  it("open=false tidak merender konten dialog", () => {
    render(
      <FormPageDialog
        name="purchaseOrder"
        title="Buat Purchase Order"
        open={false}
        onOpenChange={() => {}}
      >
        <FormPageContent value="detail" title="Detail">
          <p>Isi dialog</p>
        </FormPageContent>
      </FormPageDialog>,
    );

    expect(screen.queryByText("Isi dialog")).not.toBeInTheDocument();
  });

  it("submit form memanggil form.submit dengan method='post' (default) dan route `${name}.store`", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FormPageDialog
        name="purchaseOrder"
        title="Buat PO"
        open={true}
        onOpenChange={() => {}}
      >
        <FormPageContent value="detail" title="Detail">
          <p>x</p>
        </FormPageContent>
      </FormPageDialog>,
    );

    await user.click(screen.getByRole("button", { name: "core.form.save" }));

    expect(submitSpy).toHaveBeenCalledTimes(1);
    const [method, urlPath] = submitSpy.mock.calls[0];
    expect(method).toBe("post");
    expect(urlPath).toBe("purchaseOrders.store");
  });

  it("routeName custom dipakai sebagai pengganti default `${name}.store`", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FormPageDialog
        name="purchaseOrder"
        title="Buat PO"
        routeName="purchaseOrders.customStore"
        open={true}
        onOpenChange={() => {}}
      >
        <FormPageContent value="detail" title="Detail">
          <p>x</p>
        </FormPageContent>
      </FormPageDialog>,
    );

    await user.click(screen.getByRole("button", { name: "core.form.save" }));

    const [, urlPath] = submitSpy.mock.calls[0];
    expect(urlPath).toBe("purchaseOrders.customStore");
  });

  it("klik tombol batal (form bersih/tidak dirty) memanggil onOpenChange(false)", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenChange = vi.fn();
    render(
      <FormPageDialog
        name="purchaseOrder"
        title="Buat PO"
        open={true}
        onOpenChange={onOpenChange}
      >
        <FormPageContent value="detail" title="Detail">
          <p>x</p>
        </FormPageContent>
      </FormPageDialog>,
    );

    await user.click(
      screen.getByRole("button", { name: "core.form.cancel" }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("errors ditampilkan sebagai blok pesan saat form.errors terisi", () => {
    formErrorsOverride = { name: "Nama wajib diisi" };
    render(
      <FormPageDialog
        name="purchaseOrder"
        title="Buat PO"
        open={true}
        onOpenChange={() => {}}
      >
        <FormPageContent value="detail" title="Detail">
          <p>x</p>
        </FormPageContent>
      </FormPageDialog>,
    );

    expect(screen.getByText("core.form.errors.title")).toBeInTheDocument();
    expect(screen.getByText("Nama wajib diisi")).toBeInTheDocument();
  });

  it("sidebarContent={false} menyembunyikan tombol toggle sidebar panel kanan", () => {
    render(
      <FormPageDialog
        name="purchaseOrder"
        title="Buat PO"
        open={true}
        onOpenChange={() => {}}
        sidebarContent={false}
      >
        <FormPageContent value="detail" title="Detail">
          <p>x</p>
        </FormPageContent>
      </FormPageDialog>,
    );

    expect(
      screen.queryByLabelText("core.form.attachments_and_tags"),
    ).not.toBeInTheDocument();
  });
});
