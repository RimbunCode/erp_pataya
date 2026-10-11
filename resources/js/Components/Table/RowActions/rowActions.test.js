import { afterEach, describe, expect, it, vi } from "vitest";
import {
    DELETE_ACTION_KEY,
    buildDeleteAction,
    normalizeAction,
    partitionBulk,
    resolveRowActions,
    warnMissingRequires,
} from "./rowActions";

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe("normalizeAction", () => {
    it("mengisi default untuk field yang tidak diisi", () => {
        const onAction = vi.fn();
        const action = normalizeAction({ key: "a", label: "A", onAction });

        expect(action.key).toBe("a");
        expect(action.label).toBe("A");
        expect(action.onAction).toBe(onAction);
        expect(action.single).toBe(true);
        expect(action.bulk).toBe(false);
        expect(action.variant).toBe("default");
        expect(action.requires).toEqual([]);
        expect(action.confirm).toBeNull();
        expect(action.enabled({})).toBe(true);
    });

    it("tidak memutasi objek input", () => {
        const input = { key: "a", label: "A", onAction: vi.fn() };
        const snapshot = { ...input };

        const action = normalizeAction(input);

        expect(input).toEqual(snapshot);
        expect(input).not.toHaveProperty("single");
        expect(action).not.toBe(input);
    });

    it("mempertahankan nilai yang diberikan", () => {
        const enabled = (row) => row.ok === true;
        const action = normalizeAction({
            key: "b",
            label: "B",
            single: false,
            bulk: true,
            variant: "destructive",
            requires: ["ok"],
            confirm: { title: "T" },
            enabled,
            onAction: () => {},
        });

        expect(action.single).toBe(false);
        expect(action.bulk).toBe(true);
        expect(action.variant).toBe("destructive");
        expect(action.requires).toEqual(["ok"]);
        expect(action.confirm).toEqual({ title: "T" });
        expect(action.enabled).toBe(enabled);
    });
});

describe("resolveRowActions", () => {
    it("membuang aksi single:false dan aksi yang enabled(row) bernilai false", () => {
        const actions = [
            { key: "a", label: "A", onAction: () => {} },
            { key: "b", label: "B", single: false, onAction: () => {} },
            { key: "c", label: "C", enabled: (row) => row.ok, onAction: () => {} },
        ];

        const resolved = resolveRowActions(actions, { ok: false });

        expect(resolved.map((action) => action.key)).toEqual(["a"]);
    });

    it("mempertahankan urutan aksi", () => {
        const actions = [
            { key: "z", label: "Z", onAction: () => {} },
            { key: "m", label: "M", onAction: () => {} },
            { key: "a", label: "A", onAction: () => {} },
        ];

        const resolved = resolveRowActions(actions, { id: 1 });

        expect(resolved.map((action) => action.key)).toEqual(["z", "m", "a"]);
    });

    it("mengembalikan aksi yang sudah ter-normalisasi", () => {
        const resolved = resolveRowActions([{ key: "a", label: "A", onAction: () => {} }], { id: 1 });

        expect(resolved[0].variant).toBe("default");
        expect(resolved[0].requires).toEqual([]);
    });
});

describe("partitionBulk", () => {
    it("membagi baris menjadi eligible dan skipped sesuai enabled", () => {
        const action = normalizeAction({
            key: "retry",
            label: "Retry",
            bulk: true,
            enabled: (row) => row.canRetry === true,
            onAction: () => {},
        });
        const rows = [
            { id: "01A", canRetry: true },
            { id: "01B", canRetry: false },
            { id: "01C", canRetry: true },
        ];

        const { eligible, skipped } = partitionBulk(action, rows);

        expect(eligible).toEqual([rows[0], rows[2]]);
        expect(skipped).toEqual([rows[1]]);
    });

    it("semua baris eligible bila aksi tanpa enabled kustom", () => {
        const action = normalizeAction({ key: "a", label: "A", bulk: true, onAction: () => {} });
        const rows = [{ id: 1 }, { id: 2 }];

        const { eligible, skipped } = partitionBulk(action, rows);

        expect(eligible).toEqual(rows);
        expect(skipped).toEqual([]);
    });
});

describe("buildDeleteAction", () => {
    const makeOptions = (overrides = {}) => ({
        can: vi.fn(() => true),
        label: "Hapus",
        bulkDestroy: true,
        onSingle: vi.fn(),
        onBulk: vi.fn(),
        ...overrides,
    });

    it("mengembalikan aksi delete dengan key, variant, dan bulk sesuai kontrak", () => {
        const action = buildDeleteAction(makeOptions());

        expect(action.key).toBe(DELETE_ACTION_KEY);
        expect(DELETE_ACTION_KEY).toBe("__delete");
        expect(action.label).toBe("Hapus");
        expect(action.variant).toBe("destructive");
        expect(action.single).toBe(true);
        expect(action.bulk).toBe(true);
    });

    it("bulk mengikuti nilai bulkDestroy", () => {
        expect(buildDeleteAction(makeOptions({ bulkDestroy: false })).bulk).toBe(false);
        expect(buildDeleteAction(makeOptions({ bulkDestroy: undefined })).bulk).toBe(false);
    });

    it("enabled false bila row.canDelete === false", () => {
        const can = vi.fn(() => true);
        const action = buildDeleteAction(makeOptions({ can }));

        expect(action.enabled({ id: 1, canDelete: false, created_by_id: 7 })).toBe(false);
    });

    it("enabled memanggil can('delete', { user_id: created_by_id }) dan mengikuti hasilnya", () => {
        const can = vi.fn(() => false);
        const action = buildDeleteAction(makeOptions({ can }));

        const row = { id: 1, canDelete: true, created_by_id: 42 };

        expect(action.enabled(row)).toBe(false);
        expect(can).toHaveBeenCalledWith("delete", { user_id: 42 });
    });

    it("enabled true bila canDelete tidak diset dan can mengizinkan", () => {
        const action = buildDeleteAction(makeOptions({ can: () => true }));

        expect(action.enabled({ id: 1, created_by_id: 1 })).toBe(true);
    });

    it("onAction single memanggil onSingle dengan baris pertama", () => {
        const onSingle = vi.fn();
        const onBulk = vi.fn();
        const action = buildDeleteAction(makeOptions({ onSingle, onBulk }));
        const row = { id: 1 };

        action.onAction([row], { source: "single" });

        expect(onSingle).toHaveBeenCalledWith(row);
        expect(onBulk).not.toHaveBeenCalled();
    });

    it("onAction bulk dengan satu baris tetap memanggil onBulk", () => {
        const onSingle = vi.fn();
        const onBulk = vi.fn();
        const action = buildDeleteAction(makeOptions({ onSingle, onBulk }));
        const rows = [{ id: 1 }];

        action.onAction(rows, { source: "bulk" });

        expect(onBulk).toHaveBeenCalledWith(rows);
        expect(onSingle).not.toHaveBeenCalled();
    });

    it("onAction bulk dengan banyak baris memanggil onBulk dengan semua baris", () => {
        const onSingle = vi.fn();
        const onBulk = vi.fn();
        const action = buildDeleteAction(makeOptions({ onSingle, onBulk }));
        const rows = [{ id: 1 }, { id: 2 }];

        action.onAction(rows, { source: "bulk" });

        expect(onBulk).toHaveBeenCalledWith(rows);
        expect(onSingle).not.toHaveBeenCalled();
    });
});

describe("warnMissingRequires", () => {
    const retryAction = normalizeAction({
        key: "retry",
        label: "Retry",
        requires: ["canRetry"],
        onAction: () => {},
    });

    it("memberi peringatan sekali per aksi bila ada baris tanpa field yang dibutuhkan", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        warnMissingRequires([retryAction], [{ id: 1, canRetry: true }, { id: 2 }, { id: 3 }]);

        expect(warn).toHaveBeenCalledTimes(1);
        const message = warn.mock.calls[0].join(" ");
        expect(message).toContain("retry");
        expect(message).toContain("canRetry");
    });

    it("tidak memberi peringatan bila semua baris memiliki field yang dibutuhkan", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        warnMissingRequires([retryAction], [{ id: 1, canRetry: true }, { id: 2, canRetry: false }]);

        expect(warn).not.toHaveBeenCalled();
    });

    it("tidak memberi peringatan untuk aksi tanpa requires", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const plain = normalizeAction({ key: "plain", label: "P", onAction: () => {} });

        warnMissingRequires([plain], [{ id: 1 }]);

        expect(warn).not.toHaveBeenCalled();
    });

    it("tidak memberi peringatan pada build produksi", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.stubEnv("PROD", true);

        warnMissingRequires([retryAction], [{ id: 1 }]);

        expect(warn).not.toHaveBeenCalled();
    });
});
