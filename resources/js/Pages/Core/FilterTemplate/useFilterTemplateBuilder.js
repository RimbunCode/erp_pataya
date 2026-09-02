import { useCallback, useEffect, useState } from "react";

import axios from "axios";
import useNestedFilters from "@/Hooks/useNestedFilters";

/**
 * Daftar saved filter (private+shared) untuk model terpilih — dipakai field
 * "Import dari filter lain". Memuat tree yang dipilih ke builder (via
 * setFromInitial) sekaligus ke state form Inertia.
 * @param {string} modelClass
 */
export default function useFilterTemplateBuilder(modelClass) {
  const { setFromInitial } = useNestedFilters();
  const [importItems, setImportItems] = useState([]);
  const [loadingImport, setLoadingImport] = useState(false);

  useEffect(() => {
    if (!modelClass) {
      setImportItems([]);
      return;
    }
    setLoadingImport(true);
    axios
      .get(window.route("saved-filters.index"), {
        params: { model: modelClass },
      })
      .then((res) => setImportItems(res.data?.data ?? res.data ?? []))
      .catch(() => setImportItems([]))
      .finally(() => setLoadingImport(false));
  }, [modelClass]);

  const applyImport = useCallback(
    (picked, setData) => {
      if (!picked?.filter) return;
      setFromInitial(picked.filter);
      setData((prev) => ({ ...prev, filter: picked.filter }));
    },
    [setFromInitial],
  );

  return { importItems, loadingImport, applyImport };
}
