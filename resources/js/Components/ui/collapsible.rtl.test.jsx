import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

describe("Collapsible + CollapsibleTrigger + CollapsibleContent", () => {
  it("content tidak berada di DOM saat tertutup, muncul setelah trigger diklik", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Isi konten</CollapsibleContent>
      </Collapsible>,
    );

    const trigger = screen.getByRole("button", { name: "Toggle" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Isi konten")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Isi konten")).toBeInTheDocument();
  });

  it("defaultOpen=true merender content sejak awal", () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Isi konten default terbuka</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.getByText("Isi konten default terbuka")).toBeInTheDocument();
  });

  it("mode controlled: prop open & onOpenChange diteruskan dgn benar ke Radix Root", async () => {
    const user = userEvent.setup({ delay: null });
    const handleOpenChange = vi.fn();

    function ControlledWrapper() {
      const [open, setOpen] = useState(false);
      return (
        <Collapsible
          open={open}
          onOpenChange={(next) => {
            handleOpenChange(next);
            setOpen(next);
          }}
        >
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Isi konten controlled</CollapsibleContent>
        </Collapsible>
      );
    }

    render(<ControlledWrapper />);
    const trigger = screen.getByRole("button", { name: "Toggle" });
    expect(screen.queryByText("Isi konten controlled")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(handleOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByText("Isi konten controlled")).toBeInTheDocument();
  });
});

describe("Collapsible", () => {
  it('root element memiliki atribut data-slot="collapsible"', () => {
    render(
      <Collapsible data-testid="root">
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Isi</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.getByTestId("root")).toHaveAttribute(
      "data-slot",
      "collapsible",
    );
  });
});

describe("CollapsibleTrigger", () => {
  it('elemen trigger memiliki atribut data-slot="collapsible-trigger"', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Isi</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.getByRole("button", { name: "Toggle" })).toHaveAttribute(
      "data-slot",
      "collapsible-trigger",
    );
  });

  it("className custom diteruskan apa adanya (trigger tidak menambahkan className default)", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger className="custom-trigger">
          Toggle
        </CollapsibleTrigger>
        <CollapsibleContent>Isi</CollapsibleContent>
      </Collapsible>,
    );
    const trigger = screen.getByRole("button", { name: "Toggle" });
    expect(trigger.className).toBe("custom-trigger");
  });

  it("prop asChild merender elemen child asli, bukan <button> pembungkus", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger asChild>
          <a href="#detail">Buka Detail</a>
        </CollapsibleTrigger>
        <CollapsibleContent>Isi</CollapsibleContent>
      </Collapsible>,
    );
    const trigger = screen.getByRole("link", { name: "Buka Detail" });
    expect(trigger.tagName).toBe("A");
    expect(trigger).toHaveAttribute("data-slot", "collapsible-trigger");
  });
});

describe("CollapsibleContent", () => {
  it('elemen content memiliki atribut data-slot="collapsible-content" & className default overflow-hidden', () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent data-testid="content">Isi</CollapsibleContent>
      </Collapsible>,
    );
    const content = screen.getByTestId("content");
    expect(content).toHaveAttribute("data-slot", "collapsible-content");
    expect(content.className).toContain("overflow-hidden");
    expect(content.className).toContain("transition-all");
  });

  it("className custom digabung (bukan menggantikan) className default", () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent className="custom-content" data-testid="content">
          Isi
        </CollapsibleContent>
      </Collapsible>,
    );
    const content = screen.getByTestId("content");
    expect(content.className).toContain("custom-content");
    expect(content.className).toContain("overflow-hidden");
  });

  it("className mengandung selector data-[state] utk animasi buka/tutup", () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent data-testid="content">Isi</CollapsibleContent>
      </Collapsible>,
    );
    const content = screen.getByTestId("content");
    expect(content.className).toContain(
      "data-[state=closed]:animate-collapsible-up",
    );
    expect(content.className).toContain(
      "data-[state=open]:animate-collapsible-down",
    );
  });
});
