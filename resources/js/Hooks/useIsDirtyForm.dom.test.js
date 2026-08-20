import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsDirtyForm } from "./useIsDirtyForm";

afterEach(() => {
  act(() => {
    useIsDirtyForm.setState({
      isDirty: false,
      processing: false,
      recentlySuccessful: false,
      showAlert: false,
      keepDraftOnClean: {},
    });
  });
});

describe("useIsDirtyForm", () => {
  it("state awal semua flag false", () => {
    const { result } = renderHook(() => useIsDirtyForm());
    expect(result.current.isDirty).toBe(false);
    expect(result.current.processing).toBe(false);
    expect(result.current.recentlySuccessful).toBe(false);
    expect(result.current.showAlert).toBe(false);
  });

  it("setter mengubah masing-masing flag secara independen", () => {
    const { result } = renderHook(() => useIsDirtyForm());

    act(() => {
      result.current.setIsDirty(true);
    });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.processing).toBe(false);

    act(() => {
      result.current.setProcessing(true);
    });
    expect(result.current.processing).toBe(true);
  });

  it("setKeepDraftOnClean menyimpan flag per-key tanpa menghapus key lain", () => {
    const { result } = renderHook(() => useIsDirtyForm());

    act(() => {
      result.current.setKeepDraftOnClean("form_a", true);
    });
    act(() => {
      result.current.setKeepDraftOnClean("form_b", true);
    });

    expect(result.current.keepDraftOnClean).toEqual({
      form_a: true,
      form_b: true,
    });
  });
});
