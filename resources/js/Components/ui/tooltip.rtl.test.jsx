import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
} from "./tooltip";

// Radix TooltipProvider default delayDuration (700ms) pakai setTimeout ASLI
// internal utk hover-intent delay -- skenario di file ini banyak menguji
// buka/tutup tooltip via fokus/klik/hover, dan timer 700ms itu resolve di
// luar kendali act() manapun. delayDuration=0 membuat transisi terjadi
// segera tanpa timer nyata (pola sama dgn LinkModel.rtl.test.jsx &
// pemakaian produksi di sidebar.jsx).
const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>,
    );
  });
  return result;
};

const renderTooltip = ({
  triggerProps = {},
  contentProps = {},
  rootProps = {},
  triggerLabel = "Trigger",
  content = "Isi tooltip",
} = {}) =>
  render(
    <Tooltip {...rootProps}>
      <TooltipTrigger {...triggerProps}>{triggerLabel}</TooltipTrigger>
      <TooltipContent {...contentProps}>{content}</TooltipContent>
    </Tooltip>,
  );

describe("Re-export langsung dari @radix-ui/react-tooltip", () => {
  it("Tooltip, TooltipTrigger, TooltipPortal adalah referensi langsung primitive Radix (tanpa wrapper tambahan)", () => {
    expect(Tooltip).toBe(TooltipPrimitive.Root);
    expect(TooltipTrigger).toBe(TooltipPrimitive.Trigger);
    expect(TooltipPortal).toBe(TooltipPrimitive.Portal);
  });
});

describe("TooltipProvider", () => {
  it("murni context provider -- tidak menambahkan elemen DOM wrapper apapun", () => {
    const { container } = rtlRender(
      <TooltipProvider>
        <div data-testid="child">Anak</div>
      </TooltipProvider>,
    );

    expect(container.firstChild).toBe(screen.getByTestId("child"));
  });
});

describe("Tooltip (tanpa TooltipProvider)", () => {
  it("melempar error krn context TooltipProvider wajib ada", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() =>
      rtlRender(
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Isi</TooltipContent>
        </Tooltip>,
      ),
    ).toThrow("`Tooltip` must be used within `TooltipProvider`");

    consoleError.mockRestore();
  });
});

describe("Tooltip (alur buka/tutup dasar)", () => {
  it("tooltip (role='tooltip') tidak ada di DOM sebelum trigger di-fokus/hover", async () => {
    await renderTooltip();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("defaultOpen=true merender tooltip sejak awal dengan data-state 'instant-open'", async () => {
    await renderTooltip({
      rootProps: { defaultOpen: true },
      contentProps: { "data-testid": "content" },
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toHaveAttribute(
      "data-state",
      "instant-open",
    );
  });

  it("fokus pada trigger membuka tooltip secara instan, blur menutupnya", async () => {
    await renderTooltip({ contentProps: { "data-testid": "content" } });
    const trigger = screen.getByRole("button", { name: "Trigger" });

    await act(async () => {
      trigger.focus();
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toHaveAttribute(
      "data-state",
      "instant-open",
    );

    await act(async () => {
      trigger.blur();
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("klik pada trigger yang tooltip-nya sedang terbuka (via fokus) menutup tooltip", async () => {
    const user = userEvent.setup();
    await renderTooltip();
    const trigger = screen.getByRole("button", { name: "Trigger" });

    await act(async () => {
      trigger.focus();
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await act(async () => {
      await user.click(trigger);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hover pada trigger memunculkan tooltip (delayDuration=0 pada TooltipProvider test)", async () => {
    // Walau delayDuration=0, Radix tetap menjadwalkan open lewat
    // window.setTimeout ASLI (handleDelayedOpen) -- timer itu jadi macrotask
    // yang resolve DI LUAR act() manapun yang bisa dibungkus test ini secara
    // langsung (beda dgn fokus, yang memanggil context.onOpen() sinkron).
    // Fake timers + advanceTimersByTimeAsync di dalam act() membuat timer
    // itu di-flush secara terkontrol, sesuai pola project (lihat
    // Tags.rtl.test.jsx).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      delay: null,
      advanceTimers: vi.advanceTimersByTime,
    });
    await renderTooltip();
    const trigger = screen.getByRole("button", { name: "Trigger" });

    await user.hover(trigger);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("aria-describedby pada trigger terisi id tooltip saat terbuka, tidak ada saat tertutup", async () => {
    await renderTooltip();
    const trigger = screen.getByRole("button", { name: "Trigger" });

    expect(trigger).not.toHaveAttribute("aria-describedby");

    await act(async () => {
      trigger.focus();
    });

    const tooltip = screen.getByRole("tooltip");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
  });
});

describe("Tooltip open terkontrol (controlled)", () => {
  it("prop open mengendalikan tampil/sembunyi tooltip secara eksternal", async () => {
    const onOpenChange = vi.fn();
    const buildTree = (open) => (
      <TooltipProvider delayDuration={0}>
        <Tooltip open={open} onOpenChange={onOpenChange}>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Isi tooltip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    let utils;
    await act(async () => {
      utils = rtlRender(buildTree(true));
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    await act(async () => {
      utils.rerender(buildTree(false));
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("TooltipTrigger", () => {
  it("dirender sbg elemen <button>", async () => {
    await renderTooltip();
    expect(screen.getByRole("button", { name: "Trigger" }).tagName).toBe(
      "BUTTON",
    );
  });

  it("disabled diteruskan ke elemen <button> asli", async () => {
    await renderTooltip({ triggerProps: { disabled: true } });
    expect(screen.getByRole("button", { name: "Trigger" })).toBeDisabled();
  });

  it("meneruskan props lain (mis. data-testid) ke elemen trigger", async () => {
    await renderTooltip({ triggerProps: { "data-testid": "my-trigger" } });
    expect(screen.getByTestId("my-trigger")).toBeInTheDocument();
  });
});

describe("TooltipContent", () => {
  it("meneruskan ref ke elemen Radix Content asli (bukan elemen role='tooltip' yang visually-hidden)", async () => {
    const ref = createRef();
    await renderTooltip({
      rootProps: { defaultOpen: true },
      contentProps: { ref, "data-testid": "content" },
    });

    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByTestId("content"));
    expect(ref.current).not.toBe(screen.getByRole("tooltip"));
  });

  it("className default (rounded-md, border, bg-popover, text-popover-foreground, shadow-md, z-[100]) diterapkan", async () => {
    await renderTooltip({
      rootProps: { defaultOpen: true },
      contentProps: { "data-testid": "content" },
    });

    const content = screen.getByTestId("content");
    expect(content.className).toContain("z-[100]");
    expect(content.className).toContain("overflow-hidden");
    expect(content.className).toContain("rounded-md");
    expect(content.className).toContain("border");
    expect(content.className).toContain("bg-popover");
    expect(content.className).toContain("text-popover-foreground");
    expect(content.className).toContain("shadow-md");
  });

  it("className custom digabung dengan className default, bukan menggantikan", async () => {
    await renderTooltip({
      rootProps: { defaultOpen: true },
      contentProps: {
        className: "custom-tooltip-class",
        "data-testid": "content",
      },
    });

    const content = screen.getByTestId("content");
    expect(content.className).toContain("custom-tooltip-class");
    expect(content.className).toContain("bg-popover");
  });

  it("sideOffset default maupun custom tidak menyebabkan error render", async () => {
    const { unmount } = await renderTooltip({
      rootProps: { defaultOpen: true },
      contentProps: { "data-testid": "content" },
    });
    expect(screen.getByTestId("content")).toBeInTheDocument();
    unmount();

    await renderTooltip({
      rootProps: { defaultOpen: true },
      contentProps: { sideOffset: 20, "data-testid": "content" },
    });
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("meneruskan props lain (mis. id) ke elemen Content", async () => {
    await renderTooltip({
      rootProps: { defaultOpen: true },
      contentProps: { id: "my-tooltip-content", "data-testid": "content" },
    });

    expect(screen.getByTestId("content")).toHaveAttribute(
      "id",
      "my-tooltip-content",
    );
  });

  it("content dirender via Portal ke document.body, bukan sbg descendant container render lokal", async () => {
    const { container } = await renderTooltip({
      rootProps: { defaultOpen: true },
      contentProps: { "data-testid": "content" },
    });

    const content = screen.getByTestId("content");
    expect(container.contains(content)).toBe(false);
    expect(document.body.contains(content)).toBe(true);
  });

  it("children dirender di content yang visible DAN diduplikasi di elemen role='tooltip' visually-hidden (accessible name)", async () => {
    await renderTooltip({
      rootProps: { defaultOpen: true },
      content: "Isi tooltip khusus",
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent("Isi tooltip khusus");
    expect(screen.getAllByText("Isi tooltip khusus")).toHaveLength(2);
  });
});
