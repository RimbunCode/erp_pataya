import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import userEvent from "@testing-library/user-event";

// Regresi: tab Style kosong sampai CSS manual di-inject atau halaman di-refresh.
// Penyebabnya, <StylesProvider> milik @grapesjs/react hanya mengisi `sectors`
// lewat event `style:custom` dan mulai dari array kosong. Kalau provider baru
// ter-mount saat tab Style diklik, event untuk komponen yang SUDAH terpilih
// sudah terlewat. StylesProvider palsu di bawah meniru perilaku itu persis
// (state awal kosong, diisi hanya dari event), supaya test gagal kalau
// Sidebar kembali melepas provider saat tab berpindah.

const providerMounts = vi.fn();
let fakeEditor;

function createFakeEditor({ withTriggerCustom }) {
  const listeners = {};
  let selected = null;
  const editor = {
    on: (event, handler) => {
      (listeners[event] ||= new Set()).add(handler);
    },
    off: (event, handler) => {
      listeners[event]?.delete(handler);
    },
    emit: (event, payload) => {
      listeners[event]?.forEach((handler) => handler(payload));
    },
    getSelected: () => selected,
    select: (component) => {
      selected = component;
      editor.emit("component:selected", component);
      // Style Manager GrapesJS menembakkan `style:custom` setelah target berubah.
      editor.emit("style:custom", {
        container: null,
        sectors: component ? [{ id: "typography" }, { id: "layout" }] : [],
      });
    },
  };

  editor.Styles = withTriggerCustom
    ? {
        __trgCustom: vi.fn(() => {
          editor.emit("style:custom", {
            container: null,
            sectors: selected ? [{ id: "typography" }, { id: "layout" }] : [],
          });
        }),
      }
    : {};

  return editor;
}

vi.mock("@grapesjs/react", async () => {
  const React = await import("react");
  return {
    useEditor: () => fakeEditor,
    BlocksProvider: ({ children }) => children({}),
    LayersProvider: ({ children }) => children({}),
    StylesProvider: ({ children }) => {
      const editor = fakeEditor;
      const [state, setState] = React.useState({ sectors: [] });
      React.useEffect(() => {
        providerMounts();
        const handler = ({ sectors }) => setState({ sectors });
        editor.on("style:custom", handler);
        return () => editor.off("style:custom", handler);
      }, [editor]);
      return children(state);
    },
  };
});

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, _replace, fallback) => fallback ?? key,
  }),
}));

vi.mock("./CustomStyleManager", () => ({
  default: ({ sectors }) => (
    <div data-testid="style-manager">
      {sectors.map((sector) => (
        <span key={sector.id} data-testid="sector">
          {sector.id}
        </span>
      ))}
    </div>
  ),
}));
vi.mock("./CustomBlockManager", () => ({ default: () => <div /> }));
vi.mock("./CustomLayerManager", () => ({ default: () => <div /> }));
vi.mock("./CustomModePanel", () => ({ default: () => <div /> }));
vi.mock("./Inspector/StaticHTMLInspector", () => ({
  default: () => <div />,
}));
vi.mock("./TokenConfigurationManager", () => ({ default: () => <div /> }));
vi.mock("./VariableManager", () => ({ default: () => <div /> }));

import Sidebar from "./Sidebar";

function fakeComponent(type = "text") {
  return {
    getType: () => type,
    get: () => undefined,
    parent: () => null,
  };
}

describe("Sidebar tab Style", () => {
  beforeEach(() => {
    providerMounts.mockClear();
  });

  it("menampilkan sectors untuk komponen yang dipilih saat tab lain aktif", async () => {
    fakeEditor = createFakeEditor({ withTriggerCustom: false });
    const user = userEvent.setup();
    render(<Sidebar />);

    // Seleksi terjadi saat tab "Variables" aktif (tab Style belum pernah dibuka).
    act(() => fakeEditor.select(fakeComponent()));

    await user.click(screen.getByRole("tab", { name: /Style/ }));

    expect(await screen.findByTestId("style-manager")).toBeTruthy();
    expect(screen.getAllByTestId("sector")).toHaveLength(2);
  });

  it("tidak me-remount StylesProvider saat berpindah tab", async () => {
    fakeEditor = createFakeEditor({ withTriggerCustom: false });
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("tab", { name: /Style/ }));
    await user.click(screen.getByRole("tab", { name: /Layer/ }));
    await user.click(screen.getByRole("tab", { name: /Style/ }));

    expect(providerMounts).toHaveBeenCalledTimes(1);
  });

  it("tetap menampilkan sectors setelah bolak-balik antar tab", async () => {
    fakeEditor = createFakeEditor({ withTriggerCustom: false });
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("tab", { name: /Style/ }));
    act(() => fakeEditor.select(fakeComponent()));
    expect(screen.getAllByTestId("sector")).toHaveLength(2);

    await user.click(screen.getByRole("tab", { name: /Layer/ }));
    await user.click(screen.getByRole("tab", { name: /Style/ }));

    expect(screen.getAllByTestId("sector")).toHaveLength(2);
  });

  it("meminta Style Manager menembakkan ulang event saat tab Style dibuka", async () => {
    fakeEditor = createFakeEditor({ withTriggerCustom: true });
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("tab", { name: /Style/ }));

    expect(fakeEditor.Styles.__trgCustom).toHaveBeenCalled();
  });

  it("tidak merender panel Style untuk komponen staticHTML dan menyembunyikan tabnya", async () => {
    fakeEditor = createFakeEditor({ withTriggerCustom: false });
    render(<Sidebar />);

    act(() => fakeEditor.select(fakeComponent("staticHTML")));

    expect(screen.queryByRole("tab", { name: /Style/ })).toBeNull();
    expect(screen.queryByTestId("style-manager")).toBeNull();
  });
});
