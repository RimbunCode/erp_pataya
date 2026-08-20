import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// useFormPage() hanya bisa dites terisolasi lewat wrapper Provider manual
// yang mem-pass FormPageContext.Provider -- ia BUKAN dites lewat
// FormPageProvider asli (yang menambah kompleksitas useMemo/prop lain di
// luar scope hook ini). Ini sesuai instruksi task: "ambil dari context,
// TIDAK BISA ditest terisolasi tanpa provider konteks buatan sendiri".
import { FormPageContext, useFormPage } from "./FormPage";

function wrapperWithContext(contextValue) {
  // eslint-disable-next-line react/display-name
  return ({ children }) => (
    <FormPageContext.Provider value={contextValue}>
      {children}
    </FormPageContext.Provider>
  );
}

describe("useFormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tanpa Provider (context undefined), mengembalikan undefined tanpa crash", () => {
    const { result } = renderHook(() => useFormPage());
    expect(result.current).toBeUndefined();
  });

  it("dengan Provider, mengembalikan context apa adanya ketika defaultValue tidak diberikan", () => {
    const contextValue = { isCreate: false, data: { foo: "bar" } };
    const { result } = renderHook(() => useFormPage(), {
      wrapper: wrapperWithContext(contextValue),
    });

    expect(result.current).toBe(contextValue);
  });

  it("defaultValue diberikan tapi context TIDAK punya form -- tidak crash, context tetap dikembalikan", () => {
    const contextValue = { isCreate: true, defaultData: null };
    const { result } = renderHook(() => useFormPage({ status: "draft" }), {
      wrapper: wrapperWithContext(contextValue),
    });

    expect(result.current).toBe(contextValue);
  });

  it("context punya defaultData terisi & isCreate=false -- defaultValue param diabaikan, form.setData TIDAK dipanggil dengan defaultValue", async () => {
    const setDefaults = vi.fn();
    const setData = vi.fn();
    const contextValue = {
      isCreate: false,
      defaultData: { id: 1, name: "Sudah Ada" },
      form: { setDefaults, setData },
    };

    renderHook(() => useFormPage({ status: "draft" }), {
      wrapper: wrapperWithContext(contextValue),
    });

    // Beri waktu untuk effect resolve berjalan (meski hasilnya kosong).
    await waitFor(() => {
      expect(setDefaults).not.toHaveBeenCalled();
    });
    expect(setData).not.toHaveBeenCalled();
  });

  it("context TIDAK punya defaultData (create baru) -- defaultValue object diterapkan via form.setDefaults & form.setData", async () => {
    const setDefaults = vi.fn();
    const setData = vi.fn();
    const contextValue = {
      isCreate: true,
      defaultData: null,
      form: { setDefaults, setData },
    };

    renderHook(() => useFormPage({ status: "draft" }), {
      wrapper: wrapperWithContext(contextValue),
    });

    await waitFor(() => {
      expect(setDefaults).toHaveBeenCalledWith({ status: "draft" });
    });
    expect(setData).toHaveBeenCalledTimes(1);
    // setData dipanggil dengan updater function -- verifikasi hasil merge-nya.
    const updater = setData.mock.calls[0][0];
    expect(updater({ existing: true })).toEqual({
      existing: true,
      status: "draft",
    });
  });

  it("defaultValue berupa async function -- di-resolve dan diterapkan setelah promise selesai", async () => {
    const setDefaults = vi.fn();
    const setData = vi.fn();
    const contextValue = {
      isCreate: true,
      defaultData: null,
      form: { setDefaults, setData },
    };
    const asyncDefault = vi.fn().mockResolvedValue({ status: "async-draft" });

    renderHook(() => useFormPage(asyncDefault), {
      wrapper: wrapperWithContext(contextValue),
    });

    await waitFor(() => {
      expect(setDefaults).toHaveBeenCalledWith({ status: "async-draft" });
    });
    expect(asyncDefault).toHaveBeenCalled();
  });

  it("defaultValue null dianggap object kosong -- tidak memanggil setDefaults/setData (tidak ada key)", async () => {
    const setDefaults = vi.fn();
    const setData = vi.fn();
    const contextValue = {
      isCreate: true,
      defaultData: null,
      form: { setDefaults, setData },
    };

    renderHook(() => useFormPage(null), {
      wrapper: wrapperWithContext(contextValue),
    });

    // beri microtask untuk effect selesai
    await new Promise((r) => setTimeout(r, 0));
    expect(setDefaults).not.toHaveBeenCalled();
    expect(setData).not.toHaveBeenCalled();
  });

  it("notUseWhenCreate=true + isCreate=true + ada defaultData context -- defaultValue param TETAP diabaikan (perilaku sama seperti notUseWhenCreate=false)", async () => {
    // Baca logic effectiveDefaultValue: kondisi abaikan defaultValue param
    // adalah `hasContextDefaultData && !(isCreate && !notUseWhenCreate)`.
    // Saat isCreate=true & notUseWhenCreate=true -> !(true && false) = true
    // -> tetap diabaikan (defaultValue param jadi {}). notUseWhenCreate hanya
    // berpengaruh saat isCreate=true DAN context TIDAK punya defaultData --
    // dalam kasus itu shouldTrackDefaultValue/effectiveDefaultValue tetap
    // pakai param defaultValue (lihat test lain di bawah).
    const setDefaults = vi.fn();
    const setData = vi.fn();
    const contextValue = {
      isCreate: true,
      defaultData: { id: 1 },
      form: { setDefaults, setData },
    };

    renderHook(
      () =>
        useFormPage(
          { status: "override" },
          { trackDefaultValue: true, notUseWhenCreate: true },
        ),
      { wrapper: wrapperWithContext(contextValue) },
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(setDefaults).not.toHaveBeenCalled();
    expect(setData).not.toHaveBeenCalled();
  });

  it("isCreate=true SEDANG context TANPA defaultData -- defaultValue param tetap diterapkan (notUseWhenCreate tidak relevan di sini)", async () => {
    const setDefaults = vi.fn();
    const setData = vi.fn();
    const contextValue = {
      isCreate: true,
      defaultData: null,
      form: { setDefaults, setData },
    };

    renderHook(
      () =>
        useFormPage(
          { status: "override" },
          { trackDefaultValue: true, notUseWhenCreate: false },
        ),
      { wrapper: wrapperWithContext(contextValue) },
    );

    await waitFor(() => {
      expect(setDefaults).toHaveBeenCalledWith({ status: "override" });
    });
  });
});
