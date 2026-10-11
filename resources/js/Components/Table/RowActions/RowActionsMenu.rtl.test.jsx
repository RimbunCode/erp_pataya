import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PencilIcon } from "lucide-react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (k, p) => (p ? `TR:${k}:${JSON.stringify(p)}` : `TR:${k}`),
  }),
}));

import RowActionsMenu from "./RowActionsMenu";

const row = { id: 1, status: "draft" };

const actions = [
  { key: "edit", label: "Edit", icon: PencilIcon, onAction: vi.fn() },
  { key: "hidden", label: "Hidden", enabled: () => false, onAction: vi.fn() },
  { key: "approve", label: "Approve", onAction: vi.fn() },
  {
    key: "remove",
    label: "Remove",
    variant: "destructive",
    onAction: vi.fn(),
  },
  {
    key: "purge",
    label: "Purge",
    variant: "destructive",
    onAction: vi.fn(),
  },
];

async function openMenu() {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "TR:core.datatable.row_actions" }),
  );
  return user;
}

describe("RowActionsMenu", () => {
  it("menampilkan item sesuai resolveRowActions dengan urutan terjaga", async () => {
    render(<RowActionsMenu row={row} actions={actions} onRun={vi.fn()} />);
    await openMenu();

    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Edit", "Approve", "Remove", "Purge"]);
  });

  it("separator hanya sebelum item destruktif pertama", async () => {
    render(<RowActionsMenu row={row} actions={actions} onRun={vi.fn()} />);
    await openMenu();

    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(1);
    const menu = screen.getByRole("menu");
    const children = [...menu.children];
    const sepIndex = children.indexOf(separators[0]);
    expect(children[sepIndex + 1]).toHaveTextContent("Remove");
    expect(children[sepIndex - 1]).toHaveTextContent("Approve");
  });

  it("tanpa separator bila destruktif adalah item pertama", async () => {
    render(
      <RowActionsMenu
        row={row}
        actions={[actions[3], actions[4]]}
        onRun={vi.fn()}
      />,
    );
    await openMenu();

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });

  it("klik item memanggil onRun(action, [row])", async () => {
    const onRun = vi.fn();
    render(<RowActionsMenu row={row} actions={actions} onRun={onRun} />);
    const user = await openMenu();

    await user.click(screen.getByRole("menuitem", { name: "Approve" }));

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0][0].key).toBe("approve");
    expect(onRun.mock.calls[0][1]).toEqual([row]);
  });

  it("item destruktif memakai kelas text-destructive", async () => {
    render(<RowActionsMenu row={row} actions={actions} onRun={vi.fn()} />);
    await openMenu();

    expect(screen.getByRole("menuitem", { name: "Remove" })).toHaveClass(
      "text-destructive",
    );
    expect(screen.getByRole("menuitem", { name: "Edit" })).not.toHaveClass(
      "text-destructive",
    );
  });

  it("klik trigger tidak mem-bubble ke pemilik baris", async () => {
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <RowActionsMenu row={row} actions={actions} onRun={vi.fn()} />
      </div>,
    );
    await openMenu();

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("render null bila tidak ada aksi yang lolos", () => {
    const { container } = render(
      <RowActionsMenu
        row={row}
        actions={[actions[1], { key: "b", label: "B", single: false }]}
        onRun={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
