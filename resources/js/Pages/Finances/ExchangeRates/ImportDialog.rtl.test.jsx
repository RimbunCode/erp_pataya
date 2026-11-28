import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) => (params ? `${key}|${JSON.stringify(params)}` : key),
  }),
}));

const routerMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@inertiajs/react", () => ({ router: routerMock }));

import ImportDialog from "./ImportDialog";

const COLUMNS = [
  "from_currency_code",
  "to_currency_code",
  "rate_type",
  "rate",
  "rate_date",
];

const renderDialog = (onClose = vi.fn()) =>
  render(<ImportDialog maxMb={5} columns={COLUMNS} onClose={onClose} />);

describe("Finances/ExchangeRates/ImportDialog", () => {
  beforeEach(() => {
    routerMock.post.mockReset();
    window.route = (name) => `/${name}`;
  });

  it("menjelaskan kolom header dan batas ukuran", () => {
    renderDialog();

    expect(
      screen.getByText(
        `finances.exchangeRate.page.import_description|${JSON.stringify({
          columns: COLUMNS.join(", "),
          max: 5,
        })}`,
      ),
    ).toBeInTheDocument();
  });

  it("tombol impor nonaktif sampai berkas dipilih", () => {
    renderDialog();

    expect(
      screen.getByRole("button", {
        name: "finances.exchangeRate.page.import_submit",
      }),
    ).toBeDisabled();
  });

  it("mengunggah berkas sebagai form data tanpa path dari input", async () => {
    renderDialog();
    const file = new File(["a,b\n1,2\n"], "kurs.csv", { type: "text/csv" });

    await userEvent.upload(
      screen.getByLabelText("finances.exchangeRate.page.import_file"),
      file,
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "finances.exchangeRate.page.import_submit",
      }),
    );

    expect(routerMock.post).toHaveBeenCalledTimes(1);
    const [url, payload, options] = routerMock.post.mock.calls[0];
    expect(url).toBe("/exchangeRates.import");
    expect(Object.keys(payload)).toEqual(["file"]);
    expect(payload.file).toBe(file);
    expect(options.forceFormData).toBe(true);
  });

  it("menampilkan ringkasan dan galat per baris dari laporan server", async () => {
    routerMock.post.mockImplementation((_url, _payload, options) =>
      options.onSuccess({
        props: {
          flash: {
            importReport: {
              created: 2,
              updated: 0,
              unchanged: 1,
              errorCount: 3,
              omittedErrors: 1,
              errors: [
                { line: 4, message: "Kode mata uang ZZZ tidak ditemukan." },
                { line: 6, message: "Kurs harus lebih besar dari 0." },
              ],
            },
          },
        },
      }),
    );
    renderDialog();

    await userEvent.upload(
      screen.getByLabelText("finances.exchangeRate.page.import_file"),
      new File(["x"], "kurs.csv", { type: "text/csv" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "finances.exchangeRate.page.import_submit",
      }),
    );

    expect(
      await screen.findByText(
        `finances.exchangeRate.page.import_summary|${JSON.stringify({
          created: 2,
          updated: 0,
          unchanged: 1,
          errors: 3,
        })}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Kode mata uang ZZZ tidak ditemukan.", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Kurs harus lebih besar dari 0.", { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `finances.exchangeRate.page.import_line|${JSON.stringify({ line: 4 })}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `finances.exchangeRate.page.import_omitted|${JSON.stringify({ count: 1 })}`,
      ),
    ).toBeInTheDocument();
  });

  it("galat tingkat berkas (baris 0) tampil sebagai pesan umum tanpa label baris", async () => {
    routerMock.post.mockImplementation((_url, _payload, options) =>
      options.onSuccess({
        props: {
          flash: {
            importReport: {
              created: 0,
              updated: 0,
              unchanged: 0,
              errorCount: 1,
              omittedErrors: 0,
              errors: [{ line: 0, message: "Header CSV tidak lengkap." }],
            },
          },
        },
      }),
    );
    renderDialog();

    await userEvent.upload(
      screen.getByLabelText("finances.exchangeRate.page.import_file"),
      new File([" "], "kosong.csv", { type: "text/csv" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "finances.exchangeRate.page.import_submit",
      }),
    );

    expect(
      await screen.findByText("Header CSV tidak lengkap."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        `finances.exchangeRate.page.import_line|${JSON.stringify({ line: 0 })}`,
      ),
    ).not.toBeInTheDocument();
  });

  it("menampilkan galat validasi berkas dari server", async () => {
    routerMock.post.mockImplementation((_url, _payload, options) =>
      options.onError({ file: "Berkas terlalu besar." }),
    );
    renderDialog();

    await userEvent.upload(
      screen.getByLabelText("finances.exchangeRate.page.import_file"),
      new File(["x"], "kurs.csv", { type: "text/csv" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "finances.exchangeRate.page.import_submit",
      }),
    );

    expect(
      await screen.findByText("Berkas terlalu besar."),
    ).toBeInTheDocument();
  });

  it("tombol tutup memanggil onClose", async () => {
    const onClose = vi.fn();
    renderDialog(onClose);

    await userEvent.click(
      screen.getByRole("button", { name: "finances.exchangeRate.page.close" }),
    );

    expect(onClose).toHaveBeenCalled();
  });
});
