import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import TiptapMentionList from "./TiptapMentionList";

const items = [
  { id: "1", label: "Budi Santoso" },
  { id: "2", label: "Citra Dewi" },
  { id: "3", label: "Budiman" },
];

describe("TiptapMentionList", () => {
  it("render semua item", () => {
    render(<TiptapMentionList items={items} command={vi.fn()} query="" />);
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Citra Dewi")).toBeInTheDocument();
    expect(screen.getByText("Budiman")).toBeInTheDocument();
  });

  it("menampilkan 'No results' jika items kosong", () => {
    render(<TiptapMentionList items={[]} command={vi.fn()} query="" />);
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("klik item memanggil command dengan id dan label", async () => {
    const user = userEvent.setup({ delay: null });
    const command = vi.fn();
    render(<TiptapMentionList items={items} command={command} query="" />);

    await user.click(screen.getByText("Citra Dewi"));
    expect(command).toHaveBeenCalledWith({ id: "2", label: "Citra Dewi" });
  });

  it("highlight bagian teks yang cocok dengan query", () => {
    const { container } = render(
      <TiptapMentionList items={items} command={vi.fn()} query="Budi" />,
    );
    const marks = container.querySelectorAll("mark");
    // "Budi Santoso" dan "Budiman" sama-sama mengandung "Budi"
    expect(marks.length).toBeGreaterThanOrEqual(2);
    marks.forEach((mark) => expect(mark.textContent).toBe("Budi"));
  });

  it("navigasi keyboard via ref.onKeyDown: ArrowDown/ArrowUp/Enter", () => {
    const command = vi.fn();
    const ref = createRef();
    render(
      <TiptapMentionList items={items} command={command} query="" ref={ref} />,
    );

    // ArrowDown pindah selectedIndex 0 -> 1. act() perlu dibungkus manual
    // karena setSelectedIndex dipanggil lewat ref.current (bukan event React
    // biasa), dan useImperativeHandle tanpa dependency array membuat handle
    // baru tiap render -- ref.current harus dibaca ULANG setelah act() supaya
    // memanggil closure yang punya selectedIndex terbaru.
    act(() => {
      const handledDown = ref.current.onKeyDown({
        event: { key: "ArrowDown" },
      });
      expect(handledDown).toBe(true);
    });

    let handledEnter;
    act(() => {
      handledEnter = ref.current.onKeyDown({ event: { key: "Enter" } });
    });
    expect(handledEnter).toBe(true);
    expect(command).toHaveBeenCalledWith({ id: "2", label: "Citra Dewi" });
  });

  it("onKeyDown return false untuk key yang tidak ditangani", () => {
    const ref = createRef();
    render(
      <TiptapMentionList items={items} command={vi.fn()} query="" ref={ref} />,
    );
    expect(ref.current.onKeyDown({ event: { key: "Escape" } })).toBe(false);
  });

  it("selectedIndex reset ke 0 saat items berubah", () => {
    const ref = createRef();
    const { rerender } = render(
      <TiptapMentionList items={items} command={vi.fn()} query="" ref={ref} />,
    );

    // onKeyDown dipanggil lewat ref.current (bukan event React biasa) dan
    // memicu setSelectedIndex, jadi act() perlu dibungkus manual -- sama
    // seperti pola di test "navigasi keyboard via ref.onKeyDown" di atas.
    act(() => {
      ref.current.onKeyDown({ event: { key: "ArrowDown" } });
    });

    const newItems = [{ id: "9", label: "Item Baru" }];
    rerender(
      <TiptapMentionList
        items={newItems}
        command={vi.fn()}
        query=""
        ref={ref}
      />,
    );

    const command = vi.fn();
    rerender(
      <TiptapMentionList
        items={newItems}
        command={command}
        query=""
        ref={ref}
      />,
    );
    ref.current.onKeyDown({ event: { key: "Enter" } });
    expect(command).toHaveBeenCalledWith({ id: "9", label: "Item Baru" });
  });
});
