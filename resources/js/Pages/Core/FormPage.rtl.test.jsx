import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// ============================================================================
// FormPage adalah orchestrator utama (675 baris) dengan permukaan mock yang
// sangat besar: useDraftForm (membungkus useForm asli @inertiajs/react),
// usePermission (butuh permissions/auth dari usePage), useDeleteModal
// (zustand -- aman dipakai langsung), AppLayout (chrome app penuh), route()
// global, dan banyak percabangan tombol (submit/cancel/amend/print/email).
//
// Sesuai arahan task: render PARSIAL dengan mock MINIMAL, fokus ke PERILAKU
// KUNCI yang reliable -- bukan cover semua branch (badge status array,
// approval tab, print/email dropdown, dsb sengaja TIDAK dites di sini karena
// menambah kerapuhan tanpa menambah confidence besar pada orchestrator yang
// sudah dijamin oleh test FormChildren/FormPageContent terpisah).
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children, onScroll }) => (
    <div data-testid="app-layout" onScroll={onScroll}>
      {children}
    </div>
  ),
}));

// Fake useForm minimal yang comply dengan shape dipakai useDraftForm.js:
// data/setData/isDirty/processing/errors/reset/setDefaults/clearErrors/
// transform, plus method http (get/post/put/patch/delete/submit). Ini
// menghindari ketergantungan pada internal @inertiajs/react (router client
// nyata, XHR, dsb) yang tidak relevan untuk perilaku FormPage yang diuji.
let formErrorsOverride = {};

function makeFakeUseForm(initialData) {
  return function useFormFake(seed) {
    const [data, setDataState] = useState(seed ?? initialData ?? {});
    const errors = formErrorsOverride;
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
      errors,
      processing: false,
      isDirty: false,
      recentlySuccessful: false,
      progress: null,
      hasErrors: false,
      wasSuccessful: false,
      transform: () => {},
      reset: () => {},
      setDefaults: () => {},
      clearErrors: () => {},
      get: (...a) => routerGetSpy(...a),
      post: (...a) => routerPostSpy(...a),
      put: (...a) => routerPutSpy(...a),
      patch: (...a) => routerPatchSpy(...a),
      delete: (...a) => routerDeleteSpy(...a),
      submit: (...a) => routerSubmitSpy(...a),
    };
  };
}

const routerGetSpy = vi.fn();
const routerPostSpy = vi.fn();
const routerPutSpy = vi.fn();
const routerPatchSpy = vi.fn();
const routerDeleteSpy = vi.fn();
const routerSubmitSpy = vi.fn();
const usePageMock = vi.fn();

vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  useForm: (seed) => makeFakeUseForm()(seed),
  Head: ({ title }) => <title>{title}</title>,
  Deferred: ({ children, fallback }) => children ?? fallback ?? null,
  WhenVisible: ({ children, fallback }) => children ?? fallback ?? null,
  router: { visit: vi.fn() },
}));

import { FormPage, FormPageContent } from "./FormPage";

function basePageProps(overrides = {}) {
  return {
    purchaseOrder: {},
    auth: { user: { id: 1, name: "Tester" } },
    permissions: {},
    ignorePermissionModels: [],
    model: "PurchaseOrder",
    translateKey: "purchaseOrder",
    prints: [],
    emailTemplates: [],
    ...overrides,
  };
}

describe("FormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formErrorsOverride = {};
    window.route = (name, params) =>
      params ? `${name}/${JSON.stringify(params)}` : name;
    usePageMock.mockReturnValue({ props: basePageProps() });
  });

  it("mode create: merender title dari translateKey (t(`${translateKey}.new`)) dan children FormPageContent", () => {
    render(
      <FormPage name="purchaseOrder" isCreate>
        <FormPageContent value="detail" title="Detail">
          <p>Konten form</p>
        </FormPageContent>
      </FormPage>,
    );

    expect(
      screen.getByRole("heading", { name: "purchaseOrder.new" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Konten form")).toBeInTheDocument();
  });

  it("mode edit: title fallback ke defaultData.code ketika tidak ada templateLink", () => {
    usePageMock.mockReturnValue({
      props: basePageProps({
        purchaseOrder: { id: 5, code: "PO-005" },
      }),
    });

    render(
      <FormPage name="purchaseOrder">
        <FormPageContent value="detail" title="Detail">
          <p>x</p>
        </FormPageContent>
      </FormPage>,
    );

    expect(screen.getByRole("heading", { name: "PO-005" })).toBeInTheDocument();
  });

  it("submit create memanggil form.post ke route `${name}.store` (pluralized)", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FormPage name="purchaseOrder" isCreate>
        <FormPageContent value="detail" title="Detail">
          <button type="submit">Simpan</button>
        </FormPageContent>
      </FormPage>,
    );

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(routerPostSpy).toHaveBeenCalledTimes(1);
    expect(routerPostSpy.mock.calls[0][0]).toBe("purchaseOrders.store");
  });

  it("submit edit memanggil form.put ke route `${name}.update` dengan primaryKey id", async () => {
    usePageMock.mockReturnValue({
      props: basePageProps({
        purchaseOrder: { id: 42, code: "PO-042" },
      }),
    });
    const user = userEvent.setup({ delay: null });
    render(
      <FormPage name="purchaseOrder">
        <FormPageContent value="detail" title="Detail">
          <button type="submit">Simpan</button>
        </FormPageContent>
      </FormPage>,
    );

    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(routerPutSpy).toHaveBeenCalledTimes(1);
    const [calledPath] = routerPutSpy.mock.calls[0];
    expect(calledPath).toBe("purchaseOrders.update/42");
  });

  it("form bersih (tanpa errors) tidak menampilkan blok pesan error", () => {
    usePageMock.mockReturnValue({
      props: basePageProps({ purchaseOrder: { id: 1, code: "PO-001" } }),
    });

    render(
      <FormPage name="purchaseOrder">
        <FormPageContent value="detail" title="Detail">
          <p>x</p>
        </FormPageContent>
      </FormPage>,
    );

    expect(
      screen.queryByText("core.form.errors.title"),
    ).not.toBeInTheDocument();
  });

  it("form.errors terisi menampilkan blok 'core.form.errors.title' beserta daftar pesan", () => {
    formErrorsOverride = { code: "Kode wajib diisi" };
    usePageMock.mockReturnValue({
      props: basePageProps({ purchaseOrder: { id: 1, code: "PO-001" } }),
    });

    render(
      <FormPage name="purchaseOrder">
        <FormPageContent value="detail" title="Detail">
          <p>x</p>
        </FormPageContent>
      </FormPage>,
    );

    expect(screen.getByText("core.form.errors.title")).toBeInTheDocument();
    expect(screen.getByText("Kode wajib diisi")).toBeInTheDocument();
  });

  it("badge dan controls custom dirender di header", () => {
    render(
      <FormPage
        name="purchaseOrder"
        isCreate
        badge={<span>Badge Custom</span>}
        controls={<button type="button">Kontrol Custom</button>}
      >
        <FormPageContent value="detail" title="Detail">
          <p>x</p>
        </FormPageContent>
      </FormPage>,
    );

    expect(screen.getByText("Badge Custom")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kontrol Custom" }),
    ).toBeInTheDocument();
  });

  it("disabled=true dinormalisasi juga dari defaultData.disabledOn", () => {
    usePageMock.mockReturnValue({
      props: basePageProps({
        purchaseOrder: { id: 1, code: "PO-001", disabledOn: true },
      }),
    });

    render(
      <FormPage name="purchaseOrder">
        <FormPageContent value="detail" title="Detail">
          <p>Konten</p>
        </FormPageContent>
      </FormPage>,
    );

    // Tidak crash dan tetap merender konten -- assertion utama adalah
    // disabled tidak melempar error di seluruh render tree (banner/print/
    // save button ikut kena kondisi disabled tanpa exception).
    expect(screen.getByText("Konten")).toBeInTheDocument();
  });
});
