import { describe, expect, it, vi } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TooltipProvider } from "@/Components/ui/tooltip";
import BlockDescriptionTooltip from "./BlockDescriptionTooltip";

// BlockDescriptionTooltip merender <Tooltip> Radix langsung, TANPA
// membungkus TooltipProvider sendiri (provider-nya disediakan sekali di
// resources/js/Layouts/MasterLayout.jsx utk seluruh app). Tanpa provider,
// Tooltip Radix melempar error "must be used within TooltipProvider" --
// helper render di sini selalu membungkusnya, delayDuration=0 (pola sama
// dgn tooltip.rtl.test.jsx & LinkModel.rtl.test.jsx).
const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>,
    );
  });
  return result;
};

const getTrigger = () => document.querySelector("span.inline-flex");

// BUG (lihat bugFindings): trigger dibungkus asChild dgn <span> polos TANPA
// tabIndex, jadi TIDAK BISA difokus keyboard -- satu-satunya jalur produksi
// utk membuka tooltip adalah hover pointer. Radix tetap menjadwalkan open
// lewat window.setTimeout ASLI meski delayDuration=0 (handleDelayedOpen),
// jadi fake timers + advanceTimersByTimeAsync dibutuhkan utk flush timer itu
// (pola sama dgn tooltip.rtl.test.jsx).
const openViaHover = async (trigger) => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({
    delay: null,
    advanceTimers: vi.advanceTimersByTime,
  });
  await user.hover(trigger);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  vi.useRealTimers();
};

describe("BlockDescriptionTooltip (tanpa deskripsi -- return null)", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["string kosong", ""],
    ["string whitespace saja", "   "],
    ["objek kosong", {}],
    ["objek dgn html kosong", { html: "" }],
    ["objek dgn html whitespace saja", { html: "   " }],
    ["objek tanpa field html (cuma json)", { json: { type: "doc" } }],
  ])(
    "tidak merender apapun (termasuk trigger) utk description %s",
    async (_label, description) => {
      const { container } = await render(
        <BlockDescriptionTooltip description={description} />,
      );

      expect(container.firstChild).toBeNull();
      expect(getTrigger()).toBeNull();
    },
  );
});

describe("BlockDescriptionTooltip (deskripsi string biasa -- data lama)", () => {
  it("merender trigger berisi ikon Info sbg <span>, bukan <button>", async () => {
    await render(<BlockDescriptionTooltip description="Deskripsi block" />);

    const trigger = getTrigger();
    expect(trigger).toBeInTheDocument();
    expect(trigger.tagName).toBe("SPAN");
    expect(trigger.querySelector("svg.lucide-info")).toBeInTheDocument();
  });

  it("className default trigger sesuai (inline-flex, size-4, items-center, justify-center, text-muted-foreground)", async () => {
    await render(<BlockDescriptionTooltip description="Deskripsi block" />);

    const trigger = getTrigger();
    expect(trigger.className).toContain("inline-flex");
    expect(trigger.className).toContain("size-4");
    expect(trigger.className).toContain("items-center");
    expect(trigger.className).toContain("justify-center");
    expect(trigger.className).toContain("text-muted-foreground");
  });

  it("ikon Info berukuran size-3.5 dan aria-hidden (dekoratif)", async () => {
    await render(<BlockDescriptionTooltip description="Deskripsi block" />);

    const icon = getTrigger().querySelector("svg.lucide-info");
    expect(icon.getAttribute("class")).toContain("size-3.5");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("tooltip belum ada di DOM sebelum trigger di-hover", async () => {
    await render(<BlockDescriptionTooltip description="Deskripsi block" />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hover trigger membuka tooltip berisi teks description apa adanya (tanpa wrapper .tiptap)", async () => {
    await render(<BlockDescriptionTooltip description="Deskripsi block" />);

    await openViaHover(getTrigger());

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Deskripsi block");
    expect(tooltip.querySelector(".tiptap")).not.toBeInTheDocument();
  });

  it("teks description dirender verbatim, whitespace di sekitarnya tidak di-trim", async () => {
    await render(<BlockDescriptionTooltip description="  Ada isi  " />);

    await openViaHover(getTrigger());

    expect(screen.getByRole("tooltip").textContent).toBe("  Ada isi  ");
  });
});

describe("BlockDescriptionTooltip (deskripsi objek { json, html } -- TiptapEditor)", () => {
  it("merender trigger yg sama dgn mode string (ikon Info)", async () => {
    await render(
      <BlockDescriptionTooltip description={{ html: "<p>Isi</p>" }} />,
    );

    expect(getTrigger().querySelector("svg.lucide-info")).toBeInTheDocument();
  });

  it("hover trigger membuka tooltip yg merender HTML lewat dangerouslySetInnerHTML di dalam div.tiptap.max-w-xs", async () => {
    await render(
      <BlockDescriptionTooltip
        description={{ html: "<p>Ini <strong>tebal</strong></p>" }}
      />,
    );

    await openViaHover(getTrigger());

    const tooltip = screen.getByRole("tooltip");
    const tiptapDiv = tooltip.querySelector(".tiptap");
    expect(tiptapDiv).toBeInTheDocument();
    expect(tiptapDiv.className).toContain("max-w-xs");
    expect(tiptapDiv.querySelector("strong")).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Ini tebal");
  });

  it("field json diabaikan sepenuhnya saat merender -- hanya html yg dipakai", async () => {
    await render(
      <BlockDescriptionTooltip
        description={{
          json: {
            type: "doc",
            content: [{ type: "text", text: "TIDAK dipakai" }],
          },
          html: "<p>Yang dipakai</p>",
        }}
      />,
    );

    await openViaHover(getTrigger());

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Yang dipakai");
    expect(tooltip).not.toHaveTextContent("TIDAK dipakai");
  });
});

describe("BlockDescriptionTooltip (aksesibilitas keyboard trigger)", () => {
  it("BUG (lihat bugFindings): trigger <span> tanpa tabIndex tidak menerima fokus keyboard, sehingga fokus TIDAK membuka tooltip", async () => {
    await render(<BlockDescriptionTooltip description="Deskripsi block" />);

    const trigger = getTrigger();
    expect(trigger).not.toHaveAttribute("tabindex");

    await act(async () => {
      trigger.focus();
    });

    expect(document.activeElement).not.toBe(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("BlockDescriptionTooltip (perubahan prop description)", () => {
  it("berganti dari null (tidak render apapun) ke string (trigger muncul) saat rerender", async () => {
    const { rerender, container } = await render(
      <BlockDescriptionTooltip description={null} />,
    );
    expect(container.firstChild).toBeNull();

    await act(async () => {
      rerender(
        <TooltipProvider delayDuration={0}>
          <BlockDescriptionTooltip description="Muncul sekarang" />
        </TooltipProvider>,
      );
    });

    expect(getTrigger()).toBeInTheDocument();
  });
});
