import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// GroupDropZone murni mengonsumsi return value hook `useDroppable`
// (setNodeRef, isOver) dari @dnd-kit/core -- isOver ditentukan oleh
// collision-detection INTERNAL dnd-kit selama drag pointer aktif, yang di
// jsdom rapuh/tidak praktis disimulasikan scr fisik (PointerSensor +
// activationConstraint distance butuh geometry nyata) -- pola sama persis
// dgn ColumnOrderPicker.rtl.test.jsx yg meng-capture closure asli alih2
// simulasi pointer. Di sini useDroppable di-mock LANGSUNG utk spy args &
// mengontrol return value, sementara render KOMPONEN tetap SUNGGUHAN
// (bukan source-assertion): yang diuji adalah pemetaan nyata
// {isOver, isActive, disabled} -> className & wiring id/disabled/
// setNodeRef ke hook, dibaca dari DOM hasil render betulan.
let droppableReturn;
let lastDroppableArgs;
vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual("@dnd-kit/core");
  return {
    ...actual,
    useDroppable: (args) => {
      lastDroppableArgs = args;
      return droppableReturn;
    },
  };
});

import GroupDropZone from "./GroupDropZone";

const setNodeRefSpy = vi.fn();

beforeEach(() => {
  setNodeRefSpy.mockReset();
  droppableReturn = { setNodeRef: setNodeRefSpy, isOver: false };
  lastDroppableArgs = undefined;
});

describe("GroupDropZone — render dasar & label", () => {
  it("merender label default 'Lepas di sini' saat prop label tidak diberikan", () => {
    render(<GroupDropZone dropZoneId="zone-1" />);

    expect(screen.getByText("Lepas di sini")).toBeInTheDocument();
  });

  it("merender label custom saat prop label diberikan", () => {
    render(<GroupDropZone dropZoneId="zone-1" label="Taruh grup di sini" />);

    expect(screen.getByText("Taruh grup di sini")).toBeInTheDocument();
    expect(screen.queryByText("Lepas di sini")).not.toBeInTheDocument();
  });
});

describe("GroupDropZone — wiring ke useDroppable", () => {
  it("memanggil useDroppable dgn id=dropZoneId & disabled sesuai prop", () => {
    render(<GroupDropZone dropZoneId="group-footer:42" disabled={false} />);

    expect(lastDroppableArgs).toEqual({
      id: "group-footer:42",
      disabled: false,
    });
  });

  it("memasang setNodeRef dari useDroppable ke elemen drop-zone", () => {
    render(<GroupDropZone dropZoneId="zone-1" isActive />);

    expect(setNodeRefSpy).toHaveBeenCalledTimes(1);
    expect(setNodeRefSpy.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
  });
});

describe("GroupDropZone — prop disabled", () => {
  it("disabled=true tidak merender apapun (return null), walau isActive/isOver true", () => {
    droppableReturn = { setNodeRef: setNodeRefSpy, isOver: true };

    const { container } = render(
      <GroupDropZone dropZoneId="zone-1" disabled isActive />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Lepas di sini")).not.toBeInTheDocument();
  });
});

describe("GroupDropZone — styling berdasar isActive & isOver", () => {
  it("isActive=false (default) -> class opacity-0 (visually hidden, tetap mounted di DOM utk dnd-kit)", () => {
    render(<GroupDropZone dropZoneId="zone-1" />);

    const zone = screen.getByText("Lepas di sini");
    expect(zone.className).toContain("opacity-0");
  });

  it("isActive=true & isOver=false -> tanpa opacity-0, styling default (border-border/60, text-muted-foreground)", () => {
    render(<GroupDropZone dropZoneId="zone-1" isActive />);

    const zone = screen.getByText("Lepas di sini");
    expect(zone.className).not.toContain("opacity-0");
    expect(zone.className).toContain("border-border/60");
    expect(zone.className).toContain("text-muted-foreground");
    expect(zone.className).not.toContain("border-primary");
  });

  it("isOver=true -> styling drop-target aktif (border-primary, bg-muted-foreground/20, text-foreground, scale-[1.02])", () => {
    droppableReturn = { setNodeRef: setNodeRefSpy, isOver: true };

    render(<GroupDropZone dropZoneId="zone-1" isActive />);

    const zone = screen.getByText("Lepas di sini");
    expect(zone.className).toContain("border-primary");
    expect(zone.className).toContain("bg-muted-foreground/20");
    expect(zone.className).toContain("text-foreground");
    expect(zone.className).toContain("scale-[1.02]");
    expect(zone.className).not.toContain("border-border/60");
    expect(zone.className).not.toContain("text-muted-foreground");
  });

  it("isOver=true tapi isActive=false -> tetap opacity-0 (drop-zone yg belum aktif tidak boleh terlihat, walau sedang di-hover dnd-kit)", () => {
    droppableReturn = { setNodeRef: setNodeRefSpy, isOver: true };

    render(<GroupDropZone dropZoneId="zone-1" />);

    const zone = screen.getByText("Lepas di sini");
    expect(zone.className).toContain("opacity-0");
    expect(zone.className).toContain("border-primary");
  });
});
