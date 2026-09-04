import { describe, expect, it, vi } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

// CompleteDataDialog.jsx menarik dependency berat (FormTable,
// AssetCategoryLinkModel, AssetLocationLinkModel, NumberInput, router
// @inertiajs/react) yang tidak relevan untuk wiring AssetCompletionAlert --
// stub sederhana yang mengekspos props yang diterima supaya test bisa
// memverifikasi asset/open/sourceDocumentType/sourceDocumentId yang benar
// diteruskan, dan onOpenChange(false) bisa dipicu utk menutup dialog.
vi.mock("./CompleteDataDialog", () => ({
  default: ({
    asset,
    open,
    onOpenChange,
    sourceDocumentType,
    sourceDocumentId,
  }) => (
    <div data-testid="complete-data-dialog">
      <span data-testid="dialog-asset-id">{asset?.id}</span>
      <span data-testid="dialog-open">{String(open)}</span>
      <span data-testid="dialog-source-type">{sourceDocumentType}</span>
      <span data-testid="dialog-source-id">{sourceDocumentId}</span>
      <button onClick={() => onOpenChange(false)}>close-dialog</button>
    </div>
  ),
}));

import AssetCompletionAlert from "./AssetCompletionAlert";

const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(ui);
  });
  return result;
};

describe("AssetCompletionAlert", () => {
  it("return null (tidak render apapun) kalau assets undefined", async () => {
    const { container } = await render(<AssetCompletionAlert />);
    expect(container).toBeEmptyDOMElement();
  });

  it("return null (tidak render apapun) kalau assets array kosong", async () => {
    const { container } = await render(<AssetCompletionAlert assets={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("render alert incomplete utk asset tanpa asset_category_id maupun asset_location_id", async () => {
    await render(
      <AssetCompletionAlert
        assets={[
          {
            id: 1,
            asset_name: "Laptop Dell",
            code: "AST-001",
            asset_category_id: null,
            asset_location_id: null,
          },
        ]}
      />,
    );

    expect(
      screen.getByText('TR:asset.asset.incomplete_assets_title:{"count":1}'),
    ).toBeInTheDocument();
    expect(screen.getByText("Laptop Dell (AST-001)")).toBeInTheDocument();
    expect(
      screen.getByText("TR:asset.asset.needs_completion"),
    ).toBeInTheDocument();
    // Tidak ada alert "complete" saat semua asset incomplete. Regex diawali
    // `^` supaya tidak ikut match "incomplete_assets_title" (substring).
    expect(
      screen.queryByText(/^TR:asset\.asset\.complete_assets_title/),
    ).not.toBeInTheDocument();
  });

  it("asset dgn hanya asset_category_id (tanpa location) tetap dianggap incomplete", async () => {
    await render(
      <AssetCompletionAlert
        assets={[
          {
            id: 2,
            asset_name: "Printer HP",
            code: "AST-002",
            asset_category_id: 10,
            asset_location_id: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Printer HP (AST-002)")).toBeInTheDocument();
    expect(
      screen.getByText('TR:asset.asset.incomplete_assets_title:{"count":1}'),
    ).toBeInTheDocument();
  });

  it("asset dgn hanya asset_location_id (tanpa category) tetap dianggap incomplete", async () => {
    await render(
      <AssetCompletionAlert
        assets={[
          {
            id: 3,
            asset_name: "Forklift",
            code: "AST-003",
            asset_category_id: null,
            asset_location_id: 20,
          },
        ]}
      />,
    );

    expect(screen.getByText("Forklift (AST-003)")).toBeInTheDocument();
    expect(
      screen.getByText('TR:asset.asset.incomplete_assets_title:{"count":1}'),
    ).toBeInTheDocument();
  });

  it("render alert complete (hijau) utk asset dgn category & location lengkap", async () => {
    await render(
      <AssetCompletionAlert
        assets={[
          {
            id: 4,
            asset_name: "Mesin Jahit",
            code: "AST-004",
            asset_category_id: 10,
            asset_location_id: 20,
          },
        ]}
      />,
    );

    expect(
      screen.getByText('TR:asset.asset.complete_assets_title:{"count":1}'),
    ).toBeInTheDocument();
    // Alert complete tidak mendaftar nama asset satu-satu (cuma AlertTitle).
    expect(screen.queryByText("Mesin Jahit (AST-004)")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/incomplete_assets_title/),
    ).not.toBeInTheDocument();
  });

  it("render kedua alert (incomplete & complete) sekaligus utk campuran asset", async () => {
    await render(
      <AssetCompletionAlert
        assets={[
          {
            id: 1,
            asset_name: "Laptop Dell",
            code: "AST-001",
            asset_category_id: null,
            asset_location_id: null,
          },
          {
            id: 4,
            asset_name: "Mesin Jahit",
            code: "AST-004",
            asset_category_id: 10,
            asset_location_id: 20,
          },
        ]}
      />,
    );

    expect(
      screen.getByText('TR:asset.asset.incomplete_assets_title:{"count":1}'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('TR:asset.asset.complete_assets_title:{"count":1}'),
    ).toBeInTheDocument();
  });

  it("dialog CompleteDataDialog tidak dirender sebelum tombol complete_now diklik", async () => {
    await render(
      <AssetCompletionAlert
        assets={[
          {
            id: 1,
            asset_name: "Laptop Dell",
            code: "AST-001",
            asset_category_id: null,
            asset_location_id: null,
          },
        ]}
      />,
    );

    expect(
      screen.queryByTestId("complete-data-dialog"),
    ).not.toBeInTheDocument();
  });

  it("klik complete_now membuka CompleteDataDialog dgn asset, sourceDocumentType & sourceDocumentId yg benar", async () => {
    const user = userEvent.setup({ delay: null });
    await render(
      <AssetCompletionAlert
        assets={[
          {
            id: 7,
            asset_name: "Laptop Dell",
            code: "AST-001",
            asset_category_id: null,
            asset_location_id: null,
          },
        ]}
        sourceDocumentType="PurchaseReceipt"
        sourceDocumentId={99}
      />,
    );

    await act(async () => {
      await user.click(screen.getByText("TR:asset.asset.complete_now"));
    });

    expect(screen.getByTestId("complete-data-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-asset-id")).toHaveTextContent("7");
    expect(screen.getByTestId("dialog-open")).toHaveTextContent("true");
    expect(screen.getByTestId("dialog-source-type")).toHaveTextContent(
      "PurchaseReceipt",
    );
    expect(screen.getByTestId("dialog-source-id")).toHaveTextContent("99");
  });

  it("menutup dialog (onOpenChange(false)) menghapus CompleteDataDialog dari DOM", async () => {
    const user = userEvent.setup({ delay: null });
    await render(
      <AssetCompletionAlert
        assets={[
          {
            id: 7,
            asset_name: "Laptop Dell",
            code: "AST-001",
            asset_category_id: null,
            asset_location_id: null,
          },
        ]}
      />,
    );

    await act(async () => {
      await user.click(screen.getByText("TR:asset.asset.complete_now"));
    });
    expect(screen.getByTestId("complete-data-dialog")).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByText("close-dialog"));
    });
    expect(
      screen.queryByTestId("complete-data-dialog"),
    ).not.toBeInTheDocument();
  });

  it("hanya satu dialog terbuka sekaligus -- klik complete_now asset lain memindahkan dialog (bukan menambah)", async () => {
    // openAssetId adalah single state, bukan Set -- membuka dialog asset
    // kedua otomatis menutup dialog asset pertama (tidak ada guard/warning
    // dari perilaku ini, hanya konsekuensi desain state tunggal).
    const user = userEvent.setup({ delay: null });
    await render(
      <AssetCompletionAlert
        assets={[
          {
            id: 1,
            asset_name: "Laptop Dell",
            code: "AST-001",
            asset_category_id: null,
            asset_location_id: null,
          },
          {
            id: 2,
            asset_name: "Printer HP",
            code: "AST-002",
            asset_category_id: null,
            asset_location_id: null,
          },
        ]}
      />,
    );

    const completeNowButtons = screen.getAllByText(
      "TR:asset.asset.complete_now",
    );
    expect(completeNowButtons).toHaveLength(2);

    await act(async () => {
      await user.click(completeNowButtons[0]);
    });
    expect(screen.getByTestId("dialog-asset-id")).toHaveTextContent("1");
    expect(screen.getAllByTestId("complete-data-dialog")).toHaveLength(1);

    await act(async () => {
      await user.click(completeNowButtons[1]);
    });
    expect(screen.getByTestId("dialog-asset-id")).toHaveTextContent("2");
    expect(screen.getAllByTestId("complete-data-dialog")).toHaveLength(1);
  });
});
