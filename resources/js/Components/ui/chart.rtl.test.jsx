import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ChartContainer,
  ChartStyle,
  ChartTooltipContent,
  ChartLegendContent,
} from "./chart";

// ResponsiveContainer (recharts) selalu meng-clone children-nya dengan
// width/height (walau bernilai 0 di jsdom karena tidak ada layout nyata) --
// jadi children TETAP dirender di DOM (beda dari komponen recharts Chart
// spesifik seperti BarChart/LineChart yang sengaja return null saat
// width/height <= 0). Ini diverifikasi manual sebelum menulis test ini,
// sehingga ChartTooltipContent/ChartLegendContent bisa dirender sungguhan
// di dalam <ChartContainer> untuk mendapat ChartContext-nya.

describe("ChartContainer", () => {
  const config = {};

  it("render wrapper <div> dengan className default tanpa crash", () => {
    render(
      <ChartContainer data-testid="wrapper" config={config}>
        <div>Isi chart</div>
      </ChartContainer>,
    );
    const wrapper = screen.getByTestId("wrapper");
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("aspect-video");
    expect(wrapper.className).toContain("justify-center");
  });

  it("menggabungkan className custom dengan default (bukan menggantikan)", () => {
    render(
      <ChartContainer
        data-testid="wrapper"
        config={config}
        className="custom-chart"
      >
        <div />
      </ChartContainer>,
    );
    const wrapper = screen.getByTestId("wrapper");
    expect(wrapper.className).toContain("custom-chart");
    expect(wrapper.className).toContain("aspect-video");
  });

  it("data-chart memakai id prop bila diberikan (format chart-{id})", () => {
    render(
      <ChartContainer data-testid="wrapper" id="sales" config={config}>
        <div />
      </ChartContainer>,
    );
    expect(screen.getByTestId("wrapper")).toHaveAttribute(
      "data-chart",
      "chart-sales",
    );
  });

  it("data-chart digenerate otomatis dari useId() bila id tidak diberikan (prefix chart-, tanpa karakter ':')", () => {
    render(
      <ChartContainer data-testid="wrapper" config={config}>
        <div />
      </ChartContainer>,
    );
    const dataChart = screen.getByTestId("wrapper").getAttribute("data-chart");
    expect(dataChart).toMatch(/^chart-/);
    expect(dataChart).not.toContain(":");
  });

  it("forwardRef meneruskan ref ke elemen <div> asli", () => {
    const ref = createRef();
    render(
      <ChartContainer data-testid="wrapper" config={config} ref={ref}>
        <div />
      </ChartContainer>,
    );
    expect(ref.current).toBe(screen.getByTestId("wrapper"));
    expect(ref.current.tagName).toBe("DIV");
  });

  it("meneruskan props HTML lain (aria-label) ke elemen div", () => {
    render(
      <ChartContainer
        data-testid="wrapper"
        config={config}
        aria-label="Grafik penjualan"
      >
        <div />
      </ChartContainer>,
    );
    expect(screen.getByTestId("wrapper")).toHaveAttribute(
      "aria-label",
      "Grafik penjualan",
    );
  });

  it("children benar-benar dirender di dalam ResponsiveContainer", () => {
    render(
      <ChartContainer data-testid="wrapper" config={config}>
        <div data-testid="inner">Isi Chart</div>
      </ChartContainer>,
    );
    expect(screen.getByTestId("inner")).toHaveTextContent("Isi Chart");
  });

  it("merender <style> (ChartStyle) dengan id chart yang sama saat config punya entry berwarna", () => {
    const { container } = render(
      <ChartContainer
        data-testid="wrapper"
        id="sales"
        config={{ revenue: { label: "Revenue", color: "#2563eb" } }}
      >
        <div />
      </ChartContainer>,
    );
    const style = container.querySelector("style");
    expect(style).not.toBeNull();
    expect(style.innerHTML).toContain("[data-chart=chart-sales]");
    expect(style.innerHTML).toContain("--color-revenue: #2563eb;");
  });

  it("TIDAK merender <style> saat config kosong / tidak ada entry theme/color", () => {
    const { container } = render(
      <ChartContainer
        data-testid="wrapper"
        config={{ revenue: { label: "Revenue" } }}
      >
        <div />
      </ChartContainer>,
    );
    expect(container.querySelector("style")).toBeNull();
  });
});

describe("ChartStyle", () => {
  it("return null (tidak render apapun) saat config tidak punya entry color/theme", () => {
    const { container } = render(
      <ChartStyle id="chart-x" config={{ a: { label: "A" } }} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("merender <style> berisi CSS variable --color-{key} sesuai config.color", () => {
    const { container } = render(
      <ChartStyle
        id="chart-x"
        config={{ revenue: { label: "Revenue", color: "#2563eb" } }}
      />,
    );
    const style = container.querySelector("style");
    expect(style).not.toBeNull();
    expect(style.innerHTML).toContain("[data-chart=chart-x]");
    expect(style.innerHTML).toContain("--color-revenue: #2563eb;");
    expect(style.innerHTML).toContain(".dark [data-chart=chart-x]");
  });

  it("hanya menyertakan entry yang punya color/theme -- entry lain diabaikan", () => {
    const { container } = render(
      <ChartStyle
        id="chart-x"
        config={{
          revenue: { label: "Revenue", color: "#123456" },
          note: { label: "Catatan tanpa warna" },
        }}
      />,
    );
    const css = container.querySelector("style").innerHTML;
    expect(css).toContain("--color-revenue: #123456;");
    expect(css).not.toContain("--color-note");
  });

  it("config.theme memakai warna berbeda utk selector light ('') vs dark ('.dark')", () => {
    const { container } = render(
      <ChartStyle
        id="chart-x"
        config={{
          revenue: {
            label: "Revenue",
            theme: { light: "#111111", dark: "#eeeeee" },
          },
        }}
      />,
    );
    const css = container.querySelector("style").innerHTML;
    const darkIndex = css.indexOf(".dark");
    const lightBlock = css.slice(0, darkIndex);
    const darkBlock = css.slice(darkIndex);
    expect(lightBlock).toContain("--color-revenue: #111111;");
    expect(darkBlock).toContain("--color-revenue: #eeeeee;");
  });
});

describe("useChart (context guard)", () => {
  it("ChartTooltipContent melempar error saat dirender di luar <ChartContainer>", () => {
    expect(() => render(<ChartTooltipContent active payload={[]} />)).toThrow(
      "useChart must be used within a <ChartContainer />",
    );
  });

  it("ChartLegendContent melempar error saat dirender di luar <ChartContainer>", () => {
    expect(() => render(<ChartLegendContent payload={[]} />)).toThrow(
      "useChart must be used within a <ChartContainer />",
    );
  });
});

describe("ChartTooltipContent", () => {
  const config = {
    revenue: { label: "Pendapatan", color: "#2563eb" },
    desktop: { label: "Desktop", color: "#111111" },
    mobile: { label: "Mobile", color: "#222222" },
  };

  const renderTooltip = (props, cfg = config) =>
    render(
      <ChartContainer config={cfg}>
        <ChartTooltipContent {...props} />
      </ChartContainer>,
    );

  const basePayload = [
    {
      dataKey: "revenue",
      name: "revenue",
      value: 1500,
      color: "#2563eb",
      payload: { period: "Januari", revenue: 1500 },
    },
  ];

  it("return null (tidak render apapun) saat active=false", () => {
    renderTooltip({ active: false, label: "Januari", payload: basePayload });
    expect(screen.queryByText("Januari")).not.toBeInTheDocument();
    expect(screen.queryByText("Pendapatan")).not.toBeInTheDocument();
  });

  it("return null saat payload kosong walau active=true", () => {
    renderTooltip({ active: true, label: "Januari", payload: [] });
    expect(screen.queryByText("Januari")).not.toBeInTheDocument();
  });

  it("merender label, nama series (dari config), dan value ter-format saat active & payload ada", () => {
    renderTooltip({ active: true, label: "Januari", payload: basePayload });

    expect(screen.getByText("Januari")).toBeInTheDocument();
    expect(screen.getByText("Pendapatan")).toBeInTheDocument();
    expect(screen.getByText((1500).toLocaleString())).toBeInTheDocument();
  });

  it("hideLabel=true menyembunyikan label", () => {
    renderTooltip({
      active: true,
      label: "Januari",
      hideLabel: true,
      payload: basePayload,
    });
    expect(screen.queryByText("Januari")).not.toBeInTheDocument();
    expect(screen.getByText("Pendapatan")).toBeInTheDocument();
  });

  it("labelFormatter mengganti isi label default", () => {
    renderTooltip({
      active: true,
      label: "Januari",
      labelFormatter: (value) => `Periode: ${value}`,
      payload: basePayload,
    });
    expect(screen.getByText("Periode: Januari")).toBeInTheDocument();
    expect(
      screen.queryByText("Januari", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("formatter custom menggantikan tampilan default indikator+nama+value", () => {
    renderTooltip({
      active: true,
      label: "Januari",
      formatter: (value, name) => (
        <span data-testid="custom-formatter">
          {name}={value}
        </span>
      ),
      payload: basePayload,
    });
    expect(screen.getByTestId("custom-formatter")).toHaveTextContent(
      `revenue=${1500}`,
    );
    // tampilan default (label config "Pendapatan") tidak ikut muncul lagi
    expect(screen.queryByText("Pendapatan")).not.toBeInTheDocument();
  });

  it("hideIndicator=true menyembunyikan kotak warna indikator", () => {
    const { container } = renderTooltip({
      active: true,
      label: "Januari",
      hideIndicator: true,
      payload: basePayload,
    });
    expect(container.querySelector(".shrink-0.rounded-md")).toBeNull();
  });

  it("indicator='line' menghasilkan className w-1 pada elemen indikator", () => {
    const { container } = renderTooltip({
      active: true,
      label: "Januari",
      indicator: "line",
      payload: basePayload,
    });
    const indicator = container.querySelector(".shrink-0.rounded-md");
    expect(indicator.className).toContain("w-1");
    expect(indicator.className).not.toContain("h-2.5");
  });

  it("indicator='dashed' menghasilkan className border-dashed bg-transparent", () => {
    const { container } = renderTooltip({
      active: true,
      label: "Januari",
      indicator: "dashed",
      payload: basePayload,
    });
    const indicator = container.querySelector(".shrink-0.rounded-md");
    expect(indicator.className).toContain("border-dashed");
    expect(indicator.className).toContain("bg-transparent");
  });

  it("indikator dot memakai CSS custom property --color-bg/--color-border sesuai warna item", () => {
    const { container } = renderTooltip({
      active: true,
      label: "Januari",
      payload: basePayload,
    });
    const indicator = container.querySelector(".shrink-0.rounded-md");
    expect(indicator.style.getPropertyValue("--color-bg")).toBe("#2563eb");
    expect(indicator.style.getPropertyValue("--color-border")).toBe("#2563eb");
  });

  it("prop color meng-override warna item.color/item.payload.fill sebagai warna indikator", () => {
    const { container } = renderTooltip({
      active: true,
      label: "Januari",
      color: "#ff0000",
      payload: basePayload,
    });
    const indicator = container.querySelector(".shrink-0.rounded-md");
    expect(indicator.style.getPropertyValue("--color-bg")).toBe("#ff0000");
  });

  it("itemConfig.icon dirender menggantikan kotak warna, dan TETAP tampil walau hideIndicator=true", () => {
    const cfgWithIcon = {
      revenue: {
        label: "Pendapatan",
        color: "#2563eb",
        icon: () => <svg data-testid="revenue-icon" />,
      },
    };
    const { container } = renderTooltip(
      {
        active: true,
        label: "Januari",
        hideIndicator: true,
        payload: basePayload,
      },
      cfgWithIcon,
    );
    expect(screen.getByTestId("revenue-icon")).toBeInTheDocument();
    expect(container.querySelector(".shrink-0.rounded-md")).toBeNull();
  });

  it("item dengan type='none' difilter (tidak ikut dirender)", () => {
    renderTooltip({
      active: true,
      label: "Januari",
      payload: [
        ...basePayload,
        {
          dataKey: "hidden",
          name: "hidden",
          value: 999,
          type: "none",
          payload: {},
        },
      ],
    });
    expect(screen.queryByText((999).toLocaleString())).not.toBeInTheDocument();
  });

  it("value 0 dirender DI DALAM span berclass font-mono (styling konsisten dgn value lain, bukan teks polos)", () => {
    const { container } = renderTooltip({
      active: true,
      label: "Januari",
      payload: [
        {
          dataKey: "revenue",
          name: "revenue",
          value: 0,
          payload: { revenue: 0 },
        },
      ],
    });
    // label series tetap tampil...
    expect(screen.getByText("Pendapatan")).toBeInTheDocument();
    // ...value "0" dirender di dalam span berclass font-mono/tabular-nums,
    // sama seperti value non-zero -- karena kondisi cek `item.value != null`
    // (bukan truthiness), bukan literal 0 lolos ke DOM tanpa pembungkus.
    const valueSpan = container.querySelector("span.font-mono");
    expect(valueSpan).not.toBeNull();
    expect(valueSpan).toHaveClass(
      "font-mono",
      "font-medium",
      "tabular-nums",
      "text-foreground",
    );
    expect(valueSpan.textContent).toBe((0).toLocaleString());
  });

  it("nameKey: resolusi config lewat property BERNAMA nameKey langsung di item (bukan di item.payload)", () => {
    renderTooltip({
      active: true,
      label: "Januari",
      nameKey: "seriesId",
      payload: [
        {
          seriesId: "desktop",
          dataKey: "raw_value",
          name: "desktop-raw-label",
          value: 42,
          payload: {},
        },
      ],
    });
    expect(screen.getByText("Desktop")).toBeInTheDocument();
  });

  it("nameKey: resolusi config lewat property di dalam item.payload (fallback saat tidak ada di item langsung)", () => {
    renderTooltip({
      active: true,
      label: "Januari",
      nameKey: "seriesId",
      payload: [
        {
          dataKey: "raw_value",
          value: 42,
          payload: { seriesId: "mobile", month: "Jan" },
        },
      ],
    });
    expect(screen.getByText("Mobile")).toBeInTheDocument();
  });

  it("series yang key-nya tidak ada di config jatuh balik ke item.name mentah (tanpa label config)", () => {
    renderTooltip({
      active: true,
      label: "Januari",
      payload: [
        {
          dataKey: "unmapped",
          name: "unmapped-series",
          value: 7,
          payload: {},
        },
      ],
    });
    expect(screen.getByText("unmapped-series")).toBeInTheDocument();
  });

  it("nestLabel: payload 1 item + indicator!=='dot' -- label tetap dirender tepat sekali (nested di baris item)", () => {
    renderTooltip({
      active: true,
      label: "Januari",
      indicator: "line",
      payload: basePayload,
    });
    expect(screen.getAllByText("Januari")).toHaveLength(1);
  });

  it("menggabungkan className custom dengan default pada root tooltip", () => {
    const { container } = renderTooltip({
      active: true,
      label: "Januari",
      className: "custom-tooltip",
      payload: basePayload,
    });
    const root = container.querySelector(".custom-tooltip");
    expect(root).not.toBeNull();
    expect(root.className).toContain("shadow-xl");
  });

  it("forwardRef meneruskan ref ke elemen <div> root tooltip", () => {
    const ref = createRef();
    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          ref={ref}
          active
          label="Januari"
          payload={basePayload}
        />
      </ChartContainer>,
    );
    expect(ref.current).toBe(container.querySelector(".shadow-xl"));
  });
});

describe("ChartLegendContent", () => {
  const config = {
    revenue: { label: "Pendapatan", color: "#2563eb" },
    mobile: { label: "Mobile", color: "#222222" },
  };

  const renderLegend = (props, cfg = config) =>
    render(
      <ChartContainer config={cfg}>
        <ChartLegendContent {...props} />
      </ChartContainer>,
    );

  it("return null (tidak render apapun) saat payload kosong/undefined", () => {
    renderLegend({ payload: [] });
    expect(screen.queryByText("Pendapatan")).not.toBeInTheDocument();
  });

  it("merender label config utk tiap item payload, dengan swatch warna dari item.color", () => {
    const { container } = renderLegend({
      payload: [{ value: "revenue", dataKey: "revenue", color: "#2563eb" }],
    });
    expect(screen.getByText("Pendapatan")).toBeInTheDocument();
    const swatch = container.querySelector(".h-2.w-2.shrink-0.rounded-md");
    expect(swatch).not.toBeNull();
    expect(swatch.style.backgroundColor).toBe("rgb(37, 99, 235)"); // #2563eb
  });

  it("item dengan type='none' difilter (tidak ikut dirender)", () => {
    renderLegend({
      payload: [
        { value: "revenue", dataKey: "revenue", color: "#2563eb" },
        { value: "mobile", dataKey: "mobile", type: "none", color: "#222" },
      ],
    });
    expect(screen.getByText("Pendapatan")).toBeInTheDocument();
    expect(screen.queryByText("Mobile")).not.toBeInTheDocument();
  });

  it("hideIcon=true menyembunyikan itemConfig.icon dan kembali ke swatch warna default", () => {
    const cfgWithIcon = {
      revenue: {
        label: "Pendapatan",
        color: "#2563eb",
        icon: () => <svg data-testid="revenue-icon" />,
      },
    };
    const { container } = renderLegend(
      {
        hideIcon: true,
        payload: [{ value: "revenue", dataKey: "revenue", color: "#2563eb" }],
      },
      cfgWithIcon,
    );
    expect(screen.queryByTestId("revenue-icon")).not.toBeInTheDocument();
    expect(
      container.querySelector(".h-2.w-2.shrink-0.rounded-md"),
    ).not.toBeNull();
  });

  it("itemConfig.icon dirender menggantikan swatch warna saat hideIcon=false (default)", () => {
    const cfgWithIcon = {
      revenue: {
        label: "Pendapatan",
        color: "#2563eb",
        icon: () => <svg data-testid="revenue-icon" />,
      },
    };
    const { container } = renderLegend(
      { payload: [{ value: "revenue", dataKey: "revenue", color: "#2563eb" }] },
      cfgWithIcon,
    );
    expect(screen.getByTestId("revenue-icon")).toBeInTheDocument();
    expect(container.querySelector(".h-2.w-2.shrink-0.rounded-md")).toBeNull();
  });

  it("verticalAlign='top' menghasilkan className pb-3 (bukan pt-3)", () => {
    const { container } = renderLegend({
      verticalAlign: "top",
      payload: [{ value: "revenue", dataKey: "revenue", color: "#2563eb" }],
    });
    const root = container.querySelector(".gap-4");
    expect(root.className).toContain("pb-3");
    expect(root.className).not.toContain("pt-3");
  });

  it("verticalAlign='bottom' (default) menghasilkan className pt-3", () => {
    const { container } = renderLegend({
      payload: [{ value: "revenue", dataKey: "revenue", color: "#2563eb" }],
    });
    const root = container.querySelector(".gap-4");
    expect(root.className).toContain("pt-3");
  });

  it("nameKey: resolusi config lewat property BERNAMA nameKey (bukan dataKey/value default)", () => {
    renderLegend({
      nameKey: "seriesId",
      payload: [
        { seriesId: "mobile", value: "raw", dataKey: "raw", color: "#222" },
      ],
    });
    expect(screen.getByText("Mobile")).toBeInTheDocument();
  });

  it("menggabungkan className custom dengan default pada root legend", () => {
    const { container } = renderLegend({
      className: "custom-legend",
      payload: [{ value: "revenue", dataKey: "revenue", color: "#2563eb" }],
    });
    const root = container.querySelector(".custom-legend");
    expect(root).not.toBeNull();
    expect(root.className).toContain("justify-center");
  });

  it("forwardRef meneruskan ref ke elemen <div> root legend", () => {
    const ref = createRef();
    const { container } = render(
      <ChartContainer config={config}>
        <ChartLegendContent
          ref={ref}
          payload={[{ value: "revenue", dataKey: "revenue", color: "#2563eb" }]}
        />
      </ChartContainer>,
    );
    expect(ref.current).toBe(container.querySelector(".gap-4"));
  });
});
