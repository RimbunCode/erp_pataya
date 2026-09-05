import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import InputBarcode from "./InputBarcode";

describe("InputBarcode", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: { data: [{ id: 1, templateLink: "Item :name", name: "Widget" }] },
    });
  });

  it("render input dengan placeholder default", () => {
    render(<InputBarcode model="AppModelsItem" />);
    expect(
      screen.getByPlaceholderText("TR:core.form.input_barcode.placeholder"),
    ).toBeInTheDocument();
  });

  it("mengetik memicu request axios setelah debounce (manual search)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });

    render(<InputBarcode model="AppModelsItem" limit={10} />);
    const input = screen.getByPlaceholderText(
      "TR:core.form.input_barcode.placeholder",
    );

    await user.type(input, "widget");
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    expect(axiosPost).toHaveBeenCalledWith(
      "model",
      expect.objectContaining({ model: "AppModelsItem", search: "widget" }),
    );

    vi.useRealTimers();
  });

  it("input kosong tidak memicu request dan mengosongkan opsi", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });

    render(<InputBarcode model="AppModelsItem" />);
    const input = screen.getByPlaceholderText(
      "TR:core.form.input_barcode.placeholder",
    );

    await user.type(input, "a");
    await user.clear(input);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(axiosPost).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("disabled mencegah input diedit", () => {
    render(<InputBarcode model="AppModelsItem" disabled />);
    expect(
      screen.getByPlaceholderText("TR:core.form.input_barcode.placeholder"),
    ).toBeDisabled();
  });
});
