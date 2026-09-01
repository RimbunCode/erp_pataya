import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import StrikethroughDiff from "./StrikethroughDiff";

describe("StrikethroughDiff", () => {
  it("teks identik dirender tanpa styling coret/hijau", () => {
    const { container } = render(
      <StrikethroughDiff oldText="halo dunia" newText="halo dunia" />,
    );
    expect(container.querySelector(".line-through")).not.toBeInTheDocument();
    expect(container.querySelector(".text-green-500")).not.toBeInTheDocument();
    expect(container.textContent).toBe("halo dunia");
  });

  it("teks yang dihapus ditandai line-through merah", () => {
    const { container } = render(
      <StrikethroughDiff oldText="halo dunia" newText="halo" />,
    );
    const removed = container.querySelector(".line-through.text-red-500");
    expect(removed).toBeInTheDocument();
    expect(removed.textContent).toContain("dunia");
  });

  it("teks yang ditambahkan ditandai hijau bold", () => {
    const { container } = render(
      <StrikethroughDiff oldText="halo" newText="halo dunia" />,
    );
    const added = container.querySelector(".text-green-500.font-bold");
    expect(added).toBeInTheDocument();
    expect(added.textContent).toContain("dunia");
  });

  it("gabungan hapus+tambah menghasilkan kedua jenis span dan teks utuh terpelihara", () => {
    const { container } = render(
      <StrikethroughDiff oldText="kucing hitam" newText="kucing putih" />,
    );
    expect(container.querySelector(".line-through")).toBeInTheDocument();
    expect(container.querySelector(".text-green-500")).toBeInTheDocument();
    expect(container.textContent).toBe("kucing hitamputih");
  });

  it("meneruskan props lain (mis. className) ke span pembungkus", () => {
    const { container } = render(
      <StrikethroughDiff oldText="a" newText="a" className="custom" />,
    );
    expect(container.querySelector("span.custom")).toBeInTheDocument();
  });
});
