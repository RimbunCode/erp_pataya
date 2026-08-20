import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useDeleteModal from "./useDeleteModal";

afterEach(() => {
  act(() => {
    useDeleteModal.getState().close();
  });
});

describe("useDeleteModal", () => {
  it("state awal isOpen=false, route/id null", () => {
    const { result } = renderHook(() => useDeleteModal());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.route).toBeNull();
    expect(result.current.id).toBeNull();
  });

  it("deleteItem membuka modal dengan route, id, attributes", () => {
    const { result } = renderHook(() => useDeleteModal());

    act(() => {
      result.current.deleteItem("users.destroy", 5, { name: "Budi" });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.route).toBe("users.destroy");
    expect(result.current.id).toBe(5);
    expect(result.current.attributes).toEqual({ name: "Budi" });
  });

  it("close menutup modal dan reset route/id", () => {
    const { result } = renderHook(() => useDeleteModal());

    act(() => {
      result.current.deleteItem("users.destroy", 5);
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.route).toBeNull();
    expect(result.current.id).toBeNull();
  });

  it("deleteItem tanpa attributes default ke object kosong", () => {
    const { result } = renderHook(() => useDeleteModal());

    act(() => {
      result.current.deleteItem("users.destroy", 5);
    });

    expect(result.current.attributes).toEqual({});
  });
});
