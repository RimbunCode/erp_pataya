import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import DashboardBlock from "./DashboardBlock";

// DashboardBlock murni router `switch(block.type)` -- tanggung jawabnya cuma
// pilih komponen DashboardBlocks/* yang benar & teruskan props apa adanya.
// Masing-masing komponen DashboardBlocks/* (ChartBlock, SectionBlock, dst)
// py concern sendiri (rendering internal, dialog edit, dll) yang seharusnya
// diuji di file test-nya sendiri -- di sini semua distub jadi placeholder
// yang menangkap props yang diterima, supaya test fokus murni ke logic
// routing & prop forwarding DashboardBlock, bukan re-test implementasi anak.
const captured = {};

vi.mock("@/Components/DashboardBlocks/ChartBlock", () => ({
  default: (props) => {
    captured.chart = props;
    return <div data-testid="stub-chart-block" />;
  },
}));
vi.mock("@/Components/DashboardBlocks/NumberCardBlock", () => ({
  default: (props) => {
    captured.card = props;
    return <div data-testid="stub-number-card-block" />;
  },
}));
vi.mock("@/Components/DashboardBlocks/QuickListBlock", () => ({
  default: (props) => {
    captured.quickList = props;
    return <div data-testid="stub-quick-list-block" />;
  },
}));
vi.mock("@/Components/DashboardBlocks/SectionBlock", () => ({
  default: (props) => {
    captured.section = props;
    return <div data-testid="stub-section-block" />;
  },
}));
vi.mock("@/Components/DashboardBlocks/ShortcutBlock", () => ({
  default: (props) => {
    captured.shortcut = props;
    return <div data-testid="stub-shortcut-block" />;
  },
}));
vi.mock("@/Components/DashboardBlocks/SpacerBlock", () => ({
  default: (props) => {
    captured.spacer = props;
    return <div data-testid="stub-spacer-block" />;
  },
}));
vi.mock("@/Components/DashboardBlocks/TextBlock", () => ({
  default: (props) => {
    captured.text = props;
    return <div data-testid="stub-text-block" />;
  },
}));
vi.mock("@/Components/DashboardBlocks/LinkCardBlock", () => ({
  default: (props) => {
    captured.linkCard = props;
    return <div data-testid="stub-link-card-block" />;
  },
}));

describe("DashboardBlock", () => {
  beforeEach(() => {
    for (const key of Object.keys(captured)) {
      delete captured[key];
    }
  });

  // Kumpulan props "lengkap" yang mungkin diteruskan DashboardCanvas --
  // dipakai berulang supaya tiap test tinggal cek props MANA yang benar2
  // diteruskan router ke block anak (bukan cuma nilainya benar).
  const makeCommonProps = () => ({
    canEdit: true,
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    isDragActive: false,
    activeDragType: "chart",
    depth: 2,
    editOpen: true,
    onEditOpenChange: vi.fn(),
    onEjectChild: vi.fn(),
  });

  it("type 'chart' merender ChartBlock dengan block, canEdit, onUpdate, onDelete, editOpen, onEditOpenChange -- TANPA depth/isDragActive/activeDragType/onEjectChild", () => {
    const block = { type: "chart", id: "c1" };
    const props = makeCommonProps();
    render(<DashboardBlock block={block} {...props} />);

    expect(screen.getByTestId("stub-chart-block")).toBeInTheDocument();
    expect(captured.chart).toEqual({
      block,
      canEdit: props.canEdit,
      onUpdate: props.onUpdate,
      onDelete: props.onDelete,
      editOpen: props.editOpen,
      onEditOpenChange: props.onEditOpenChange,
    });
  });

  it("type 'card' merender NumberCardBlock dengan set props yang sama seperti ChartBlock", () => {
    const block = { type: "card", id: "n1" };
    const props = makeCommonProps();
    render(<DashboardBlock block={block} {...props} />);

    expect(screen.getByTestId("stub-number-card-block")).toBeInTheDocument();
    expect(captured.card).toEqual({
      block,
      canEdit: props.canEdit,
      onUpdate: props.onUpdate,
      onDelete: props.onDelete,
      editOpen: props.editOpen,
      onEditOpenChange: props.onEditOpenChange,
    });
  });

  it("type 'text' merender TextBlock dengan set props dasar (bukan Section/LinkCard)", () => {
    const block = { type: "text", id: "t1" };
    const props = makeCommonProps();
    render(<DashboardBlock block={block} {...props} />);

    expect(screen.getByTestId("stub-text-block")).toBeInTheDocument();
    expect(captured.text).toEqual({
      block,
      canEdit: props.canEdit,
      onUpdate: props.onUpdate,
      onDelete: props.onDelete,
      editOpen: props.editOpen,
      onEditOpenChange: props.onEditOpenChange,
    });
  });

  it("type 'spacer' merender SpacerBlock dengan set props dasar", () => {
    const block = { type: "spacer", id: "s1" };
    const props = makeCommonProps();
    render(<DashboardBlock block={block} {...props} />);

    expect(screen.getByTestId("stub-spacer-block")).toBeInTheDocument();
    expect(captured.spacer).toEqual({
      block,
      canEdit: props.canEdit,
      onUpdate: props.onUpdate,
      onDelete: props.onDelete,
      editOpen: props.editOpen,
      onEditOpenChange: props.onEditOpenChange,
    });
  });

  it("type 'shortcut' merender ShortcutBlock dengan set props dasar", () => {
    const block = { type: "shortcut", id: "sc1" };
    const props = makeCommonProps();
    render(<DashboardBlock block={block} {...props} />);

    expect(screen.getByTestId("stub-shortcut-block")).toBeInTheDocument();
    expect(captured.shortcut).toEqual({
      block,
      canEdit: props.canEdit,
      onUpdate: props.onUpdate,
      onDelete: props.onDelete,
      editOpen: props.editOpen,
      onEditOpenChange: props.onEditOpenChange,
    });
  });

  it("type 'quick_list' merender QuickListBlock dengan set props dasar", () => {
    const block = { type: "quick_list", id: "q1" };
    const props = makeCommonProps();
    render(<DashboardBlock block={block} {...props} />);

    expect(screen.getByTestId("stub-quick-list-block")).toBeInTheDocument();
    expect(captured.quickList).toEqual({
      block,
      canEdit: props.canEdit,
      onUpdate: props.onUpdate,
      onDelete: props.onDelete,
      editOpen: props.editOpen,
      onEditOpenChange: props.onEditOpenChange,
    });
  });

  it("type 'section' merender SectionBlock dengan props tambahan depth/isDragActive/activeDragType/onEjectChild (satu-satunya block yang menerima onEjectChild)", () => {
    const block = { type: "section", id: "sec1" };
    const props = makeCommonProps();
    render(<DashboardBlock block={block} {...props} />);

    expect(screen.getByTestId("stub-section-block")).toBeInTheDocument();
    expect(captured.section).toEqual({
      block,
      canEdit: props.canEdit,
      onUpdate: props.onUpdate,
      onDelete: props.onDelete,
      depth: props.depth,
      isDragActive: props.isDragActive,
      activeDragType: props.activeDragType,
      onEjectChild: props.onEjectChild,
      editOpen: props.editOpen,
      onEditOpenChange: props.onEditOpenChange,
    });
  });

  it("type 'link_card' merender LinkCardBlock dengan isDragActive/activeDragType tapi TANPA depth/onEjectChild", () => {
    const block = { type: "link_card", id: "lc1" };
    const props = makeCommonProps();
    render(<DashboardBlock block={block} {...props} />);

    expect(screen.getByTestId("stub-link-card-block")).toBeInTheDocument();
    expect(captured.linkCard).toEqual({
      block,
      canEdit: props.canEdit,
      onUpdate: props.onUpdate,
      onDelete: props.onDelete,
      isDragActive: props.isDragActive,
      activeDragType: props.activeDragType,
      editOpen: props.editOpen,
      onEditOpenChange: props.onEditOpenChange,
    });
  });

  it("type 'link_card_item' merender div plain berisi block.config.label, tanpa memakai komponen DashboardBlocks manapun", () => {
    const block = { type: "link_card_item", config: { label: "Menu Item" } };
    const { container } = render(
      <DashboardBlock block={block} {...makeCommonProps()} />,
    );

    expect(screen.getByText("Menu Item")).toBeInTheDocument();
    const div = container.firstChild;
    expect(div.tagName).toBe("DIV");
    expect(div.className).toContain("rounded");
    expect(div.className).toContain("border");
    expect(div.className).toContain("p-2");
    expect(div.className).toContain("text-sm");
    // Tidak satupun stub komponen DashboardBlocks/* ikut ter-render.
    expect(captured).toEqual({});
  });

  it("type 'link_card_item' tanpa block.config -- tidak crash, div dirender tanpa teks label", () => {
    const block = { type: "link_card_item" };
    const { container } = render(
      <DashboardBlock block={block} {...makeCommonProps()} />,
    );

    const div = container.firstChild;
    expect(div).toBeInTheDocument();
    expect(div.textContent).toBe("");
  });

  it("type yang tidak dikenal me-return null -- tidak merender apapun & tidak crash", () => {
    const block = { type: "not_a_real_type" };
    const { container } = render(
      <DashboardBlock block={block} {...makeCommonProps()} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(captured).toEqual({});
  });
});
