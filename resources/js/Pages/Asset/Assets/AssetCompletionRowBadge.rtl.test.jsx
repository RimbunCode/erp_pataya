import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// CompleteDataDialog menarik banyak dependency berat (FormTable,
// AssetCategoryLinkModel, AssetLocationLinkModel, dst) yang tidak relevan
// untuk test wiring badge/tombol -- mock jadi stub yang merender props
// penting via data-testid, sama pola dengan mock dialog di test lain
// (mis. AssetLinkModel.rtl.test.jsx me-mock FormPageDialog).
const completeDataDialogSpy = vi.fn();
vi.mock("./CompleteDataDialog", () => ({
  default: (props) => {
    completeDataDialogSpy(props);
    return (
      <div data-testid="complete-data-dialog">
        <span data-testid="dialog-asset-id">{props.asset.id}</span>
        <button
          type="button"
          onClick={() => props.onOpenChange(false)}
          data-testid="dialog-close"
        >
          close
        </button>
      </div>
    );
  },
}));

import AssetCompletionRowBadge from "./AssetCompletionRowBadge";

const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(ui);
  });
  return result;
};

describe("AssetCompletionRowBadge", () => {
  beforeEach(() => {
    completeDataDialogSpy.mockClear();
  });

  it("tidak render apapun kalau tidak ada asset yang cocok dengan sourceItemId", async () => {
    const { container } = await render(
      <AssetCompletionRowBadge
        fixedAssets={[{ id: 1, purchase_receipt_item_id: 99 }]}
        sourceItemId={1}
        sourceItemIdKey="purchase_receipt_item_id"
        sourceDocumentType="PurchaseReceipt"
        sourceDocumentId={10}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("tidak render apapun kalau fixedAssets kosong/undefined", async () => {
    const { container } = await render(
      <AssetCompletionRowBadge
        fixedAssets={undefined}
        sourceItemId={1}
        sourceItemIdKey="purchase_receipt_item_id"
        sourceDocumentType="PurchaseReceipt"
        sourceDocumentId={10}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("tidak render apapun kalau asset cocok tapi sudah lengkap (category & location terisi)", async () => {
    const { container } = await render(
      <AssetCompletionRowBadge
        fixedAssets={[
          {
            id: 1,
            purchase_receipt_item_id: 99,
            asset_category_id: 5,
            asset_location_id: 7,
          },
        ]}
        sourceItemId={99}
        sourceItemIdKey="purchase_receipt_item_id"
        sourceDocumentType="PurchaseReceipt"
        sourceDocumentId={10}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("render badge+tombol kalau asset cocok tapi asset_category_id belum terisi", async () => {
    await render(
      <AssetCompletionRowBadge
        fixedAssets={[
          {
            id: 1,
            purchase_receipt_item_id: 99,
            asset_category_id: null,
            asset_location_id: 7,
          },
        ]}
        sourceItemId={99}
        sourceItemIdKey="purchase_receipt_item_id"
        sourceDocumentType="PurchaseReceipt"
        sourceDocumentId={10}
      />,
    );

    expect(
      screen.getByText("TR:asset.asset.needs_completion"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "TR:asset.asset.complete_now" }),
    ).toBeInTheDocument();
  });

  it("render badge+tombol kalau asset cocok tapi asset_location_id belum terisi", async () => {
    await render(
      <AssetCompletionRowBadge
        fixedAssets={[
          {
            id: 1,
            purchase_receipt_item_id: 99,
            asset_category_id: 5,
            asset_location_id: null,
          },
        ]}
        sourceItemId={99}
        sourceItemIdKey="purchase_receipt_item_id"
        sourceDocumentType="PurchaseReceipt"
        sourceDocumentId={10}
      />,
    );

    expect(
      screen.getByRole("button", { name: "TR:asset.asset.complete_now" }),
    ).toBeInTheDocument();
  });

  it("mencari asset berdasarkan sourceItemIdKey yang diberikan (bukan key lain)", async () => {
    const { container } = await render(
      <AssetCompletionRowBadge
        fixedAssets={[
          {
            id: 1,
            purchase_invoice_item_id: 99,
            purchase_receipt_item_id: 1,
            asset_category_id: null,
            asset_location_id: null,
          },
        ]}
        sourceItemId={99}
        sourceItemIdKey="purchase_receipt_item_id"
        sourceDocumentType="PurchaseInvoice"
        sourceDocumentId={20}
      />,
    );

    // sourceItemId 99 tidak match purchase_receipt_item_id (1) walau match
    // di key lain (purchase_invoice_item_id) -- lookup harus pakai key yang
    // diminta, bukan field lain yang kebetulan sama nilainya.
    expect(container).toBeEmptyDOMElement();
  });

  it("dialog tidak tampil sebelum tombol 'complete_now' diklik", async () => {
    await render(
      <AssetCompletionRowBadge
        fixedAssets={[
          {
            id: 1,
            purchase_receipt_item_id: 99,
            asset_category_id: null,
            asset_location_id: null,
          },
        ]}
        sourceItemId={99}
        sourceItemIdKey="purchase_receipt_item_id"
        sourceDocumentType="PurchaseReceipt"
        sourceDocumentId={10}
      />,
    );

    expect(
      screen.queryByTestId("complete-data-dialog"),
    ).not.toBeInTheDocument();
    expect(completeDataDialogSpy).not.toHaveBeenCalled();
  });

  it("klik tombol 'complete_now' membuka CompleteDataDialog dengan props asset & source yang benar", async () => {
    const user = userEvent.setup();
    const asset = {
      id: 42,
      purchase_receipt_item_id: 99,
      asset_category_id: null,
      asset_location_id: 7,
    };

    await render(
      <AssetCompletionRowBadge
        fixedAssets={[asset]}
        sourceItemId={99}
        sourceItemIdKey="purchase_receipt_item_id"
        sourceDocumentType="PurchaseReceipt"
        sourceDocumentId={10}
      />,
    );

    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: "TR:asset.asset.complete_now" }),
      );
    });

    expect(screen.getByTestId("complete-data-dialog")).toBeInTheDocument();
    expect(completeDataDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        asset,
        open: true,
        sourceDocumentType: "PurchaseReceipt",
        sourceDocumentId: 10,
      }),
    );
  });

  it("onOpenChange(false) dari dialog menutup kembali CompleteDataDialog", async () => {
    const user = userEvent.setup();
    const asset = {
      id: 42,
      purchase_receipt_item_id: 99,
      asset_category_id: null,
      asset_location_id: 7,
    };

    await render(
      <AssetCompletionRowBadge
        fixedAssets={[asset]}
        sourceItemId={99}
        sourceItemIdKey="purchase_receipt_item_id"
        sourceDocumentType="PurchaseReceipt"
        sourceDocumentId={10}
      />,
    );

    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: "TR:asset.asset.complete_now" }),
      );
    });
    expect(screen.getByTestId("complete-data-dialog")).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByTestId("dialog-close"));
    });

    expect(
      screen.queryByTestId("complete-data-dialog"),
    ).not.toBeInTheDocument();
  });
});
