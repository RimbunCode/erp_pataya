// useLiveDraft — draft LANGSUNG (spec datatable2-column-search-row, Requirement
// 14): ketikan/chip sesi nilai yang sudah membentuk leaf valid ditulis ke draft
// bersama (`useSearchDraft`) pada tiap perubahan (debounce ringan), TANPA
// meng-apply ke host. Akibatnya chip Search Bar atas dan badge sel kolom berubah
// saat mengetik di salah satunya. Apply tetap lewat Enter / tombol Search.
//
// Tiap sesi hanya menyentuh LEAF MILIKNYA (dilacak lewat id), bukan snapshot
// seluruh tree, sehingga beberapa sel yang sedang mengetik bergantian tidak
// saling menimpa:
//  - sesi baru: leaf sementara ditambahkan (tanpa merge) lalu diperbarui di
//    tempat pada tiap ketukan; ketikan tak valid (mis. `>`) menghapusnya;
//  - sesi edit leaf: leaf asli diperbarui di tempat, node aslinya disimpan;
//  - sesi berakhir TANPA commit (Escape, Backspace-keluar, edit dibatalkan):
//    leaf sementara dihapus / leaf asli dikembalikan -- draft kembali ke
//    kondisi sebelum sesi;
//  - commit memakai `baseFor(draft)` supaya leaf sementara tidak ikut ganda.
//
// Dipakai dalam dua langkah karena `onCommit` hook nilai butuh `baseFor`
// SEBELUM controller nilai ada: `useLiveDraftState(draft)` dulu, lalu
// `useLiveDraftSync({live, value})` sesudah `useColumnValueInput`.

import { addLeafChip, removeChip, updateChip } from "./searchChips";
import { useCallback, useEffect, useRef, useState } from "react";

// Jeda tulis ke draft: mengetik cepat tidak merender ulang seluruh tabel
// (DataTable2 ikut render saat draft berubah) di setiap ketukan.
const LIVE_DEBOUNCE_MS = 150;

const IDLE = {
  leafId: null,
  edit: false,
  original: null,
  sig: null,
  committed: false,
};

const hasLeaf = (tree, id) =>
  Boolean(id) && Boolean((tree?.root ?? tree)?.c?.[id]);

// Id leaf sementara yang baru ditambahkan (bukan edit): kunci anak-root baru
// (atau, bila root OR dibungkus, node baru ber-k/o sama dgn patch).
const findNewLeafId = (before, next, patch) => {
  const old = before?.root?.c ?? {};
  const entries = Object.entries(next?.root?.c ?? {}).filter(
    ([id]) => !(id in old),
  );
  const hit =
    entries.find(([, n]) => !n.c && n.k === patch.k && n.o === patch.o) ??
    entries[0];
  return hit ? hit[0] : null;
};

/**
 * @param {object} draft draft host (`useSearchDraft`)
 * @returns {{
 *   draft: object,
 *   stateRef: {current: object},
 *   liveLeafId: string|null,
 *   setLiveLeafId: (id: string|null) => void,
 *   baseFor: (current: object|null) => object|null,
 *   markCommitted: () => void,
 * }}
 */
export function useLiveDraftState(draft) {
  const stateRef = useRef(IDLE);
  const [liveLeafId, setLiveLeafId] = useState(null);

  // Tree dasar utk commit: bila sesi baru punya leaf sementara di draft,
  // buang dulu (commit menambahkan leaf final sendiri). Sesi edit: apa adanya
  // (commit memperbarui leaf yang sama lewat `updateChip`).
  const baseFor = useCallback((current) => {
    const s = stateRef.current;
    if (s.leafId && !s.edit && hasLeaf(current, s.leafId)) {
      return removeChip(current, s.leafId);
    }
    return current;
  }, []);
  const markCommitted = useCallback(() => {
    stateRef.current = { ...stateRef.current, committed: true };
  }, []);

  return { draft, stateRef, liveLeafId, setLiveLeafId, baseFor, markCommitted };
}

/**
 * @param {object} p
 * @param {ReturnType<typeof useLiveDraftState>} p.live
 * @param {object} p.value controller `useColumnValueInput`
 * @param {boolean} [p.enabled] false = tak melakukan apa pun (mode tak terkontrol)
 * @param {number} [p.debounceMs]
 */
export function useLiveDraftSync({
  live,
  value,
  enabled = true,
  debounceMs = LIVE_DEBOUNCE_MS,
}) {
  const { draft, stateRef, setLiveLeafId } = live;
  const { valueColumn, editingLeafId, computeCheckedLeafPatch, exitValueMode } =
    value;
  const { draftTree, draftTreeRef, setDraftTree } = draft;

  useEffect(() => {
    if (!enabled) return undefined;
    const s = stateRef.current;

    // Sesi berakhir: bila TIDAK di-commit, kembalikan draft ke kondisi sebelum
    // sesi (hapus leaf sementara / kembalikan node asli).
    if (!valueColumn) {
      if (s.leafId) {
        const cur = draftTreeRef.current;
        if (!s.committed && hasLeaf(cur, s.leafId)) {
          setDraftTree(
            s.edit
              ? updateChip(cur, s.leafId, s.original)
              : removeChip(cur, s.leafId),
          );
        }
        stateRef.current = IDLE;
        setLiveLeafId(null);
      } else if (s.committed) {
        stateRef.current = IDLE;
      }
      return undefined;
    }

    const timer = setTimeout(() => {
      const patch = computeCheckedLeafPatch({ withTyped: true });
      const cur = draftTreeRef.current;
      const st = stateRef.current;
      const sig = JSON.stringify([patch, editingLeafId]);
      const present = hasLeaf(cur, st.leafId);
      // Leaf sementara HILANG dari draft = draft diganti dari luar (Builder,
      // saved filter, addFilter, apply host): sesi ini basi -- batalkan, jangan
      // menyuntikkan ketikan lama ke tree pengganti.
      if (st.leafId && !present) {
        stateRef.current = IDLE;
        setLiveLeafId(null);
        exitValueMode();
        return;
      }
      if (present && sig === st.sig) return;

      // Ketikan belum valid: batalkan tulisan sementara sebelumnya.
      if (!patch) {
        if (present) {
          setDraftTree(
            st.edit
              ? updateChip(cur, st.leafId, st.original)
              : removeChip(cur, st.leafId),
          );
        }
        stateRef.current = IDLE;
        setLiveLeafId(null);
        return;
      }

      if (editingLeafId) {
        const node = cur?.root?.c?.[editingLeafId];
        if (!node) return; // leaf asli hilang (draft diganti pihak lain)
        const original = present && st.edit ? st.original : { ...node };
        setDraftTree(updateChip(cur, editingLeafId, patch));
        stateRef.current = {
          leafId: editingLeafId,
          edit: true,
          original,
          sig,
          committed: false,
        };
        setLiveLeafId(editingLeafId);
        return;
      }

      let next;
      let id;
      if (present && !st.edit) {
        next = updateChip(cur, st.leafId, patch);
        id = st.leafId;
      } else {
        next = addLeafChip(cur, patch, { merge: false });
        id = findNewLeafId(cur, next, patch);
      }
      if (!id) return;
      setDraftTree(next);
      stateRef.current = {
        leafId: id,
        edit: false,
        original: null,
        sig,
        committed: false,
      };
      setLiveLeafId(id);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [
    enabled,
    valueColumn,
    editingLeafId,
    computeCheckedLeafPatch,
    draftTree,
    debounceMs,
    draftTreeRef,
    setDraftTree,
    setLiveLeafId,
    stateRef,
    exitValueMode,
  ]);

  // Sel/Search Bar di-unmount (kolom disembunyikan, pindah ke tampilan mobile)
  // saat masih ada leaf sementara: rollback seperti sesi berakhir tanpa commit,
  // supaya kondisi yang tak punya input lagi tidak ter-apply dari draft.
  const latest = useRef({ enabled, draft, stateRef, setLiveLeafId });
  latest.current = { enabled, draft, stateRef, setLiveLeafId };
  useEffect(
    () => () => {
      const { enabled: on, draft: d, stateRef: ref } = latest.current;
      if (!on) return;
      const s = ref.current;
      if (!s.leafId || s.committed) return;
      const cur = d.draftTreeRef.current;
      if (hasLeaf(cur, s.leafId)) {
        d.setDraftTree(
          s.edit
            ? updateChip(cur, s.leafId, s.original)
            : removeChip(cur, s.leafId),
        );
      }
      ref.current = IDLE;
    },
    [],
  );
}
