import { act, render } from "@testing-library/react";
import axios from "axios";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));
vi.mock("axios");
vi.mock("@/lib/initHandlebar", () => ({ initHandlebar: vi.fn() }));
vi.mock("@/Components/NumberInput/getCurrencyConfig", () => ({
  getCurrencyConfig: vi.fn().mockResolvedValue({ symbol: "Rp" }),
}));

import PreviewModal from "./PreviewModal";

const template = {
  id: "template-1",
  model: "App\\Models\\Finances\\SalesInvoice",
  default_language: "id",
  html: "<body><span>{{doc.amount}}</span><span>{{approvalSignature.name}}</span></body>",
  css: "body span { color: red; }",
  width: 21,
  height: 29.7,
  unit: "cm",
  font_family: "Arial",
};

describe("PreviewModal", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback) => {
      callback();
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    window.route = vi.fn(() => "/print-template-preview");
    axios.post.mockResolvedValue({
      data: {
        html: template.html,
        css: template.css,
        exampleData: { amount: 1000, currency_code: "IDR" },
        columns: {
          "App\\Models\\Finances\\SalesInvoice": {
            amount: { type: "currency" },
          },
        },
        warnings: [],
      },
    });
  });

  it("memformat example data dan memakai scope template pada iframe", async () => {
    await act(async () => {
      render(
        <PreviewModal
          open
          onOpenChange={vi.fn()}
          printTemplate={template}
          template={template}
          preferences={{ default_currency_id: "IDR" }}
        />,
      );
    });

    await vi.waitFor(() => {
      const frame = document.querySelector("iframe");
      expect(frame).toBeTruthy();
      expect(frame.contentDocument.body.innerHTML).toContain("Rp 1.000");
      expect(frame.contentDocument.body.innerHTML).toContain(
        "pt-scope--template",
      );
      expect(
        frame.contentDocument.head.querySelector("style").innerHTML,
      ).toContain(".pt-scope--template span");
    });
  });
});
