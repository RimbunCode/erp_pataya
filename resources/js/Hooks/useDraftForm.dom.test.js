import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";

// ============================================================================
// useDraftForm membungkus useForm/usePage asli @inertiajs/react. Sama seperti
// pola di Pages/Core/FormPage.rtl.test.jsx, useForm di-fake dengan shape
// minimal yang comply (data/setData/isDirty/processing/recentlySuccessful/
// errors + method http get/post/put/patch/delete/submit sebagai spy), supaya
// tidak bergantung pada router/XHR asli Inertia.
//
// isDirty/processing/recentlySuccessful TIDAK bisa disimulasikan lewat
// useState biasa di fake (nilainya di-derive Inertia asli dari diff data vs
// defaults, bukan sesuatu yang di-drive test secara langsung) -- makanya
// dikontrol lewat `fakeFormState`, object mutable module-level yang dibaca
// ulang tiap render fake useForm dipanggil. Untuk membuat useDraftForm
// "melihat" perubahannya, test mengubah `fakeFormState` lalu memanggil
// `rerender()` dari renderHook (pola yang sama dipakai `formErrorsOverride`
// di FormPage.rtl.test.jsx).
//
// PENTING (lihat memory reference_inertia_setdata_object_replaces.md):
// setData asli @inertiajs/react MENGGANTI SELURUH data form saat dipanggil
// dengan sebuah object (`setData({...})`), BUKAN merge dengan data lama.
// Fake di bawah SENGAJA meniru perilaku replace-total itu (bukan spread
// merge seperti sebagian fake lain di codebase) supaya test ini benar-benar
// menguji perilaku nyata `loadDraft().continue()` yang memanggil
// `setDataRef.current?.(dataCookie)` dengan sebuah object utuh.
// ============================================================================

let fakeFormState;
function resetFakeFormState() {
  fakeFormState = {
    isDirty: false,
    processing: false,
    recentlySuccessful: false,
    errors: {},
  };
}
resetFakeFormState();

const resetSpy = vi.fn();
const setDefaultsSpy = vi.fn();
const submitSpy = vi.fn();
const getSpy = vi.fn();
const postSpy = vi.fn();
const putSpy = vi.fn();
const patchSpy = vi.fn();
const deleteSpy = vi.fn();

function useFormFake(seed) {
  const [data, setDataState] = useState(seed ?? {});
  const setData = (arg, val) => {
    setDataState((prev) => {
      if (typeof arg === "function") return arg(prev);
      if (typeof arg === "string") return { ...prev, [arg]: val };
      return arg; // replace total -- sesuai perilaku asli @inertiajs/react
    });
  };
  return {
    data,
    setData,
    errors: fakeFormState.errors,
    processing: fakeFormState.processing,
    isDirty: fakeFormState.isDirty,
    recentlySuccessful: fakeFormState.recentlySuccessful,
    progress: null,
    hasErrors: false,
    wasSuccessful: false,
    transform: () => {},
    reset: resetSpy,
    setDefaults: setDefaultsSpy,
    clearErrors: () => {},
    submit: submitSpy,
    get: getSpy,
    post: postSpy,
    put: putSpy,
    patch: patchSpy,
    delete: deleteSpy,
  };
}

const usePageMock = vi.fn();

vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  useForm: (seed) => useFormFake(seed),
}));

import { getFromLocalStorage, saveToLocalStorage } from "@/lib/utils";
import { useAlertDraftForm, useDraftForm } from "./useDraftForm";
import { useIsDirtyForm } from "./useIsDirtyForm";

// DRAFT_AUTOSAVE_DEBOUNCE_MS di source tidak diexport -- nilainya disalin di
// sini murni untuk mengatur maju jam palsu, BUKAN diimpor dari source.
const DEBOUNCE_MS = 600;

function baseUser(overrides = {}) {
  return { id: 1, name: "Tester", ...overrides };
}

function setUser(user) {
  usePageMock.mockReturnValue({ props: { auth: { user } } });
}

beforeEach(() => {
  resetFakeFormState();
  vi.clearAllMocks();
  setUser(baseUser());
  localStorage.clear();
  delete window.keyForm;
  act(() => {
    useAlertDraftForm.setState({
      showAlert: false,
      cancel: () => {},
      continue: () => {},
    });
    useIsDirtyForm.setState({
      isDirty: false,
      processing: false,
      recentlySuccessful: false,
      showAlert: false,
      cancel: () => {},
      leave: () => {},
      saveAsDraft: () => {},
      keepDraftOnClean: {},
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDraftForm: key generation", () => {
  it("mode create: key = `${name}_${user.id}_create`", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", {}, { isCreate: true }),
    );
    expect(result.current.key).toBe("po_1_create");
  });

  it("mode update dengan initialData.id: key pakai id", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", { id: 5 }, { isCreate: false }),
    );
    expect(result.current.key).toBe("po_1_update_5");
  });

  it("mode update tanpa id tapi ada code: key fallback ke code", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", { code: "PO-01" }, { isCreate: false }),
    );
    expect(result.current.key).toBe("po_1_update_PO-01");
  });

  it("mode update tanpa id & code: key berakhiran underscore kosong", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", {}, { isCreate: false }),
    );
    expect(result.current.key).toBe("po_1_update_");
  });

  it("tanpa user (auth.user null): key tetap null, bukan string 'null_create'", () => {
    setUser(null);
    const { result } = renderHook(() =>
      useDraftForm("po", {}, { isCreate: true }),
    );
    expect(result.current.key).toBeNull();
  });
});

describe("useDraftForm: tanpa user -- fitur draft nonaktif total (key null)", () => {
  it("window.keyForm tidak diisi", () => {
    setUser(null);
    renderHook(() => useDraftForm("po", {}, { isCreate: true }));
    expect(window.keyForm).toBeUndefined();
  });

  it("loadDraft otomatis saat mount tidak memicu alert", async () => {
    setUser(null);
    renderHook(() => useDraftForm("po", {}, { isCreate: true }));

    await new Promise((r) => setTimeout(r, 0));
    expect(useAlertDraftForm.getState().showAlert).toBe(false);
  });

  it("listener beforeunload TIDAK terdaftar meski form dirty", () => {
    setUser(null);
    fakeFormState.isDirty = true;
    const addSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useDraftForm("po", { note: "isi" }, { isCreate: true }));

    const registered = addSpy.mock.calls.some(
      ([type]) => type === "beforeunload",
    );
    expect(registered).toBe(false);
    addSpy.mockRestore();
  });

  it("autosave (scheduleDraftSave/flushDraftSave) tidak pernah menyimpan draft ke localStorage meski dirty & data berubah", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setUser(null);
    fakeFormState.isDirty = true;
    const { result } = renderHook(() =>
      useDraftForm("po", { note: "" }, { isCreate: true }),
    );

    act(() => {
      result.current.setData("note", "harusnya tidak tersimpan");
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(localStorage.length).toBe(0);
  });

  it("getOptions onSuccess/onBefore/onError (via patch) tidak menyentuh localStorage", () => {
    setUser(null);
    fakeFormState.isDirty = true;
    const { result } = renderHook(() =>
      useDraftForm("po", { id: 1 }, { isCreate: false }),
    );

    act(() => {
      result.current.patch("/po/1");
    });
    const opts = patchSpy.mock.calls[0][1];

    act(() => {
      opts.onBefore({});
    });
    act(() => {
      opts.onError({ note: "wajib diisi" });
    });
    act(() => {
      opts.onSuccess({ props: { po: { id: 1 } } });
    });

    expect(localStorage.length).toBe(0);
  });
});

describe("useDraftForm: efek window.keyForm", () => {
  it("non-dialog: window.keyForm diisi key hook setelah mount", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", {}, { isCreate: true }),
    );
    expect(window.keyForm).toBe(result.current.key);
  });

  it("isDialog=true: window.keyForm TIDAK diisi", () => {
    renderHook(() =>
      useDraftForm("po", {}, { isCreate: true, isDialog: true }),
    );
    expect(window.keyForm).toBeUndefined();
  });

  it("unmount: window.keyForm dihapus kalau masih menunjuk key hook ini", () => {
    const { result, unmount } = renderHook(() =>
      useDraftForm("po", {}, { isCreate: true }),
    );
    expect(window.keyForm).toBe(result.current.key);

    act(() => {
      unmount();
    });

    expect(window.keyForm).toBeUndefined();
  });
});

describe("useDraftForm: loadDraft otomatis saat mount", () => {
  it("tidak ada draft tersimpan -- alert tidak muncul", async () => {
    renderHook(() => useDraftForm("po", {}, { isCreate: true }));

    await new Promise((r) => setTimeout(r, 0));
    expect(useAlertDraftForm.getState().showAlert).toBe(false);
  });

  it("draft tersimpan tapi kosong (isDeepEmpty) -- alert tidak muncul", async () => {
    saveToLocalStorage("po_1_create", {}, 7);
    renderHook(() => useDraftForm("po", {}, { isCreate: true }));

    await new Promise((r) => setTimeout(r, 0));
    expect(useAlertDraftForm.getState().showAlert).toBe(false);
  });

  it("ignoreDraft=true -- draft tersimpan tidak diperiksa & tidak disentuh", async () => {
    saveToLocalStorage("po_1_create", { note: "draft lama" }, 7);
    renderHook(() =>
      useDraftForm("po", {}, { isCreate: true, ignoreDraft: true }),
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(useAlertDraftForm.getState().showAlert).toBe(false);
    expect(getFromLocalStorage("po_1_create")).toEqual({
      note: "draft lama",
    });
  });

  it("isDialog=true -- draft tersimpan tidak diperiksa", async () => {
    saveToLocalStorage("po_1_create", { note: "draft lama" }, 7);
    renderHook(() =>
      useDraftForm("po", {}, { isCreate: true, isDialog: true }),
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(useAlertDraftForm.getState().showAlert).toBe(false);
  });

  it("draft tersimpan valid -- showAlert jadi true, continue() REPLACE total data form & hapus draft", async () => {
    const draftData = { note: "draft tersimpan", extra: "y" };
    saveToLocalStorage("po_1_create", draftData, 7);
    const onContinueDraft = vi.fn();

    const { result } = renderHook(() =>
      useDraftForm("po", { note: "awal" }, { isCreate: true, onContinueDraft }),
    );

    await waitFor(() => {
      expect(useAlertDraftForm.getState().showAlert).toBe(true);
    });

    act(() => {
      useAlertDraftForm.getState().continue();
    });

    // Replace total: field lama ("note: awal") lenyap, diganti persis draftData.
    expect(result.current.data).toEqual(draftData);
    expect(getFromLocalStorage("po_1_create")).toBeNull();
    expect(useAlertDraftForm.getState().showAlert).toBe(false);
    expect(onContinueDraft).toHaveBeenCalledTimes(1);
  });

  it("draft tersimpan valid -- cancel() reset form (bukan menerapkan draft) & tetap hapus draft", async () => {
    saveToLocalStorage("po_1_create", { note: "draft tersimpan" }, 7);

    renderHook(() => useDraftForm("po", { note: "awal" }, { isCreate: true }));

    await waitFor(() => {
      expect(useAlertDraftForm.getState().showAlert).toBe(true);
    });

    act(() => {
      useAlertDraftForm.getState().cancel();
    });

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(getFromLocalStorage("po_1_create")).toBeNull();
    expect(useAlertDraftForm.getState().showAlert).toBe(false);
  });
});

describe("useDraftForm: getOptions lewat method http (post/patch/...)", () => {
  it("mode dialog: preserveState/preserveScroll true, preserveUrl eksplisit false, replace true", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", { id: 1 }, { isCreate: false, isDialog: true }),
    );

    act(() => {
      result.current.post("/po/1");
    });

    const opts = postSpy.mock.calls[0][1];
    expect(opts.preserveState).toBe(true);
    expect(opts.preserveScroll).toBe(true);
    expect(opts.preserveUrl).toBe(false);
    expect(opts.replace).toBe(true);
  });

  it("mode create non-dialog: preserveUrl juga eksplisit false", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", {}, { isCreate: true }),
    );

    act(() => {
      result.current.post("/po");
    });

    expect(postSpy.mock.calls[0][1].preserveUrl).toBe(false);
  });

  it("mode update non-dialog: preserveUrl TIDAK diset sama sekali (bukan false eksplisit)", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", { id: 1 }, { isCreate: false, isDialog: false }),
    );

    act(() => {
      result.current.patch("/po/1");
    });

    const opts = patchSpy.mock.calls[0][1];
    expect(opts.preserveState).toBe(true);
    expect(opts.preserveScroll).toBe(true);
    expect("preserveUrl" in opts).toBe(false);
  });

  it("options user (preserveScroll/replace) di-spread SETELAH default sehingga menang", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", { id: 1 }, { isCreate: false }),
    );

    act(() => {
      result.current.patch("/po/1", { preserveScroll: false, replace: false });
    });

    const opts = patchSpy.mock.calls[0][1];
    expect(opts.preserveScroll).toBe(false);
    expect(opts.replace).toBe(false);
  });

  it("onSuccess user TIDAK menggantikan handler onSuccess internal -- tetap dipanggil sebagai callback tambahan", () => {
    const userOnSuccess = vi.fn();
    const { result } = renderHook(() =>
      useDraftForm("po", { id: 1 }, { isCreate: false }),
    );
    const key = result.current.key;
    saveToLocalStorage(key, { note: "draft" }, 7);

    act(() => {
      result.current.patch("/po/1", { onSuccess: userOnSuccess });
    });
    const opts = patchSpy.mock.calls[0][1];
    const event = { props: { po: { id: 1, code: "PO-001" } } };

    act(() => {
      opts.onSuccess(event);
    });

    expect(setDefaultsSpy).toHaveBeenCalledWith({ id: 1, code: "PO-001" });
    expect(useIsDirtyForm.getState().isDirty).toBe(false);
    expect(getFromLocalStorage(key)).toBeNull();
    expect(userOnSuccess).toHaveBeenCalledWith(event);
  });

  it("onSuccess saat isDialog=true: form.setDefaults TIDAK dipanggil", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", {}, { isCreate: true, isDialog: true }),
    );

    act(() => {
      result.current.post("/po");
    });
    const opts = postSpy.mock.calls[0][1];

    act(() => {
      opts.onSuccess({ props: { po: { id: 99 } } });
    });

    expect(setDefaultsSpy).not.toHaveBeenCalled();
  });

  it("onBefore: menyembunyikan alert & menghapus draft tersimpan sebelum request berangkat", () => {
    const { result } = renderHook(() =>
      useDraftForm("po", { note: "x" }, { isCreate: true }),
    );
    const key = result.current.key;
    saveToLocalStorage(key, { note: "draft lama" }, 7);
    act(() => {
      useAlertDraftForm.getState().setShowAlert(true);
    });

    act(() => {
      result.current.post("/po");
    });
    const opts = postSpy.mock.calls[0][1];

    act(() => {
      opts.onBefore({});
    });

    expect(useAlertDraftForm.getState().showAlert).toBe(false);
    expect(getFromLocalStorage(key)).toBeNull();
  });

  it("onError: menyembunyikan alert, aktifkan ulang autosave, flushDraftSave jalan kalau bukan submit final (isSubmit falsy)", () => {
    fakeFormState.isDirty = true;
    const userOnError = vi.fn();
    const { result } = renderHook(() =>
      useDraftForm("po", { note: "isi form" }, { isCreate: true }),
    );
    const key = result.current.key;

    act(() => {
      result.current.post("/po", { onError: userOnError });
    });
    const opts = postSpy.mock.calls[0][1];

    act(() => {
      opts.onError({ note: "wajib diisi" });
    });

    expect(useAlertDraftForm.getState().showAlert).toBe(false);
    expect(userOnError).toHaveBeenCalledWith({ note: "wajib diisi" });
    expect(getFromLocalStorage(key)).toEqual({ note: "isi form" });
  });

  it("onError dengan options.isSubmit=true: flushDraftSave TIDAK dipanggil (submit final)", () => {
    fakeFormState.isDirty = true;
    const { result } = renderHook(() =>
      useDraftForm("po", { note: "isi form" }, { isCreate: true }),
    );
    const key = result.current.key;

    act(() => {
      result.current.post("/po", { isSubmit: true });
    });
    const opts = postSpy.mock.calls[0][1];

    act(() => {
      opts.onError({ note: "wajib diisi" });
    });

    expect(getFromLocalStorage(key)).toBeNull();
  });
});

describe("useDraftForm: onSuccess merge key FE-only ke defaults (regresi badge 'Not Saved' nyangkut permanen)", () => {
  // ==========================================================================
  // Regresi nyata di halaman Purchase Order (update): user ubah supplier/
  // gudang tujuan/tarif lalu tekan Save -- data BERHASIL tersimpan ke DB,
  // tapi badge "Not Saved" tetap menempel selamanya dan tombol Submit tidak
  // pernah muncul (FormPage.jsx mensyaratkan `!isDirty` untuk menampilkan
  // tombol Submit pada dokumen bukan draft).
  //
  // Akar masalah: `form.setDefaults(object)` di Inertia v2.3.18 itu MERGE
  // (`Object.assign(cloneDeep(defaults), fieldOrFields)`), BUKAN replace.
  // Sebelum fix, onSuccess langsung `form.setDefaults(e.props[name])` --
  // kalau dikasih data fresh dari server, key yang cuma hidup di `data` dan
  // memang tidak pernah dikirim balik server (mis. `latestDiscountKey` yang
  // ditulis Finances/Components/AdditionalDiscount.jsx, atau
  // `target_warehouse`/`source_warehouse` level header di form PO/SO) tidak
  // akan pernah ikut masuk ke `defaults`. Effect
  // `form.reset(...Object.keys(initialData))` sesudahnya juga tidak menolong
  // karena reset per-field cuma menimpa key yang ADA di `defaults`. Hasilnya
  // `data` selalu punya key ekstra dibanding `defaults`, sehingga `isDirty`
  // (deep compare data vs defaults) permanen `true` walau submit sukses.
  //
  // Test di bawah membuktikan fix: onSuccess membangun `defaults` baru dari
  // snapshot data form saat submit (`dataRef.current`, sudah termasuk key
  // FE-only) lalu ditimpa field fresh dari server, supaya key FE-only IKUT
  // masuk `defaults` (isDirty bisa balik `false`) SEKALIGUS field milik
  // server tetap yang terbaru (bukan versi sebelum submit).
  // ==========================================================================

  it("setDefaults dipanggil dengan object yang tetap memuat key FE-only (latestDiscountKey) beserta nilainya, dan field server pakai nilai TERBARU dari response", () => {
    const { result } = renderHook(() =>
      useDraftForm(
        "purchaseOrder",
        { id: 1, code: "PO-001", supplier_id: "SUP-OLD" },
        { isCreate: false },
      ),
    );

    // Simulasikan key FE-only ala AdditionalDiscount.jsx: tidak pernah ada
    // di initialData maupun di props server, murni state UI form.
    act(() => {
      result.current.setData("latestDiscountKey", "discount-abc");
    });

    act(() => {
      result.current.put("/purchase-orders/1");
    });
    const opts = putSpy.mock.calls[0][1];

    // Response server TIDAK PERNAH membawa balik latestDiscountKey (sesuai
    // komentar DocumentDiscountCalculator.php yang sengaja tidak
    // mentransport key ini), tapi field lain memang berubah di server.
    act(() => {
      opts.onSuccess({
        props: {
          purchaseOrder: { id: 1, code: "PO-001", supplier_id: "SUP-NEW" },
        },
      });
    });

    expect(setDefaultsSpy).toHaveBeenCalledWith({
      id: 1,
      code: "PO-001",
      supplier_id: "SUP-NEW", // field server menang, bukan "SUP-OLD"
      latestDiscountKey: "discount-abc", // key FE-only tetap selamat
    });
  });

  it("e.props[name] undefined -- setDefaults tetap dipanggil dengan undefined (jalur setDataAsDefaults bawaan Inertia), BUKAN di-skip total", () => {
    const { result } = renderHook(() =>
      useDraftForm("purchaseOrder", { id: 1 }, { isCreate: false }),
    );

    act(() => {
      result.current.setData("target_warehouse", "WH-01");
    });

    act(() => {
      result.current.put("/purchase-orders/1");
    });
    const opts = putSpy.mock.calls[0][1];

    act(() => {
      opts.onSuccess({ props: {} });
    });

    expect(setDefaultsSpy).toHaveBeenCalledWith(undefined);
  });
});

describe("useDraftForm: delete() membungkus onSuccess tambahan", () => {
  it("delete() sukses -- draft dihapus & onSuccess user tetap dipanggil dengan event asli", () => {
    const userOnSuccess = vi.fn();
    const { result } = renderHook(() =>
      useDraftForm("po", { id: 1 }, { isCreate: false }),
    );
    const key = result.current.key;
    saveToLocalStorage(key, { note: "draft" }, 7);

    act(() => {
      result.current.delete("/po/1", { onSuccess: userOnSuccess });
    });
    const opts = deleteSpy.mock.calls[0][1];
    const event = { props: {} };

    act(() => {
      opts.onSuccess(event);
    });

    expect(getFromLocalStorage(key)).toBeNull();
    expect(userOnSuccess).toHaveBeenCalledWith(event);
  });
});

describe("useDraftForm: efek saat form.isDirty berubah setelah mount", () => {
  it("mount pertama dengan form SUDAH dirty: setIsDirty TIDAK otomatis dipanggil (useDidMountEffect skip render pertama)", () => {
    fakeFormState.isDirty = true;
    renderHook(() => useDraftForm("po", { note: "x" }, { isCreate: true }));

    expect(useIsDirtyForm.getState().isDirty).toBe(false);
  });

  it("clean -> dirty (setelah mount): setIsDirty(true) disinkronkan ke store global", () => {
    const { rerender } = renderHook(() =>
      useDraftForm("po", { note: "x" }, { isCreate: true }),
    );

    fakeFormState.isDirty = true;
    act(() => {
      rerender();
    });

    expect(useIsDirtyForm.getState().isDirty).toBe(true);
  });

  it("dirty -> clean TANPA keepDraftFlag: draft tersimpan dihapus", () => {
    fakeFormState.isDirty = true;
    const { result, rerender } = renderHook(() =>
      useDraftForm("po", { note: "x" }, { isCreate: true }),
    );
    const key = result.current.key;
    saveToLocalStorage(key, { note: "draft lama" }, 7);

    fakeFormState.isDirty = false;
    act(() => {
      rerender();
    });

    expect(useIsDirtyForm.getState().isDirty).toBe(false);
    expect(getFromLocalStorage(key)).toBeNull();
  });

  it("dirty -> clean DENGAN keepDraftOnClean[key]=true: draft TIDAK dihapus, flag direset ke false", () => {
    fakeFormState.isDirty = true;
    const { result, rerender } = renderHook(() =>
      useDraftForm("po", { note: "x" }, { isCreate: true }),
    );
    const key = result.current.key;
    saveToLocalStorage(key, { note: "draft lama" }, 7);
    act(() => {
      useIsDirtyForm.getState().setKeepDraftOnClean(key, true);
    });

    fakeFormState.isDirty = false;
    act(() => {
      rerender();
    });

    expect(getFromLocalStorage(key)).toEqual({ note: "draft lama" });
    expect(useIsDirtyForm.getState().keepDraftOnClean[key]).toBe(false);
  });
});

describe("useDraftForm: recentlySuccessful", () => {
  it("mode create: form.reset() dipanggil TANPA argumen (reset total)", () => {
    const { rerender } = renderHook(() =>
      useDraftForm("po", { note: "x" }, { isCreate: true }),
    );

    fakeFormState.recentlySuccessful = true;
    act(() => {
      rerender();
    });

    expect(resetSpy).toHaveBeenCalledWith();
  });

  it("mode update: form.reset(...) hanya dengan key dari initialData (bukan reset total)", () => {
    const initialData = { id: 9, note: "asal", extra: "y" };
    const { rerender } = renderHook(() =>
      useDraftForm("po", initialData, { isCreate: false }),
    );

    fakeFormState.recentlySuccessful = true;
    act(() => {
      rerender();
    });

    expect(resetSpy).toHaveBeenCalledWith("id", "note", "extra");
  });
});

describe("useDraftForm: autosave (debounce)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("perubahan data pada form dirty menjadwalkan penyimpanan draft setelah 600ms", async () => {
    fakeFormState.isDirty = true;
    const { result } = renderHook(() =>
      useDraftForm("po", { note: "" }, { isCreate: true }),
    );
    const key = result.current.key;

    act(() => {
      result.current.setData("note", "draft berjalan");
    });

    // belum tersimpan sebelum debounce selesai
    expect(getFromLocalStorage(key)).toBeNull();

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(getFromLocalStorage(key)).toEqual({ note: "draft berjalan" });
  });

  it("skipSaveRef aktif (baru saja submit): autosave TIDAK terjadwal meski data berubah", async () => {
    fakeFormState.isDirty = true;
    const { result } = renderHook(() =>
      useDraftForm("po", { note: "" }, { isCreate: true }),
    );
    const key = result.current.key;

    act(() => {
      result.current.post("/po");
    });
    act(() => {
      result.current.setData("note", "seharusnya tidak tersimpan");
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(getFromLocalStorage(key)).toBeNull();
  });

  it("unmount sebelum debounce selesai membatalkan penyimpanan draft", async () => {
    fakeFormState.isDirty = true;
    const { result, unmount } = renderHook(() =>
      useDraftForm("po", { note: "" }, { isCreate: true }),
    );
    const key = result.current.key;

    act(() => {
      result.current.setData("note", "batal tersimpan");
    });
    act(() => {
      unmount();
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

    expect(getFromLocalStorage(key)).toBeNull();
  });
});

describe("useDraftForm: listener beforeunload", () => {
  it("terdaftar saat form dirty & key ada -- trigger flush draft + preventDefault", () => {
    fakeFormState.isDirty = true;
    const { result } = renderHook(() =>
      useDraftForm("po", { note: "isi" }, { isCreate: true }),
    );
    const key = result.current.key;

    const event = new Event("beforeunload", { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(getFromLocalStorage(key)).toEqual({ note: "isi" });
  });

  it("TIDAK terdaftar saat form bersih (tidak dirty)", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useDraftForm("po", {}, { isCreate: true }));

    const registered = addSpy.mock.calls.some(
      ([type]) => type === "beforeunload",
    );
    expect(registered).toBe(false);
    addSpy.mockRestore();
  });
});

describe("useDraftForm: cleanup saat unmount", () => {
  it("showAlert selalu direset ke false saat unmount", () => {
    act(() => {
      useAlertDraftForm.getState().setShowAlert(true);
    });

    const { unmount } = renderHook(() =>
      useDraftForm("po", {}, { isCreate: true }),
    );

    act(() => {
      unmount();
    });

    expect(useAlertDraftForm.getState().showAlert).toBe(false);
  });
});
