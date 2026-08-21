import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

let formPageSeed = {};
let formPageDisabled = false;
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: () => {
      const [data, setDataState] = React.useState(formPageSeed);
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      return { data, setData, disabled: formPageDisabled };
    },
    FormPageContent: ({ children }) => <div>{children}</div>,
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

const captured = {};
vi.mock("@/Components/FormTable", () => ({
  default: (props) => {
    captured.formTableProps = props;
    return (
      <div data-testid="stub-form-table" data-readonly={props.readOnly ? "true" : "false"}>
        {(props.value ?? []).map((row, i) => (
          <div key={row.id ?? i} data-testid="row">
            {row.task_name}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("@/Pages/Asset/Assets/AssetLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="asset-link-model"
      onClick={() => onValueChange({ id: 1, name: "Mesin A" })}
    >
      asset:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Asset/MaintenanceTeams/AssetMaintenanceTeamLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="maintenance-team-link-model"
      onClick={() => onValueChange({ id: 2, name: "Tim B" })}
    >
      team:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Users/ManageUsers/UserLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="user-link-model"
      onClick={() => onValueChange({ id: 3, name: "User C" })}
    >
      user:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Components/Link", () => ({
  default: ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

window.route = (name, id) => `/${name}/${id}`;

import Show from "./Show";

describe("Asset Maintenances Show", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageDisabled = false;
    captured.formTableProps = undefined;
  });

  it("memilih asset via AssetLinkModel memanggil setData('asset', ...)", () => {
    formPageSeed = { asset: null };
    render(<Show />);

    fireEvent.click(screen.getByTestId("asset-link-model"));

    expect(screen.getByTestId("asset-link-model")).toHaveTextContent(
      "asset:Mesin A",
    );
  });

  it("memilih maintenanceTeam via AssetMaintenanceTeamLinkModel memanggil setData", () => {
    formPageSeed = { maintenanceTeam: null };
    render(<Show />);

    fireEvent.click(screen.getByTestId("maintenance-team-link-model"));

    expect(screen.getByTestId("maintenance-team-link-model")).toHaveTextContent(
      "team:Tim B",
    );
  });

  it("FormTable menerima readOnly sesuai disabled dari useFormPage", () => {
    formPageDisabled = true;
    render(<Show />);

    expect(screen.getByTestId("stub-form-table")).toHaveAttribute(
      "data-readonly",
      "true",
    );
  });

  it("mapItem FormTable mempertahankan id existing dan generate id baru untuk baris tanpa id", () => {
    render(<Show />);

    const { mapItem } = captured.formTableProps;
    expect(mapItem({ item: { id: 99, task_name: "Existing" } }).id).toBe(99);

    const generated = mapItem({ item: { task_name: "New" } });
    expect(generated.id).toBeTruthy();
    expect(generated.id).not.toBe(99);
  });

  it("kolom task_name cell memanggil setData dengan value input", () => {
    render(<Show />);

    const column = captured.formTableProps.columns.find(
      (c) => c.name === "task_name",
    );
    const setDataCell = vi.fn();
    render(
      column.cell({ data: "Ganti oli", setData: setDataCell, attributes: {} }),
    );

    const input = screen.getByDisplayValue("Ganti oli");
    fireEvent.change(input, { target: { value: "Ganti filter" } });

    expect(setDataCell).toHaveBeenCalledWith("Ganti filter");
  });

  it("kolom periodicity cell mengubah value menjadi Number saat onChange", () => {
    render(<Show />);

    const column = captured.formTableProps.columns.find(
      (c) => c.name === "periodicity",
    );
    const setDataCell = vi.fn();
    render(
      column.cell({ data: 30, setData: setDataCell, attributes: {} }),
    );

    const input = screen.getByDisplayValue("30");
    fireEvent.change(input, { target: { value: "60" } });

    expect(setDataCell).toHaveBeenCalledWith(60);
  });

  it("kolom next_due_date cell menampilkan value sebagai teks read-only", () => {
    render(<Show />);

    const column = captured.formTableProps.columns.find(
      (c) => c.name === "next_due_date",
    );
    render(column.cell({ data: "2026-09-01" }));

    expect(screen.getByText("2026-09-01")).toBeInTheDocument();
  });

  it("kolom assign_to cell memanggil setData('assign_to', ...) via UserLinkModel", () => {
    render(<Show />);

    const column = captured.formTableProps.columns.find(
      (c) => c.name === "assign_to",
    );
    const setDataCell = vi.fn();
    render(
      column.cell({ data: null, setData: setDataCell, attributes: {} }),
    );

    fireEvent.click(screen.getByTestId("user-link-model"));

    expect(setDataCell).toHaveBeenCalledWith("assign_to", { id: 3, name: "User C" });
  });

  it("tidak menampilkan blok service saat semua task tidak punya services", () => {
    formPageSeed = {
      tasks: [{ id: 1, task_name: "A", services: [] }],
    };
    render(<Show />);

    expect(screen.queryByText("asset.service.title")).not.toBeInTheDocument();
  });

  it("menampilkan blok service ter-flatten dari seluruh task saat ada service", () => {
    formPageSeed = {
      tasks: [
        {
          id: 1,
          task_name: "A",
          services: [{ id: 10, code: "SRV-001", status: ["open"] }],
        },
        {
          id: 2,
          task_name: "B",
          services: [{ id: 11, code: "SRV-002", status: ["done", "closed"] }],
        },
      ],
    };
    render(<Show />);

    expect(screen.getByText("asset.service.title")).toBeInTheDocument();
    expect(screen.getByText("SRV-001")).toBeInTheDocument();
    expect(screen.getByText("SRV-002")).toBeInTheDocument();
    expect(screen.getByText("status.done, status.closed")).toBeInTheDocument();
  });

  it("link service mengarah ke route assetServices.show dengan id service", () => {
    formPageSeed = {
      tasks: [
        { id: 1, task_name: "A", services: [{ id: 10, code: "SRV-001", status: [] }] },
      ],
    };
    render(<Show />);

    expect(screen.getByText("SRV-001").closest("a")).toHaveAttribute(
      "href",
      "/assetServices.show/10",
    );
  });
});
