import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ChipList from "./ChipList";

const items = [
  { key: "a", label: "Alpha", onNavigate: vi.fn() },
  { key: "b", label: "Beta" },
  { key: "c", label: "Gamma", href: "/gammas/3" },
];

describe("ChipList", () => {
  it("tidak merender apa pun bila items kosong", () => {
    const { container } = render(<ChipList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("label berfungsi (onNavigate) terpisah dari tombol X (onRemove)", async () => {
    const user = userEvent.setup({ delay: null });
    const onRemove = vi.fn();
    const onNavigate = vi.fn();
    render(
      <ChipList
        items={[{ key: "a", label: "Alpha", onNavigate }]}
        onRemove={onRemove}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Alpha" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove Alpha" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove.mock.calls[0][0].key).toBe("a");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("tanpa onNavigate/href label teks biasa; href -> tautan tab baru", () => {
    render(<ChipList items={items} onRemove={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Beta" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Beta" })).toBeNull();
    expect(screen.getByText("Beta")).toHaveAttribute("title", "Beta");
    const link = screen.getByRole("link", { name: "Gamma" });
    expect(link).toHaveAttribute("href", "/gammas/3");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("label panjang terpotong (truncate) dengan tooltip title penuh", () => {
    const label = "Pajak Pertambahan Nilai sebelas persen dari DPP nilai lain";
    render(<ChipList items={[{ key: "x", label }]} />);
    const el = screen.getByText(label);
    expect(el).toHaveAttribute("title", label);
    expect(el.className).toContain("truncate");
    expect(screen.getByTestId("chip-list").className).toContain("flex-wrap");
  });

  it("readOnly menyembunyikan semua X tapi label tetap berfungsi", () => {
    render(<ChipList items={items} onRemove={vi.fn()} readOnly />);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
  });

  it("tanpa onRemove atau removable=false: X tidak dirender", () => {
    const { rerender } = render(<ChipList items={items} />);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    rerender(
      <ChipList
        items={[{ key: "a", label: "Alpha", removable: false }]}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("status added/removed: penanda kelas diff; removed dicoret, tanpa X dan tanpa navigasi", () => {
    render(
      <ChipList
        items={[
          { key: "a", label: "Baru", status: "added" },
          {
            key: "r",
            label: "Lama",
            status: "removed",
            onNavigate: vi.fn(),
          },
        ]}
        onRemove={vi.fn()}
      />,
    );
    const [added, removed] = screen.getAllByTestId("chip");
    expect(added).toHaveAttribute("data-status", "added");
    expect(added.className).toContain("bg-green-100");
    expect(removed).toHaveAttribute("data-status", "removed");
    expect(removed.className).toContain("bg-red-100");
    expect(within(removed).getByText("Lama").className).toContain(
      "line-through",
    );
    expect(within(removed).queryByRole("button")).toBeNull();
  });
});
