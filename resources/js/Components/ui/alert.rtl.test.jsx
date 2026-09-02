import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  AlertToolbar,
} from "./alert";

describe("Alert", () => {
  it("render sebagai <div role='alert'> dengan className default (variant=secondary, appearance=solid, size=md)", () => {
    render(<Alert data-testid="alert">Pesan</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert).toBe(screen.getByTestId("alert"));
    expect(alert.tagName).toBe("DIV");
    expect(alert).toHaveAttribute("data-slot", "alert");
    // base classVariance
    expect(alert.className).toContain("flex");
    expect(alert.className).toContain("items-stretch");
    // compound variant default: secondary + solid
    expect(alert.className).toContain("bg-muted");
    expect(alert.className).toContain("text-foreground");
    // size default: md
    expect(alert.className).toContain("p-3.5");
    expect(alert.className).toContain("text-sm");
  });

  it("render children", () => {
    render(<Alert>Konten alert</Alert>);
    expect(screen.getByText("Konten alert")).toBeInTheDocument();
  });

  it("menggabungkan className custom dengan className default (bukan menghapusnya)", () => {
    render(
      <Alert data-testid="alert" className="custom-alert-class">
        Isi
      </Alert>,
    );
    const alert = screen.getByTestId("alert");
    expect(alert.className).toContain("custom-alert-class");
    expect(alert.className).toContain("flex");
  });

  it("variant + appearance compound menghasilkan className yang benar (destructive/solid)", () => {
    render(
      <Alert data-testid="alert" variant="destructive" appearance="solid">
        Error
      </Alert>,
    );
    const alert = screen.getByTestId("alert");
    expect(alert.className).toContain("bg-destructive");
    expect(alert.className).toContain("text-destructive-foreground");
  });

  it("variant + appearance compound menghasilkan className yang benar (primary/outline)", () => {
    render(
      <Alert data-testid="alert" variant="primary" appearance="outline">
        Info
      </Alert>,
    );
    const alert = screen.getByTestId("alert");
    expect(alert.className).toContain("border");
    expect(alert.className).toContain("bg-background");
    expect(alert.className).toContain("text-primary");
  });

  it("prop size mengubah className ukuran (size='lg')", () => {
    render(
      <Alert data-testid="alert" size="lg">
        Besar
      </Alert>,
    );
    const alert = screen.getByTestId("alert");
    expect(alert.className).toContain("p-4");
    expect(alert.className).toContain("text-base");
    expect(alert.className).toContain("rounded-lg");
  });

  it("prop size mengubah className ukuran (size='sm')", () => {
    render(
      <Alert data-testid="alert" size="sm">
        Kecil
      </Alert>,
    );
    const alert = screen.getByTestId("alert");
    expect(alert.className).toContain("px-3");
    expect(alert.className).toContain("text-xs");
    expect(alert.className).toContain("rounded-md");
  });

  it("meneruskan props lain (mis. data-testid, id) ke elemen root", () => {
    render(
      <Alert data-testid="alert" id="my-alert">
        Isi
      </Alert>,
    );
    const alert = screen.getByTestId("alert");
    expect(alert).toHaveAttribute("id", "my-alert");
  });

  it("close default (false) tidak merender tombol dismiss", () => {
    render(<Alert>Tanpa tombol close</Alert>);
    expect(
      screen.queryByRole("button", { name: "Dismiss" }),
    ).not.toBeInTheDocument();
  });

  it("close=true merender tombol dismiss dengan aria-label 'Dismiss' dan data-slot 'alert-close'", () => {
    render(<Alert close>Dengan tombol close</Alert>);
    const button = screen.getByRole("button", { name: "Dismiss" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-slot", "alert-close");
  });

  it("klik tombol dismiss memanggil callback onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Alert close onClose={onClose}>
        Isi
      </Alert>,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("close=true tanpa onClose tidak melempar error saat diklik", async () => {
    const user = userEvent.setup();
    render(<Alert close>Isi</Alert>);

    await expect(
      user.click(screen.getByRole("button", { name: "Dismiss" })),
    ).resolves.not.toThrow();
  });
});

describe("AlertTitle", () => {
  it("render sebagai <div data-slot='alert-title'> dengan className default", () => {
    render(<AlertTitle data-testid="title">Judul</AlertTitle>);
    const title = screen.getByTestId("title");
    expect(title.tagName).toBe("DIV");
    expect(title).toHaveAttribute("data-slot", "alert-title");
    expect(title.className).toContain("grow");
    expect(title.className).toContain("tracking-tight");
    expect(screen.getByText("Judul")).toBeInTheDocument();
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <AlertTitle data-testid="title" className="custom-title">
        Judul
      </AlertTitle>,
    );
    const title = screen.getByTestId("title");
    expect(title.className).toContain("custom-title");
    expect(title.className).toContain("grow");
  });
});

describe("AlertIcon", () => {
  it("render sebagai <div data-slot='alert-icon'> dengan className default 'shrink-0' dan children", () => {
    render(
      <AlertIcon data-testid="icon">
        <svg data-testid="svg-icon" />
      </AlertIcon>,
    );
    const icon = screen.getByTestId("icon");
    expect(icon).toHaveAttribute("data-slot", "alert-icon");
    expect(icon.className).toContain("shrink-0");
    expect(screen.getByTestId("svg-icon")).toBeInTheDocument();
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <AlertIcon data-testid="icon" className="custom-icon">
        <span />
      </AlertIcon>,
    );
    const icon = screen.getByTestId("icon");
    expect(icon.className).toContain("custom-icon");
    expect(icon.className).toContain("shrink-0");
  });
});

describe("AlertToolbar", () => {
  it("render sebagai <div data-slot='alert-toolbar'> berisi children", () => {
    render(
      <AlertToolbar data-testid="toolbar">
        <button type="button">Aksi</button>
      </AlertToolbar>,
    );
    const toolbar = screen.getByTestId("toolbar");
    expect(toolbar).toHaveAttribute("data-slot", "alert-toolbar");
    expect(
      within(toolbar).getByRole("button", { name: "Aksi" }),
    ).toBeInTheDocument();
  });

  it("meneruskan className custom (tanpa className default bawaan)", () => {
    render(<AlertToolbar data-testid="toolbar" className="custom-toolbar" />);
    const toolbar = screen.getByTestId("toolbar");
    expect(toolbar.className).toBe("custom-toolbar");
  });
});

describe("AlertDescription", () => {
  it("render sebagai <div data-slot='alert-description'> dengan className default", () => {
    render(
      <AlertDescription data-testid="desc">Deskripsi alert</AlertDescription>,
    );
    const desc = screen.getByTestId("desc");
    expect(desc).toHaveAttribute("data-slot", "alert-description");
    expect(desc.className).toContain("text-sm");
    expect(screen.getByText("Deskripsi alert")).toBeInTheDocument();
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <AlertDescription data-testid="desc" className="custom-desc">
        Isi
      </AlertDescription>,
    );
    const desc = screen.getByTestId("desc");
    expect(desc.className).toContain("custom-desc");
    expect(desc.className).toContain("text-sm");
  });
});

describe("AlertContent", () => {
  it("render sebagai <div data-slot='alert-content'> dengan className default", () => {
    render(<AlertContent data-testid="content">Isi konten</AlertContent>);
    const content = screen.getByTestId("content");
    expect(content).toHaveAttribute("data-slot", "alert-content");
    expect(content.className).toContain("space-y-2");
  });

  it("menggabungkan className custom dengan default", () => {
    render(
      <AlertContent data-testid="content" className="custom-content">
        Isi
      </AlertContent>,
    );
    const content = screen.getByTestId("content");
    expect(content.className).toContain("custom-content");
    expect(content.className).toContain("space-y-2");
  });
});

describe("Alert - komposisi penuh", () => {
  it("seluruh sub-komponen dapat dirender bersama membentuk struktur alert yang valid", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Alert variant="success" appearance="light" close onClose={onClose}>
        <AlertIcon>
          <svg data-testid="success-icon" />
        </AlertIcon>
        <AlertContent>
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription>Data berhasil disimpan.</AlertDescription>
        </AlertContent>
        <AlertToolbar>
          <button type="button">Undo</button>
        </AlertToolbar>
      </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Berhasil")).toBeInTheDocument();
    expect(
      within(alert).getByText("Data berhasil disimpan."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("success-icon")).toBeInTheDocument();
    expect(
      within(alert).getByRole("button", { name: "Undo" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
