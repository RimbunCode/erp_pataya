import { describe, expect, it, vi } from "vitest";

const authUserId = 1;
const otherUserId = 2;

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({
    props: {
      permissions: {
        User: {
          0: [
            {
              model: "User",
              level: 0,
              only_creator: true,
              permissions: { write: true, delete: true },
            },
          ],
        },
      },
      auth: { user: { id: authUserId } },
    },
  }),
}));

const { default: usePermission } = await import("./usePermission");

describe("usePermission with only_creator restriction", () => {
  it("allows write when options carries the creator's user_id", () => {
    const { can } = usePermission("User");

    expect(can("write", { user_id: authUserId })).toBe(true);
  });

  it("denies write for a non-creator user_id", () => {
    const { can } = usePermission("User");

    expect(can("write", { user_id: otherUserId })).toBe(false);
  });

  it("denies write when options collapses to false instead of an object", () => {
    // Reproduksi bug: `submitable && { user_id }` menjadi `false` saat
    // submitable bernilai false, sehingga user_id ikut hilang meski dia
    // adalah pembuat data.
    const submitable = false;
    const { can } = usePermission("User");

    expect(can("write", submitable && { user_id: authUserId })).toBe(false);
  });
});
