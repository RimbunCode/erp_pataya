import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "./ui/tooltip";
import LinkModel from "./LinkModel";

const { dialogProps, axiosPost } = vi.hoisted(() => ({
  dialogProps: vi.fn(),
  axiosPost: vi.fn(),
}));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { lang: "id", preferences: {} } }),
}));
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));
vi.mock("@/Pages/Core/FormPage", () => ({ FormPageDialog: () => null }));
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));
vi.mock("./LinkModel/AdvanceSearchDialog", () => ({
  default: (props) => {
    dialogProps(props);
    return null;
  },
}));

const warehouseModel = "App\\Models\\Inventory\\Warehouse";

async function mount(props) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={0}>
          <LinkModel model={warehouseModel} {...props} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.route = (name) => name;
  axiosPost.mockResolvedValue({
    data: { data: [], total: 0, current_page: 1, last_page: 1 },
  });
});

describe("LinkModel global branch context", () => {
  it.each([false, true])(
    "forwards includeGlobalBranch=%s when opening advanced search",
    async (includeGlobalBranch) => {
      const user = userEvent.setup();
      await mount({ includeGlobalBranch });
      await user.click(screen.getByRole("textbox"));
      await user.click(
        await screen.findByRole("option", {
          name: "core.form.linkmodel.advance_search",
        }),
      );
      expect(dialogProps.mock.calls.at(-1)[0]).toMatchObject({
        open: true,
        includeGlobalBranch,
      });
    },
  );

  it("keeps main-model global scope separate from advanced-search submodels", async () => {
    await mount({
      includeGlobalBranch: true,
      subModels: [{ model: "App\\Models\\Finances\\Tax", label: "Taxes" }],
    });
    const props = dialogProps.mock.calls.at(-1)[0];
    expect(props.sources[0]).toMatchObject({
      model: warehouseModel,
      includeGlobalBranch: true,
    });
    expect(props.sources[1]).toMatchObject({
      model: "App\\Models\\Finances\\Tax",
      includeGlobalBranch: false,
    });
  });

  it("retains global scope when resolving a default value by id", async () => {
    await mount({
      includeGlobalBranch: true,
      defaultValue: { id: "other-branch-warehouse" },
    });
    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({
          includeGlobalBranch: true,
          filters: { id: "other-branch-warehouse" },
        }),
      ),
    );
  });
});
