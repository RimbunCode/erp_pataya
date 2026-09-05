import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "./Pagination";

describe("Pagination", () => {
  it("tidak render apapun jika totalPages <= 1", () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tidak render apapun jika totalPages tidak diberikan", () => {
    const { container } = render(<Pagination currentPage={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tombol Previous tidak muncul di halaman pertama", () => {
    render(<Pagination currentPage={1} totalPages={5} />);
    expect(
      screen.queryByRole("button", { name: /previous/i }),
    ).not.toBeInTheDocument();
  });

  it("tombol Next tidak muncul di halaman terakhir", () => {
    render(<Pagination currentPage={5} totalPages={5} />);
    expect(
      screen.queryByRole("button", { name: /next/i }),
    ).not.toBeInTheDocument();
  });

  it("tombol Previous dan Next muncul di halaman tengah", () => {
    render(<Pagination currentPage={3} totalPages={5} />);
    expect(
      screen.getByRole("button", { name: /previous/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("klik nomor halaman memanggil onPageChanged dengan nomor tersebut", async () => {
    // currentPage=1 dgn maxAdjacent=2 hanya merender page 1,2,...,4,5 (page 3
    // di-collapse jadi ellipsis) -- klik page "5" yg selalu muncul (halaman akhir).
    const user = userEvent.setup({ delay: null });
    const onPageChanged = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChanged={onPageChanged}
      />,
    );

    await user.click(screen.getByText("5"));
    expect(onPageChanged).toHaveBeenCalledWith(5);
  });

  it("klik Next memanggil onPageChanged dengan currentPage+1", async () => {
    const user = userEvent.setup({ delay: null });
    const onPageChanged = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChanged={onPageChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChanged).toHaveBeenCalledWith(3);
  });

  it("klik Previous memanggil onPageChanged dengan currentPage-1", async () => {
    const user = userEvent.setup({ delay: null });
    const onPageChanged = vi.fn();
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChanged={onPageChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPageChanged).toHaveBeenCalledWith(2);
  });

  it("menampilkan ellipsis untuk rentang halaman yang besar", () => {
    render(<Pagination currentPage={10} totalPages={20} />);
    // Dengan totalPages besar & currentPage di tengah, ellipsis harus muncul.
    const ellipsis = document.querySelectorAll('[aria-hidden="true"]');
    expect(ellipsis.length).toBeGreaterThan(0);
  });

  it("halaman aktif ditandai isActive (aria-current)", () => {
    render(<Pagination currentPage={3} totalPages={5} />);
    const activePage = screen.getByText("3").closest("button");
    expect(activePage).toHaveAttribute("aria-current", "page");
  });
});
