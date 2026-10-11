import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ============================================================================
// AssetItemsSection (spec asset-items-section, Requirement 1.1-1.4) hanyalah
// wrapper tipis di atas FormPageContent + FormPageContentDescription. Tanpa
// Tabs/context FormPage asli, FormPageContent distub agar test HANYA memeriksa
// kontrak yang dikirim wrapper: collapsible, defaultOpen dari `hasRows`, title
// dan description i18n, serta children diteruskan. Perilaku buka/tutup asli
// FormPageContent sudah punya test sendiri dan diverifikasi di browser.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const captured = {};
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: (props) => {
    captured.props = props;
    return (
      <section data-testid="form-page-content">
        <h3>{props.title}</h3>
        {props.children}
      </section>
    );
  },
  FormPageContentDescription: ({ children }) => (
    <p data-testid="description">{children}</p>
  ),
}));

import AssetItemsSection from "./AssetItemsSection";

describe("AssetItemsSection", () => {
  beforeEach(() => {
    captured.props = undefined;
  });

  it("dirender sebagai section collapsible di tab detail", () => {
    render(
      <AssetItemsSection>
        <div>isi</div>
      </AssetItemsSection>,
    );

    expect(captured.props.collapsible).toBe(true);
    expect(captured.props.value).toBe("detail");
  });

  it("tertutup secara default (dokumen belum punya baris aset)", () => {
    render(
      <AssetItemsSection>
        <div>isi</div>
      </AssetItemsSection>,
    );

    expect(captured.props.defaultOpen).toBe(false);
  });

  it("tertutup saat hasRows false", () => {
    render(
      <AssetItemsSection hasRows={false}>
        <div>isi</div>
      </AssetItemsSection>,
    );

    expect(captured.props.defaultOpen).toBe(false);
  });

  it("terbuka otomatis saat dokumen sudah punya baris aset", () => {
    render(
      <AssetItemsSection hasRows>
        <div>isi</div>
      </AssetItemsSection>,
    );

    expect(captured.props.defaultOpen).toBe(true);
  });

  it("menampilkan title dan description dari i18n", () => {
    render(
      <AssetItemsSection>
        <div>isi</div>
      </AssetItemsSection>,
    );

    expect(
      screen.getByRole("heading", { name: "asset.assetItems.title" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("description")).toHaveTextContent(
      "asset.assetItems.description",
    );
  });

  it("meneruskan children (FormTable Asset Items) ke dalam section", () => {
    render(
      <AssetItemsSection hasRows>
        <div data-testid="asset-table">tabel aset</div>
      </AssetItemsSection>,
    );

    expect(screen.getByTestId("form-page-content")).toContainElement(
      screen.getByTestId("asset-table"),
    );
  });
});
