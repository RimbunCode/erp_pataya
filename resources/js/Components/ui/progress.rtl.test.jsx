import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Progress } from "./progress";

describe("Progress (root)", () => {
  it("render tanpa crash sebagai elemen dengan role progressbar", () => {
    render(<Progress value={40} />);
    const root = screen.getByRole("progressbar");
    expect(root).toBeInTheDocument();
    expect(root.tagName).toBe("DIV");
  });

  it("className default terpakai (h-4, w-full, overflow-hidden, rounded-full, bg-secondary)", () => {
    render(<Progress value={40} />);
    const root = screen.getByRole("progressbar");
    expect(root.className).toContain("h-4");
    expect(root.className).toContain("w-full");
    expect(root.className).toContain("overflow-hidden");
    expect(root.className).toContain("rounded-full");
    expect(root.className).toContain("bg-secondary");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<Progress value={40} className="custom-progress" />);
    const root = screen.getByRole("progressbar");
    expect(root.className).toContain("custom-progress");
    expect(root.className).toContain("bg-secondary");
  });

  it("meneruskan props HTML lain (data-testid, id) ke Radix Root", () => {
    render(
      <Progress value={40} data-testid="upload-progress" id="progress-1" />,
    );
    const root = screen.getByTestId("upload-progress");
    expect(root).toHaveAttribute("id", "progress-1");
  });

  it("meneruskan event handler (onClick) ke elemen root", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<Progress value={40} onClick={handleClick} />);
    await user.click(screen.getByRole("progressbar"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("forwardRef meneruskan ref ke elemen progressbar DOM asli", () => {
    const ref = createRef();
    render(<Progress ref={ref} value={40} />);
    expect(ref.current).toBe(screen.getByRole("progressbar"));
    expect(ref.current.tagName).toBe("DIV");
  });
});

describe("Progress (indicator visual fill)", () => {
  it("value diberikan menghasilkan translateX indicator sesuai persentase sisa", () => {
    render(<Progress value={30} />);
    const indicator = screen.getByRole("progressbar").firstChild;
    expect(indicator.style.transform).toBe("translateX(-70%)");
  });

  it("value=100 menghasilkan indicator translateX(-0%) (bar penuh)", () => {
    render(<Progress value={100} />);
    const indicator = screen.getByRole("progressbar").firstChild;
    expect(indicator.style.transform).toBe("translateX(-0%)");
  });

  it("value tidak diberikan (undefined) menghasilkan translateX(-100%) (bar kosong, fallback ke 0)", () => {
    render(<Progress />);
    const indicator = screen.getByRole("progressbar").firstChild;
    expect(indicator.style.transform).toBe("translateX(-100%)");
  });

  it("className default indicator terpakai (bg-primary, flex-1, transition-all)", () => {
    render(<Progress value={40} />);
    const indicator = screen.getByRole("progressbar").firstChild;
    expect(indicator.className).toContain("bg-primary");
    expect(indicator.className).toContain("flex-1");
    expect(indicator.className).toContain("w-full");
    expect(indicator.className).toContain("h-full");
    expect(indicator.className).toContain("transition-all");
  });
});

describe("Progress -- BUG: prop `value` tidak pernah diteruskan ke Radix Root", () => {
  // Source: `({ className, value, ...props })` -- `value` di-destructure keluar
  // dari `...props` untuk dipakai menghitung inline style translateX indicator,
  // tapi TIDAK pernah disisipkan kembali sebagai `value={value}` pada
  // <ProgressPrimitive.Root {...props}>. Akibatnya Radix Root SELALU menerima
  // value=undefined (default null-nya Radix) apa pun angka yang dikirim caller,
  // sehingga data-state & aria-valuenow yang dibaca assistive technology TIDAK
  // PERNAH merefleksikan progress sebenarnya -- walau indicator visual (lewat
  // inline style manual) sudah terisi benar. Test ini mendokumentasikan
  // perilaku SAAT INI (bukan memperbaikinya).

  it("root tetap data-state='indeterminate' & tanpa aria-valuenow walau value=50 (progress berjalan)", () => {
    render(<Progress value={50} />);
    const root = screen.getByRole("progressbar");
    expect(root).toHaveAttribute("data-state", "indeterminate");
    expect(root).not.toHaveAttribute("aria-valuenow");
    // Sementara itu indicator visual SUDAH terisi 50% -- membuktikan
    // ketidaksinkronan antara tampilan visual & state aksesibilitas.
    expect(root.firstChild.style.transform).toBe("translateX(-50%)");
  });

  it("root tetap data-state='indeterminate' walau value=100 (seharusnya 'complete')", () => {
    render(<Progress value={100} />);
    const root = screen.getByRole("progressbar");
    expect(root).toHaveAttribute("data-state", "indeterminate");
    expect(root).not.toHaveAttribute("aria-valuenow");
  });
});

describe("Progress -- BUG: value melebihi max menghasilkan transform CSS tidak valid", () => {
  // `translateX(-${100 - (value || 0)}%)` dengan value > 100 menghasilkan
  // angka negatif di dalam template, mis. value=150 -> "translateX(--50%)"
  // (minus ganda). String CSS ini tidak valid, jadi browser/jsdom menolaknya
  // secara diam-diam -- indicator berakhir TANPA transform sama sekali
  // (bar tidak bergerak/hilang), bukannya error yang kelihatan.

  it("value=150 (melebihi max default 100) membuat indicator kehilangan transform sama sekali", () => {
    render(<Progress value={150} />);
    const indicator = screen.getByRole("progressbar").firstChild;
    expect(indicator.style.transform).toBe("");
  });
});
