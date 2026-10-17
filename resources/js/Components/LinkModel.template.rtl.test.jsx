import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Integrasi LinkModel <-> renderer bersama SemanticTemplate (spec
// datatable-semantic-templates 10.2/10.6): opsi dropdown dirender lewat
// SemanticTemplate, `templateLink` lama tampil sama, pencarian cocok ke TEKS
// TERLIHAT (bukan nama tag / <title>), teks input terpilih tetap memakai
// convertTemplateLink (<title> / teks polos pertama).

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: {
    post: (...args) => axiosPost(...args),
    get: () => Promise.resolve({ data: { data: [] } }),
  },
}));

window.route = (name) => name;

import LinkModel from "./LinkModel";
import { TooltipProvider } from "./ui/tooltip";

const render = async (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let result;
  await act(async () => {
    result = rtlRender(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
      </QueryClientProvider>,
    );
  });
  return result;
};

const MODEL = "AppModelsItem";
const makeRows = (templateLink, rows) =>
  rows.map((row, index) => ({
    id: index + 1,
    thisModel: MODEL,
    templateLink,
    ...row,
  }));

const openDropdown = async (user) => {
  await act(async () => {
    await user.click(screen.getByRole("textbox"));
  });
};

describe("LinkModel - opsi dirender lewat SemanticTemplate", () => {
  beforeEach(() => {
    axiosPost.mockReset();
  });

  it("templateLink lama (<b>:code</b><br/><span>:name</span>) tampil sama", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: makeRows("<b>:code</b><br/><span>:name</span>", [
          { code: "A-1", name: "Alpha" },
        ]),
        total: 1,
      },
    });
    const user = userEvent.setup({ delay: null });
    await render(<LinkModel model={MODEL} />);
    await openDropdown(user);

    const code = await screen.findByText("A-1");
    expect(code.tagName).toBe("B");
    expect(screen.getByText("Alpha").tagName).toBe("SPAN");
    expect(code.parentElement.querySelector("br")).not.toBeNull();
  });

  it("templateLink boleh memakai tag semantik (muted, badge)", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: makeRows(
          '<stack><strong>:name</strong><muted>:code</muted><badge color="red">:tag</badge></stack>',
          [{ name: "Alpha", code: "A-1", tag: "hot" }],
        ),
        total: 1,
      },
    });
    const user = userEvent.setup({ delay: null });
    await render(<LinkModel model={MODEL} />);
    await openDropdown(user);

    expect((await screen.findByText("A-1")).className).toMatch(
      /text-muted-foreground/,
    );
    expect(screen.getByText("hot").className).toMatch(/bg-red-100/);
    expect(screen.getByText("Alpha").tagName).toBe("STRONG");
  });

  it("nilai berisi HTML dirender sebagai teks, bukan elemen", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: makeRows("<b>:name</b>", [
          { name: "<img src=x onerror=alert(1)>" },
        ]),
        total: 1,
      },
    });
    const user = userEvent.setup({ delay: null });
    await render(<LinkModel model={MODEL} />);
    await openDropdown(user);

    expect(
      await screen.findByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("<title> dibuang dari opsi dropdown", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: makeRows("<title>JUDUL-INPUT</title><b>:name</b>", [
          { name: "Alpha" },
        ]),
        total: 1,
      },
    });
    const user = userEvent.setup({ delay: null });
    await render(<LinkModel model={MODEL} />);
    await openDropdown(user);

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("JUDUL-INPUT")).toBeNull();
  });

  it("kata pencarian disorot dengan <mark> bg-yellow-500", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: makeRows("<b>:name</b>", [{ name: "Alpha" }]),
        total: 1,
      },
    });
    const user = userEvent.setup({ delay: null });
    await render(<LinkModel model={MODEL} />);
    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Alp");
    });

    await waitFor(() => {
      const mark = document.querySelector("mark");
      expect(mark).not.toBeNull();
      expect(mark).toHaveClass("bg-yellow-500");
      expect(mark.textContent).toBe("Alp");
    });
    expect(document.querySelector("b").textContent).toBe("Alpha");
  });
});

describe("LinkModel - filter klien (mode cache) mencocokkan teks terlihat", () => {
  const rows = makeRows("<b>:code</b><br/><span>:name</span>", [
    { code: "A-1", name: "Alpha" },
    { code: "B-2", name: "Beta" },
  ]);

  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({ data: { data: rows, total: 2 } });
  });

  const typeSearch = async (text) => {
    const user = userEvent.setup({ delay: null });
    await render(<LinkModel model={MODEL} cache />);
    await act(async () => {
      await user.type(screen.getByRole("textbox"), text);
    });
  };

  it("kata yang cocok dengan teks terlihat menyaring opsi", async () => {
    await typeSearch("alp");

    expect(await screen.findByText("A-1")).toBeInTheDocument();
    expect(screen.queryByText("B-2")).toBeNull();
  });

  it("nama tag (span/br) TIDAK cocok", async () => {
    await typeSearch("span");

    await waitFor(() => {
      expect(screen.queryByText("A-1")).toBeNull();
      expect(screen.queryByText("B-2")).toBeNull();
    });
  });

  it("isi <title> TIDAK ikut dicocokkan", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: makeRows("<title>ZZJUDUL</title><b>:name</b>", [
          { name: "Alpha" },
        ]),
        total: 1,
      },
    });
    await typeSearch("zzjudul");

    await waitFor(() => {
      expect(screen.queryByText("Alpha")).toBeNull();
    });
  });
});

describe("LinkModel - teks input terpilih (Req 14.2)", () => {
  it("memakai teks <title> bila ada", async () => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({ data: { data: [], total: 0 } });
    await render(
      <LinkModel
        model={MODEL}
        value={{
          templateLink: "<title>Judul Pilih</title><b>:name</b>",
          name: "Alpha",
        }}
      />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("Judul Pilih");
  });

  it("tanpa <title> memakai teks polos pertama", async () => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({ data: { data: [], total: 0 } });
    await render(
      <LinkModel
        model={MODEL}
        value={{ templateLink: ":name <b>:code</b>", name: "Alpha", code: "A" }}
      />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("Alpha");
  });
});
