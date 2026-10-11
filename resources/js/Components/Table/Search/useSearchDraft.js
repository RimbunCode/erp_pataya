// useSearchDraft — state draft (staged-apply) Search Bar, diangkat dari
// `SearchBar.jsx` supaya BISA dimiliki host dan dipakai bersama oleh Search Bar
// atas dan Baris Filter Kolom (spec datatable2-column-search-row, Requirement
// 7.3-7.7). Semantik TIDAK berubah dari model staged-apply lama (spec
// datatable2-advanced-search revisi 3, design.md §11): aksi chip/kolom hanya
// mengubah draft; `applyDraft()` adalah SATU-SATUNYA jalur yang benar2
// memanggil `onTreeChange`/`onGroupChange`/`onPickSaved` ke host. Pengecualian
// tetap sama: Chip Cari (teks bebas) memakai `commitTree` langsung.

import { isFilterTreeDirty } from "../Filter/filterTreeCompare";
import {
  normalizeGroupLevels,
  sameGroups,
} from "@/Components/Table/Group/groupLevels";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * @param {object} p
 * @param {object|null} p.tree filterTree TERAPAN milik host (controlled)
 * @param {Array} [p.group] `Groups` terapan
 * @param {(tree: object|null) => void|Promise<void>} p.onTreeChange transport
 *   milik host; boleh return Promise (busy state)
 * @param {(groups: Array) => void} [p.onGroupChange]
 * @param {(saved: object) => void} [p.onPickSaved]
 * @returns {{
 *   draftTree: object|null,
 *   setDraftTree: (next: object|null|((prev: object|null) => object|null)) => void,
 *   draftGroup: Array,
 *   setDraftGroup: (next: Array|((prev: Array) => Array)) => void,
 *   pendingSaved: object|null,
 *   setPendingSaved: (saved: object|null) => void,
 *   busy: boolean,
 *   commitTree: (tree: object|null) => Promise<void>,
 *   applyDraft: (treeOverride?: object|null) => void,
 *   commitTreeChange: (updater: (draft: object|null) => object|null) => Promise<void>,
 *   isDraftDirty: boolean,
 * }}
 */
export default function useSearchDraft({
  tree,
  group,
  onTreeChange,
  onGroupChange,
  onPickSaved,
}) {
  const [draftTree, setDraftTreeState] = useState(tree);
  // Cermin SINKRON `draftTree`: dua commit beruntun (mis. dua sel kolom) dalam
  // satu tick tidak boleh membaca closure basi -- `setState` baru ter-render
  // sesudahnya (aturan yang sama dgn parameter `treeOverride` di `applyDraft`).
  const draftTreeRef = useRef(tree);
  const setDraftTree = useCallback((next) => {
    const value =
      typeof next === "function" ? next(draftTreeRef.current) : next;
    draftTreeRef.current = value;
    setDraftTreeState(value);
  }, []);
  const [draftGroup, setDraftGroup] = useState(() =>
    normalizeGroupLevels(group),
  );
  // Saved filter yang DIPILIH tapi belum di-apply -- `onPickSaved` (host)
  // baru dipanggil saat applyDraft(), bukan saat dipilih.
  const [pendingSaved, setPendingSaved] = useState(null);
  useEffect(() => {
    setDraftTree(tree);
  }, [tree, setDraftTree]);
  useEffect(() => {
    setDraftGroup(normalizeGroupLevels(group));
  }, [group]);

  // --- Commit tree: busy state + tolak commit baru saat Promise pending
  // (Requirement 15.1-15.2 spec lama). -----------------------------------
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const commitTree = useCallback(
    (nextTree) => {
      if (busyRef.current) return Promise.reject(new Error("busy"));
      const result = onTreeChange?.(nextTree);
      if (result && typeof result.then === "function") {
        busyRef.current = true;
        setBusy(true);
        return result.finally(() => {
          busyRef.current = false;
          setBusy(false);
        });
      }
      return Promise.resolve(result);
    },
    [onTreeChange],
  );

  // `treeOverride` (revisi 6, Requirement 27.3 jalur klik-luar): nilai tree
  // SINKRON dipakai gantinya state `draftTree` -- `setDraftTree` yg baru
  // dipanggil detik yg sama belum ter-render ulang, jadi baca `draftTree`
  // langsung di sini masih dapat versi LAMA. `ignorePending` hanya dipakai
  // `commitTreeChange` (lihat di sana).
  const applyDraft = useCallback(
    (treeOverride, { ignorePending = false, rollback = null } = {}) => {
      if (busyRef.current) return;
      if (pendingSaved && !ignorePending) {
        onPickSaved?.(pendingSaved);
        setPendingSaved(null);
        return;
      }
      const nextTree = treeOverride !== undefined ? treeOverride : draftTree;
      const treeChanged = isFilterTreeDirty(tree, nextTree);
      const groupChanged = !sameGroups(group, draftGroup);
      if (!treeChanged && !groupChanged) return;
      if (treeChanged) {
        commitTree(nextTree).catch((error) => {
          // Search Bar atas: apply gagal membiarkan draft utk dicoba lagi
          // (perilaku lama, ada tesnya). Commit dari Sel Filter memberi
          // `rollback`: batalkan HANYA perubahan sel itu supaya badge yang
          // gagal tak tampil padahal tabel masih memakai filter lama (draft
          // lain, mis. chip atas yang belum di-apply, tetap utuh). Penolakan
          // karena host SIBUK bukan kegagalan.
          if (!rollback || error?.message === "busy") return;
          if (draftTreeRef.current === rollback.from) setDraftTree(rollback.to);
        });
      }
      if (groupChanged) onGroupChange?.(draftGroup);
    },
    [
      pendingSaved,
      onPickSaved,
      tree,
      draftTree,
      group,
      draftGroup,
      commitTree,
      onGroupChange,
      setDraftTree,
    ],
  );

  /**
   * Ubah draft lewat `updater` lalu apply SELURUH draft (tree + group) -- jalur
   * commit Sel Filter kolom (Requirement 7.4): chip Search Bar atas yang belum
   * di-apply ikut ter-apply, tak ada kondisi yang hilang. Menolak (reject
   * "busy") selagi commit sebelumnya berjalan.
   *
   * Bila ada `pendingSaved` (saved filter dipilih tapi belum di-apply), draft
   * tree-nya SUDAH = filter saved itu; commit sel lalu di-apply sbg tree biasa
   * (filter ephemeral baru) dan `pendingSaved` dilepas -- jalur `onPickSaved`
   * akan mengaktifkan saved filter ASLI (fid-nya) dan membuang edit sel.
   * @param {(draft: object|null) => object|null} updater
   * @returns {Promise<void>}
   */
  const commitTreeChange = useCallback(
    (updater) => {
      if (busyRef.current) return Promise.reject(new Error("busy"));
      const previous = draftTreeRef.current;
      const next = updater(previous);
      setDraftTree(next);
      const hadPending = Boolean(pendingSaved);
      if (hadPending) setPendingSaved(null);
      applyDraft(next, {
        ignorePending: hadPending,
        rollback: { from: next, to: previous },
      });
      return Promise.resolve();
    },
    [applyDraft, pendingSaved, setDraftTree],
  );

  const isDraftDirty =
    Boolean(pendingSaved) ||
    isFilterTreeDirty(tree, draftTree) ||
    !sameGroups(group, draftGroup);

  return {
    draftTree,
    draftTreeRef,
    setDraftTree,
    draftGroup,
    setDraftGroup,
    pendingSaved,
    setPendingSaved,
    busy,
    commitTree,
    applyDraft,
    commitTreeChange,
    isDraftDirty,
  };
}
