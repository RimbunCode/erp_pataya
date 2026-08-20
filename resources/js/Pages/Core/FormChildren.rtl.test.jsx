import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

import { FormChildren, FormPageContent, useFormPageMeta } from "./FormPage";

function Probe() {
  const meta = useFormPageMeta();
  return (
    <div data-testid="meta-probe">
      {JSON.stringify({
        disabled: meta?.disabled ?? null,
        fieldNameTrans: meta?.fieldNameTrans ?? null,
        dataBefore: meta?.dataBefore ?? null,
      })}
    </div>
  );
}

describe("FormChildren", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender satu FormPageContent (single tab) tanpa TabsList terlihat (class hidden)", () => {
    render(
      <FormChildren data={{}} setData={vi.fn()} defaultData={{}}>
        <FormPageContent value="detail" title="Detail">
          <p>Isi</p>
        </FormPageContent>
      </FormChildren>,
    );

    expect(screen.getByText("Isi")).toBeInTheDocument();
    const tabsList = document.querySelector("[data-tabs]");
    expect(tabsList).toHaveClass("hidden");
  });

  it("dua FormPageContent (multi tab) menampilkan TabsList dengan dua trigger dan bisa berpindah tab", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <FormChildren data={{}} setData={vi.fn()} defaultData={{}}>
        <FormPageContent value="tab-a" title="Tab A">
          <p>Konten A</p>
        </FormPageContent>
        <FormPageContent value="tab-b" title="Tab B">
          <p>Konten B</p>
        </FormPageContent>
      </FormChildren>,
    );

    const tabsList = document.querySelector("[data-tabs]");
    expect(tabsList).not.toHaveClass("hidden");
    expect(screen.getByRole("tab", { name: "Tab A" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tab B" })).toBeInTheDocument();

    // Tab pertama aktif secara default.
    expect(screen.getByText("Konten A")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Tab B" }));
    expect(screen.getByText("Konten B")).toBeVisible();
  });

  it("defaultMenu menentukan tab yang aktif di awal", () => {
    render(
      <FormChildren
        data={{}}
        setData={vi.fn()}
        defaultData={{}}
        defaultMenu="tab-b"
      >
        <FormPageContent value="tab-a" title="Tab A">
          <p>Konten A</p>
        </FormPageContent>
        <FormPageContent value="tab-b" title="Tab B">
          <p>Konten B</p>
        </FormPageContent>
      </FormChildren>,
    );

    expect(screen.getByRole("tab", { name: "Tab B" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  it("defaultData.approvalable menambah tab 'core.form.approvals' walau hanya 1 FormPageContent lain", () => {
    render(
      <FormChildren
        data={{}}
        setData={vi.fn()}
        defaultData={{ approvalable: { steps: [] } }}
      >
        <FormPageContent value="detail" title="Detail">
          <p>Isi</p>
        </FormPageContent>
      </FormChildren>,
    );

    expect(
      screen.getByRole("tab", { name: "core.form.approvals" }),
    ).toBeInTheDocument();
    // TabsList tidak boleh hidden karena total menu > 1 (detail + approvals).
    const tabsList = document.querySelector("[data-tabs]");
    expect(tabsList).not.toHaveClass("hidden");
  });

  it("meneruskan meta (disabled, fieldNameTrans, dataBefore) lewat FormPageProvider internal ke useFormPageMeta", () => {
    render(
      <FormChildren
        data={{}}
        setData={vi.fn()}
        defaultData={{}}
        disabled={true}
        fieldNameTrans="purchaseOrder"
        dataBefore={{ code: "PO-1" }}
      >
        <Probe />
      </FormChildren>,
    );

    const probe = JSON.parse(screen.getByTestId("meta-probe").textContent);
    expect(probe).toEqual({
      disabled: true,
      fieldNameTrans: "purchaseOrder",
      dataBefore: { code: "PO-1" },
    });
  });

  it("dataBefore undefined dinormalisasi menjadi object kosong pada context meta", () => {
    render(
      <FormChildren data={{}} setData={vi.fn()} defaultData={{}}>
        <Probe />
      </FormChildren>,
    );

    const probe = JSON.parse(screen.getByTestId("meta-probe").textContent);
    expect(probe.dataBefore).toEqual({});
  });
});
