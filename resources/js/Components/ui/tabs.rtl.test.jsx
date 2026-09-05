import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

function renderTabs(rootProps = {}) {
  return render(
    <Tabs defaultValue="a" {...rootProps}>
      <TabsList>
        <TabsTrigger value="a">Tab A</TabsTrigger>
        <TabsTrigger value="b">Tab B</TabsTrigger>
        <TabsTrigger value="c" disabled>
          Tab C
        </TabsTrigger>
      </TabsList>
      <TabsContent value="a">Konten A</TabsContent>
      <TabsContent value="b">Konten B</TabsContent>
      <TabsContent value="c">Konten C</TabsContent>
    </Tabs>,
  );
}

describe("Tabs (Root)", () => {
  it("render tanpa crash: tablist & semua trigger tampil, konten sesuai defaultValue tampil", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tab A" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tab B" })).toBeInTheDocument();
    expect(screen.getByText("Konten A")).toBeInTheDocument();
  });

  it("konten dari tab non-aktif TIDAK dirender di DOM (Radix unmount default)", () => {
    renderTabs();
    expect(screen.queryByText("Konten B")).not.toBeInTheDocument();
    expect(screen.queryByText("Konten C")).not.toBeInTheDocument();
  });

  it("klik trigger lain mengganti konten aktif -- konten lama hilang, konten baru muncul", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "Tab B" }));

    expect(screen.getByText("Konten B")).toBeInTheDocument();
    expect(screen.queryByText("Konten A")).not.toBeInTheDocument();
  });

  it("mode controlled (value + onValueChange): klik trigger memicu onValueChange, konten hanya berubah jika prop value ikut berubah", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Tabs value="a" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Konten A</TabsContent>
        <TabsContent value="b">Konten B</TabsContent>
      </Tabs>,
    );

    await user.click(screen.getByRole("tab", { name: "Tab B" }));
    expect(onValueChange).toHaveBeenCalledWith("b");
    // Controlled: tanpa consumer meng-update prop value, konten TIDAK berubah sendiri.
    expect(screen.getByText("Konten A")).toBeInTheDocument();
    expect(screen.queryByText("Konten B")).not.toBeInTheDocument();

    rerender(
      <Tabs value="b" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Konten A</TabsContent>
        <TabsContent value="b">Konten B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("Konten B")).toBeInTheDocument();
    expect(screen.queryByText("Konten A")).not.toBeInTheDocument();
  });

  it("orientation default 'horizontal': aria-orientation pada tablist bernilai 'horizontal'", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
  });

  it("orientation='vertical': aria-orientation pada tablist bernilai 'vertical'", () => {
    renderTabs({ orientation: "vertical" });
    expect(screen.getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });
});

describe("TabsList", () => {
  it("className default (inline-flex, h-10, rounded-md, bg-muted) terpakai", () => {
    renderTabs();
    const list = screen.getByRole("tablist");
    expect(list.className).toContain("inline-flex");
    expect(list.className).toContain("h-10");
    expect(list.className).toContain("rounded-md");
    expect(list.className).toContain("bg-muted");
  });

  it("className custom digabung dengan className default, bukan menggantikan", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList className="custom-list-class">
          <TabsTrigger value="a">Tab A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Konten A</TabsContent>
      </Tabs>,
    );
    const list = screen.getByRole("tablist");
    expect(list.className).toContain("custom-list-class");
    expect(list.className).toContain("inline-flex");
  });

  it("forwardRef meneruskan ref ke elemen tablist asli", () => {
    const ref = createRef();
    render(
      <Tabs defaultValue="a">
        <TabsList ref={ref}>
          <TabsTrigger value="a">Tab A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Konten A</TabsContent>
      </Tabs>,
    );
    expect(ref.current).toBe(screen.getByRole("tablist"));
  });

  it("meneruskan props lain (aria-label, data-testid) ke elemen asli", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Navigasi tab" data-testid="my-tabslist">
          <TabsTrigger value="a">Tab A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Konten A</TabsContent>
      </Tabs>,
    );
    const list = screen.getByTestId("my-tabslist");
    expect(list).toHaveAttribute("aria-label", "Navigasi tab");
  });
});

describe("TabsTrigger", () => {
  it("className default (inline-flex, rounded-sm, data-[state=active]:bg-background) terpakai", () => {
    renderTabs();
    const trigger = screen.getByRole("tab", { name: "Tab A" });
    expect(trigger.className).toContain("inline-flex");
    expect(trigger.className).toContain("rounded-sm");
    expect(trigger.className).toContain("data-[state=active]:bg-background");
  });

  it("className custom digabung dengan className default, bukan menggantikan", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a" className="custom-trigger-class">
            Tab A
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a">Konten A</TabsContent>
      </Tabs>,
    );
    const trigger = screen.getByRole("tab", { name: "Tab A" });
    expect(trigger.className).toContain("custom-trigger-class");
    expect(trigger.className).toContain("inline-flex");
  });

  it("forwardRef meneruskan ref ke elemen <button> trigger asli", () => {
    const ref = createRef();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a" ref={ref}>
            Tab A
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a">Konten A</TabsContent>
      </Tabs>,
    );
    expect(ref.current).toBe(screen.getByRole("tab", { name: "Tab A" }));
    expect(ref.current.tagName).toBe("BUTTON");
  });

  it("trigger aktif: data-state='active', aria-selected='true'", () => {
    renderTabs();
    const triggerA = screen.getByRole("tab", { name: "Tab A" });
    expect(triggerA).toHaveAttribute("data-state", "active");
    expect(triggerA).toHaveAttribute("aria-selected", "true");
  });

  it("trigger tidak aktif: data-state='inactive', aria-selected='false'", () => {
    renderTabs();
    const triggerB = screen.getByRole("tab", { name: "Tab B" });
    expect(triggerB).toHaveAttribute("data-state", "inactive");
    expect(triggerB).toHaveAttribute("aria-selected", "false");
  });

  it("disabled=true: atribut disabled tampil, klik TIDAK mengubah tab aktif", async () => {
    const user = userEvent.setup();
    renderTabs();
    const triggerC = screen.getByRole("tab", { name: "Tab C" });
    expect(triggerC).toHaveAttribute("disabled");

    await user.click(triggerC);

    expect(screen.getByText("Konten A")).toBeInTheDocument();
    expect(screen.queryByText("Konten C")).not.toBeInTheDocument();
  });

  it("meneruskan props lain (aria-label, data-testid) ke elemen asli", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a" data-testid="my-trigger">
            Tab A
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a">Konten A</TabsContent>
      </Tabs>,
    );
    expect(screen.getByTestId("my-trigger")).toBeInTheDocument();
  });
});

describe("TabsContent", () => {
  it("className default (mt-2) terpakai pada konten aktif", () => {
    renderTabs();
    expect(screen.getByText("Konten A").className).toContain("mt-2");
  });

  it("className custom digabung dengan className default, bukan menggantikan", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
        </TabsList>
        <TabsContent value="a" className="custom-content-class">
          Konten A
        </TabsContent>
      </Tabs>,
    );
    const content = screen.getByText("Konten A");
    expect(content.className).toContain("custom-content-class");
    expect(content.className).toContain("mt-2");
  });

  it("forwardRef meneruskan ref ke elemen konten aktif", () => {
    const ref = createRef();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
        </TabsList>
        <TabsContent value="a" ref={ref}>
          Konten A
        </TabsContent>
      </Tabs>,
    );
    expect(ref.current).toBe(screen.getByText("Konten A"));
  });

  it("meneruskan props lain (data-testid) ke elemen asli", () => {
    renderTabs();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
        </TabsList>
        <TabsContent value="a" data-testid="my-content">
          Konten A
        </TabsContent>
      </Tabs>,
    );
    expect(screen.getAllByTestId("my-content")[0]).toBeInTheDocument();
  });
});

describe("Navigasi keyboard", () => {
  it("activationMode default 'automatic': ArrowRight dari trigger aktif memindahkan fokus & langsung mengaktifkan trigger berikutnya yang tidak disabled", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "Tab A" }));
    await user.keyboard("{ArrowRight}");

    const triggerB = screen.getByRole("tab", { name: "Tab B" });
    expect(triggerB).toHaveFocus();
    expect(triggerB).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Konten B")).toBeInTheDocument();
  });

  it("ArrowLeft dari trigger pertama wrap-around ke trigger terakhir yang tidak disabled", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "Tab A" }));
    await user.keyboard("{ArrowLeft}");

    // Tab C disabled, Radix melewati trigger disabled saat wrap-around.
    const triggerB = screen.getByRole("tab", { name: "Tab B" });
    expect(triggerB).toHaveFocus();
    expect(triggerB).toHaveAttribute("data-state", "active");
  });

  it("activationMode='manual': ArrowRight memindahkan fokus TANPA mengaktifkan tab, harus Enter untuk mengaktifkan", async () => {
    const user = userEvent.setup();
    renderTabs({ activationMode: "manual" });

    await user.click(screen.getByRole("tab", { name: "Tab A" }));
    await user.keyboard("{ArrowRight}");

    const triggerB = screen.getByRole("tab", { name: "Tab B" });
    expect(triggerB).toHaveFocus();
    expect(triggerB).toHaveAttribute("data-state", "inactive");
    expect(screen.getByText("Konten A")).toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(triggerB).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Konten B")).toBeInTheDocument();
  });
});
