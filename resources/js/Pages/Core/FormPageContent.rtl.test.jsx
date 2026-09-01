import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tabs } from "@/Components/ui/tabs";

// FormPageContentTitle & FormPageContentDescription tidak diexport dari
// FormPage.jsx -- keduanya adalah implementation detail internal yang selalu
// dipakai lewat FormPageContent. Test ini memverifikasi kontrak visual
// mereka (role="title"/"description", class) secara TIDAK LANGSUNG lewat
// FormPageContent, karena itulah satu-satunya cara publik mereka bisa
// dirender.
import { FormPageContent, FormPageContext } from "./FormPage";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

function makeContextValue(overrides = {}) {
  const menus = overrides.menus ?? [
    { id: "m1", title: "Detail", value: "detail" },
  ];
  return {
    menus,
    addMenu: vi.fn(),
    removeMenu: vi.fn(),
    menuSelected: overrides.menuSelected ?? menus?.[0]?.value,
    firstIds: overrides.firstIds ?? new Set(),
    isSingle: overrides.isSingle ?? menus.length <= 1,
  };
}

// FormPageContent merender <TabsContent> yang butuh ancestor <Tabs> (Radix)
// agar tidak warning/crash. defaultValue disamakan dengan value konten yang
// diuji supaya konten aktif ter-render (Radix TabsContent hanya me-mount
// panel yang value-nya match tab aktif).
function renderContent(ui, { contextValue, tabsValue = "detail" } = {}) {
  const ctx = contextValue ?? makeContextValue();
  return render(
    <FormPageContext.Provider value={ctx}>
      <Tabs value={tabsValue}>{ui}</Tabs>
    </FormPageContext.Provider>,
  );
}

describe("FormPageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender title default (dari prop title) dengan role=title", () => {
    renderContent(
      <FormPageContent value="detail" title="Informasi Utama">
        <p>Isi konten</p>
      </FormPageContent>,
    );

    const title = screen.getByRole("title");
    expect(title).toHaveTextContent("Informasi Utama");
    expect(title).toHaveClass("font-bold", "text-lg");
    expect(screen.getByText("Isi konten")).toBeInTheDocument();
  });

  it("fallback ke value sebagai title kalau title tidak diberikan tapi collapsible=true", () => {
    renderContent(
      <FormPageContent value="detail" collapsible defaultOpen>
        <p>Konten collapsible</p>
      </FormPageContent>,
    );

    expect(screen.getByRole("title")).toHaveTextContent("detail");
  });

  it("tanpa title/collapsible/actions dan tanpa header children, tidak render section header (langsung children)", () => {
    renderContent(
      <FormPageContent value="detail">
        <p>Konten polos</p>
      </FormPageContent>,
    );

    expect(screen.queryByRole("title")).not.toBeInTheDocument();
    expect(screen.getByText("Konten polos")).toBeInTheDocument();
  });

  it("actions dirender di sebelah title ketika title diberikan", () => {
    renderContent(
      <FormPageContent
        value="detail"
        title="Dengan Aksi"
        actions={<button>Aksi</button>}
      >
        <p>Konten</p>
      </FormPageContent>,
    );

    const title = screen.getByRole("title");
    expect(title).toHaveTextContent("Dengan Aksi");
    expect(screen.getByRole("button", { name: "Aksi" })).toBeInTheDocument();
  });

  it("memanggil addMenu saat mount dan removeMenu saat unmount (registrasi tab)", () => {
    const contextValue = makeContextValue();
    const { unmount } = renderContent(
      <FormPageContent value="detail" title="Detail">
        <p>x</p>
      </FormPageContent>,
      { contextValue },
    );

    expect(contextValue.addMenu).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Detail", value: "detail" }),
    );

    unmount();
    expect(contextValue.removeMenu).toHaveBeenCalled();
  });

  it("show=false memanggil removeMenu dan tidak memanggil addMenu", () => {
    const contextValue = makeContextValue();
    renderContent(
      <FormPageContent value="detail" title="Detail" show={false}>
        <p>x</p>
      </FormPageContent>,
      { contextValue },
    );

    expect(contextValue.addMenu).not.toHaveBeenCalled();
    expect(contextValue.removeMenu).toHaveBeenCalled();
  });

  it("showAt=true tanpa value tidak memanggil addMenu (menu digantung ke tab aktif, bukan registrasi baru)", () => {
    const contextValue = makeContextValue();
    renderContent(
      <FormPageContent showAt title="Kondisional">
        <p>Muncul di tab manapun</p>
      </FormPageContent>,
      { contextValue },
    );

    expect(contextValue.addMenu).not.toHaveBeenCalled();
  });

  it("role=content selalu ada pada wrapper div utama", () => {
    renderContent(
      <FormPageContent value="detail" title="Punya Role">
        <p>x</p>
      </FormPageContent>,
    );

    expect(screen.getAllByRole("content").length).toBeGreaterThan(0);
  });

  it("className diteruskan ke wrapper div", () => {
    const { container } = renderContent(
      <FormPageContent value="detail" title="T" className="my-custom-class">
        <p>x</p>
      </FormPageContent>,
    );

    expect(container.querySelector(".my-custom-class")).toBeInTheDocument();
  });
});
