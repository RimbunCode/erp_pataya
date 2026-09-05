import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

vi.mock("./FilterGroup2", () => ({
  default: ({ id }) => <div data-testid={`group-${id}`} />,
}));

import FilterBuilder from "./FilterBuilder";

describe("FilterBuilder", () => {
  it("render FilterGroup2 untuk root", () => {
    render(<FilterBuilder columns={{}} />);
    expect(screen.getByTestId("group-root")).toBeInTheDocument();
  });

  it("onChange dipanggil sekali saat mount dengan filter state awal", () => {
    const onChange = vi.fn();
    render(<FilterBuilder columns={{}} onChange={onChange} />);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ root: expect.any(Object) }),
    );
  });

  it("klik 'Clear Filters' memanggil resetFilters (onChange terpanggil ulang)", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<FilterBuilder columns={{}} onChange={onChange} />);

    onChange.mockClear();
    await user.click(
      screen.getByText("TR:core.datatable.filter.clear_filters"),
    );

    expect(onChange).toHaveBeenCalled();
  });

  it("TIDAK menampilkan banner peringatan depth untuk filter dangkal", () => {
    render(<FilterBuilder columns={{}} />);
    expect(screen.queryByText(/depth_warning\.banner/)).not.toBeInTheDocument();
  });

  it("menampilkan banner peringatan depth untuk filter yang sangat nested", () => {
    // MAX_NESTED_DEPTH = 3 (lihat useNestedFilters.js) -- buat tree 3 level nested.
    const deepValue = {
      root: {
        k: "and",
        c: {
          g1: {
            k: "or",
            c: {
              g2: {
                k: "and",
                c: {
                  g3: {
                    k: "or",
                    c: {
                      a: { k: "f", o: "=", v: "1" },
                      b: { k: "g", o: "=", v: "2" },
                    },
                  },
                  c: { k: "h", o: "=", v: "3" },
                },
              },
              d: { k: "i", o: "=", v: "4" },
            },
          },
          e: { k: "j", o: "=", v: "5" },
        },
      },
    };
    render(<FilterBuilder columns={{}} value={deepValue} />);
    expect(
      screen.getByText(
        'TR:core.datatable.filter.depth_warning.banner:{"max":3}',
      ),
    ).toBeInTheDocument();
  });
});
