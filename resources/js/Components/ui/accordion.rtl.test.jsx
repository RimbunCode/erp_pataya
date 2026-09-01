import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  AccordionTriggerCustom,
} from "./accordion";

describe("Accordion + AccordionItem + AccordionTrigger + AccordionContent", () => {
  it("content tidak berada di DOM saat tertutup, muncul setelah trigger diklik", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Judul Item</AccordionTrigger>
          <AccordionContent>Isi konten</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger = screen.getByRole("button", { name: "Judul Item" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Isi konten")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Isi konten")).toBeInTheDocument();
  });
});

describe("AccordionItem", () => {
  it("meneruskan ref ke elemen DOM asli", () => {
    const ref = createRef();
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" ref={ref}>
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it("className default border-b tetap ada saat className custom ditambahkan", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem
          value="item-1"
          className="custom-item"
          data-testid="item"
        >
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const item = screen.getByTestId("item");
    expect(item.className).toContain("border-b");
    expect(item.className).toContain("custom-item");
  });
});

describe("AccordionTrigger", () => {
  it("meneruskan ref ke elemen button asli", () => {
    const ref = createRef();
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger ref={ref}>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("render icon ChevronDown di dalam trigger", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(trigger.querySelector("svg")).toBeInTheDocument();
  });

  it("meneruskan className custom tanpa menghapus className default", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger className="custom-trigger">
            Trigger
          </AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(trigger.className).toContain("custom-trigger");
    expect(trigger.className).toContain("justify-between");
  });

  it("tanpa prop asChild: className mengandung justify-between & selector rotate chevron", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(trigger.className).toContain("justify-between");
    expect(trigger.className).toContain("[&[data-state=open]>svg]:rotate-180");
  });

  it("dengan prop asChild=true: className justify-between & rotate chevron dihilangkan, dan prop asChild TIDAK diteruskan sbg atribut DOM", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger asChild>Trigger</AccordionTrigger>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(trigger.className).not.toContain("justify-between");
    expect(trigger.className).not.toContain(
      "[&[data-state=open]>svg]:rotate-180",
    );
    expect(trigger).not.toHaveAttribute("aschild");
    // ChevronDown tetap dirender walau asChild=true (bukan diteruskan ke
    // Radix Slot untuk composition sungguhan -- hanya dipakai sbg toggle
    // className lokal di wrapper ini).
    expect(trigger.querySelector("svg")).toBeInTheDocument();
  });
});

describe("AccordionTriggerCustom", () => {
  it("render tanpa icon ChevronDown (beda dari AccordionTrigger biasa)", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTriggerCustom>Trigger Custom</AccordionTriggerCustom>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger Custom" });
    expect(trigger.querySelector("svg")).not.toBeInTheDocument();
  });

  it("meneruskan ref ke elemen button asli", () => {
    const ref = createRef();
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTriggerCustom ref={ref}>Trigger</AccordionTriggerCustom>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("meneruskan className custom tanpa menghapus className default", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTriggerCustom className="custom-trigger-custom">
            Trigger
          </AccordionTriggerCustom>
          <AccordionContent>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(trigger.className).toContain("custom-trigger-custom");
    expect(trigger.className).toContain("hover:underline");
  });

  it("klik trigger custom tetap membuka content (interaksi accordion tetap berfungsi)", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTriggerCustom>Trigger Custom</AccordionTriggerCustom>
          <AccordionContent>Isi konten custom</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole("button", { name: "Trigger Custom" });

    await user.click(trigger);

    expect(screen.getByText("Isi konten custom")).toBeInTheDocument();
  });
});

describe("AccordionContent", () => {
  it("meneruskan ref ke elemen DOM asli", () => {
    const ref = createRef();
    render(
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent ref={ref}>Content</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it("meneruskan className custom tanpa menghapus className default (pb-4)", () => {
    render(
      <Accordion type="single" collapsible defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Trigger</AccordionTrigger>
          <AccordionContent className="custom-content" data-testid="content">
            Isi
          </AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const content = screen.getByTestId("content");
    expect(content.className).toContain("custom-content");
    expect(content.className).toContain("pb-4");
  });
});
