import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RunningText, RunningTextContent } from "./running-text";

describe("RunningText", () => {
  it("render children tanpa crash sebagai elemen <div> dengan className dasar 'running-text'", () => {
    render(<RunningText>Judul Kolom</RunningText>);
    const wrapper = screen.getByText("Judul Kolom");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toContain("running-text");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<RunningText className="w-full">Konten</RunningText>);
    const wrapper = screen.getByText("Konten");
    expect(wrapper.className).toContain("running-text");
    expect(wrapper.className).toContain("w-full");
  });

  it("forwardRef meneruskan ref ke elemen <div> asli", () => {
    const ref = createRef();
    render(<RunningText ref={ref}>Ref</RunningText>);
    expect(ref.current).toBe(screen.getByText("Ref"));
    expect(ref.current.tagName).toBe("DIV");
  });

  it("meneruskan props HTML lain (data-testid, onClick, id) ke elemen div", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <RunningText
        data-testid="running-text"
        id="running-text-1"
        onClick={() => {
          clicked = true;
        }}
      >
        Klik
      </RunningText>,
    );

    const wrapper = screen.getByTestId("running-text");
    expect(wrapper).toHaveAttribute("id", "running-text-1");

    await user.click(wrapper);
    expect(clicked).toBe(true);
  });

  it("asChild me-render child aslinya (mis. <span>) alih-alih <div>, sambil menggabungkan className wrapper", () => {
    render(
      <RunningText asChild className="w-full">
        <span data-testid="child-span">Konten asli</span>
      </RunningText>,
    );

    const child = screen.getByTestId("child-span");
    expect(child.tagName).toBe("SPAN");
    expect(child.className).toContain("running-text");
    expect(child.className).toContain("w-full");
  });

  it("asChild meneruskan ref ke elemen child asli", () => {
    const ref = createRef();
    render(
      <RunningText asChild ref={ref}>
        <span data-testid="child-span">Konten asli</span>
      </RunningText>,
    );
    expect(ref.current).toBe(screen.getByTestId("child-span"));
    expect(ref.current.tagName).toBe("SPAN");
  });
});

describe("RunningTextContent", () => {
  it("render text di dalam struktur span bertingkat dengan className dasar 'running-text-track gap-8'", () => {
    render(<RunningTextContent text="Nama Kolom" />);
    const textNode = screen.getByText("Nama Kolom");
    expect(textNode).toBeInTheDocument();
    expect(textNode.tagName).toBe("SPAN");

    const track = textNode.parentElement;
    expect(track.tagName).toBe("SPAN");
    expect(track.className).toContain("running-text-track");
    expect(track.className).toContain("gap-8");
  });

  it("className custom digabung dengan className default (bukan menggantikan)", () => {
    render(<RunningTextContent text="Nama Kolom" className="custom-class" />);
    const track = screen.getByText("Nama Kolom").parentElement;
    expect(track.className).toContain("custom-class");
    expect(track.className).toContain("running-text-track");
  });
});
