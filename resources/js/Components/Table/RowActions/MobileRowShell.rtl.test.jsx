import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import MobileRowShell from "./MobileRowShell";

function setup(props = {}) {
  const onToggle = vi.fn();
  const onLongPress = vi.fn();
  render(
    <MobileRowShell
      selectionMode={false}
      checked={false}
      onToggle={onToggle}
      onLongPress={onLongPress}
      menu={<button type="button">MenuBtn</button>}
      label="Pilih baris"
      {...props}
    >
      <a href="/x">Konten</a>
    </MobileRowShell>,
  );
  return { onToggle, onLongPress, link: screen.getByText("Konten") };
}

describe("MobileRowShell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("merender menu dan children", () => {
    setup();
    expect(screen.getByText("MenuBtn")).toBeInTheDocument();
    expect(screen.getByText("Konten")).toBeInTheDocument();
  });

  it("checkbox hanya muncul saat selectionMode", () => {
    const { unmount } = render(
      <MobileRowShell selectionMode={false} label="Pilih">
        <span>c</span>
      </MobileRowShell>,
    );
    expect(screen.queryByRole("forminput")).not.toBeInTheDocument();
    unmount();

    render(
      <MobileRowShell selectionMode checked={false} label="Pilih">
        <span>c</span>
      </MobileRowShell>,
    );
    expect(
      screen.getByRole("forminput", { name: "Pilih" }),
    ).toBeInTheDocument();
  });

  it("klik checkbox memanggil onToggle(!checked)", () => {
    const { onToggle } = setup({ selectionMode: true, checked: false });

    fireEvent.click(screen.getByRole("forminput", { name: "Pilih baris" }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("long-press 500ms memanggil onLongPress", () => {
    const { onLongPress, link } = setup();

    fireEvent.pointerDown(link, { clientX: 5, clientY: 5, button: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("long-press diabaikan untuk tombol mouse non-primer", () => {
    const { onLongPress, link } = setup();

    fireEvent.pointerDown(link, {
      pointerType: "mouse",
      button: 2,
      clientX: 5,
      clientY: 5,
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("klik saat bukan selectionMode tidak dicegah dan tidak toggle", () => {
    const { onToggle, link } = setup();

    const notPrevented = fireEvent.click(link);

    expect(notPrevented).toBe(true);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("saat selectionMode, klik children memanggil onToggle(!checked) dan mencegah default", () => {
    const { onToggle, link } = setup({ selectionMode: true, checked: true });

    const notPrevented = fireEvent.click(link);

    expect(notPrevented).toBe(false);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("klik pertama setelah long-press ditelan, klik berikutnya normal", () => {
    const { onToggle, onLongPress, link } = setup({
      selectionMode: true,
      checked: false,
    });

    fireEvent.pointerDown(link, { clientX: 5, clientY: 5, button: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(link);
    const first = fireEvent.click(link);

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(first).toBe(false);
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent.click(link);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("klik di area menu tidak ikut di-toggle", () => {
    const { onToggle } = setup({ selectionMode: true });

    fireEvent.click(screen.getByText("MenuBtn"));

    expect(onToggle).not.toHaveBeenCalled();
  });
});
