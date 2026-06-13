import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { generateRandom, isNullOrWhitespace } from "@/lib/utils";

const createId = () => generateRandom(8);

const GROUP_KEY = "k";
const GROUP_CHILDREN = "c";
const ITEM_KEY = "k";
const ITEM_OPERATOR = "o";
const ITEM_VALUE = "v";

const createFilterItem = (overrides = {}) => ({
  [ITEM_KEY]: "",
  [ITEM_OPERATOR]: "",
  [ITEM_VALUE]: "",
  ...overrides,
});

const normalizeItem = (node) => ({
  [ITEM_KEY]: node?.[ITEM_KEY] ?? node?.key ?? "",
  [ITEM_OPERATOR]: node?.[ITEM_OPERATOR] ?? node?.operator ?? "",
  [ITEM_VALUE]: node?.[ITEM_VALUE] ?? node?.value ?? "",
});

const createFilterGroup = (children) => ({
  [GROUP_KEY]: "and",
  [GROUP_CHILDREN]: children ?? { [createId()]: createFilterItem() },
});

const isGroupNode = (node) => {
  return Boolean(
    node &&
    typeof node === "object" &&
    (GROUP_CHILDREN in node || "children" in node),
  );
};

const normalizeGroup = (group, isRoot = false) => {
  const children = {};
  const groupChildren = group?.[GROUP_CHILDREN] ?? group?.children;

  if (groupChildren && typeof groupChildren === "object") {
    for (const [id, node] of Object.entries(groupChildren)) {
      if (isGroupNode(node)) {
        const normalizedChild = normalizeGroup(node, false);
        if (Object.keys(normalizedChild[GROUP_CHILDREN]).length > 0) {
          children[id] = normalizedChild;
        }
      } else if (node) {
        children[id] = normalizeItem(node);
      }
    }
  }

  if (Object.keys(children).length === 0 && isRoot) {
    children[createId()] = createFilterItem();
  }

  return {
    [GROUP_KEY]: group?.[GROUP_KEY] ?? group?.key ?? "and",
    [GROUP_CHILDREN]: children,
  };
};

const normalizeFiltersState = (filters) => {
  const rootGroup =
    filters?.root && isGroupNode(filters.root)
      ? filters.root
      : createFilterGroup();

  const normalizedFilters = {
    root: normalizeGroup(rootGroup, true),
  };

  return collapseSingleChildGroups(normalizedFilters);
};

const buildFromFlatFilters = (flatFilters) => {
  if (!Array.isArray(flatFilters)) {
    return normalizeFiltersState();
  }

  const children = {};
  flatFilters.forEach((payload) => {
    if (!Array.isArray(payload) || payload.length < 3) return;
    const [key, operator, value] = payload;
    children[createId()] = normalizeItem({ key, operator, value });
  });

  return normalizeFiltersState({
    root: {
      [GROUP_KEY]: "and",
      [GROUP_CHILDREN]: children,
    },
  });
};

const normalizeInitialFilters = (initialFilters) => {
  if (Array.isArray(initialFilters)) {
    return buildFromFlatFilters(initialFilters);
  }

  if (initialFilters && typeof initialFilters === "object") {
    if (isGroupNode(initialFilters)) {
      return normalizeFiltersState({ root: initialFilters });
    }

    if (initialFilters.root && isGroupNode(initialFilters.root)) {
      return normalizeFiltersState(initialFilters);
    }
  }

  return normalizeFiltersState();
};

const getNodeById = (nodes, targetId) => {
  if (!nodes || !targetId) return null;

  for (const [id, node] of Object.entries(nodes)) {
    if (id === targetId) {
      return node;
    }

    if (isGroupNode(node)) {
      const found = getNodeById(node[GROUP_CHILDREN], targetId);
      if (found) return found;
    }
  }

  return null;
};

const findParentId = (nodes, targetId, parentId = null) => {
  if (!nodes || !targetId) return undefined;

  for (const [id, node] of Object.entries(nodes)) {
    if (id === targetId) {
      return parentId;
    }

    if (isGroupNode(node)) {
      const found = findParentId(node[GROUP_CHILDREN], targetId, id);
      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
};

const isOnlyChildOfRoot = (filters, targetId) => {
  const root = filters?.root;
  if (!root || !isGroupNode(root)) return false;

  const rootChildren = root[GROUP_CHILDREN] ?? {};
  const childIds = Object.keys(rootChildren);
  return childIds.length === 1 && childIds[0] === targetId;
};

const canWrapGroup = (filters, groupId) => {
  const node = getNodeById(filters, groupId);
  if (!node || !isGroupNode(node)) return false;

  // Root hanya boleh di-wrap bila punya lebih dari 1 child.
  if (groupId === "root") {
    return Object.keys(node[GROUP_CHILDREN] ?? {}).length > 1;
  }

  return true;
};

const updateNodeById = (nodes, targetId, updater) => {
  let updated = false;
  const result = {};

  for (const [id, node] of Object.entries(nodes)) {
    if (id === targetId) {
      result[id] = updater(node);
      updated = true;
      continue;
    }

    if (isGroupNode(node)) {
      const updatedChildren = updateNodeById(
        node[GROUP_CHILDREN],
        targetId,
        updater,
      );
      if (updatedChildren !== node[GROUP_CHILDREN]) {
        result[id] = { ...node, [GROUP_CHILDREN]: updatedChildren };
        updated = true;
        continue;
      }
    }

    result[id] = node;
  }

  return updated ? result : nodes;
};

const replaceNodeById = (nodes, targetId, replacement) => {
  return updateNodeById(nodes, targetId, () => replacement);
};

const addNodeToGroup = (nodes, groupId, nodeToAdd) => {
  let updated = false;
  const result = {};

  for (const [id, node] of Object.entries(nodes)) {
    if (id === groupId && isGroupNode(node)) {
      result[id] = {
        ...node,
        [GROUP_CHILDREN]: {
          ...node[GROUP_CHILDREN],
          [createId()]: nodeToAdd,
        },
      };
      updated = true;
      continue;
    }

    if (isGroupNode(node)) {
      const updatedChildren = addNodeToGroup(
        node[GROUP_CHILDREN],
        groupId,
        nodeToAdd,
      );
      if (updatedChildren !== node[GROUP_CHILDREN]) {
        result[id] = { ...node, [GROUP_CHILDREN]: updatedChildren };
        updated = true;
        continue;
      }
    }

    result[id] = node;
  }

  return updated ? result : nodes;
};

const removeNodeById = (nodes, targetId) => {
  let updated = false;
  const result = {};

  for (const [id, node] of Object.entries(nodes)) {
    if (id === targetId) {
      updated = true;
      continue;
    }

    if (isGroupNode(node)) {
      const updatedChildren = removeNodeById(node[GROUP_CHILDREN], targetId);
      if (updatedChildren !== node[GROUP_CHILDREN]) {
        result[id] = { ...node, [GROUP_CHILDREN]: updatedChildren };
        updated = true;
        continue;
      }
    }

    result[id] = node;
  }

  return updated ? result : nodes;
};

function collapseEntry(id, node) {
  if (!isGroupNode(node)) {
    return [[id, node]];
  }

  const collapsedChildren = collapseChildren(node[GROUP_CHILDREN]);
  const entries = Object.entries(collapsedChildren);

  if (entries.length === 0) {
    return [];
  }

  if (entries.length === 1) {
    const [childId, childNode] = entries[0];
    return collapseEntry(childId, childNode);
  }

  return [[id, { ...node, [GROUP_CHILDREN]: collapsedChildren }]];
}

function collapseChildren(children) {
  const result = {};

  for (const [id, node] of Object.entries(children ?? {})) {
    const entries = collapseEntry(id, node);
    for (const [entryId, entryNode] of entries) {
      result[entryId] = entryNode;
    }
  }

  return result;
}

function collapseSingleChildGroups(filters) {
  if (!filters?.root || !isGroupNode(filters.root)) {
    return filters;
  }

  let rootKey = filters.root[GROUP_KEY] ?? "and";
  let rootChildren = collapseChildren(filters.root[GROUP_CHILDREN]);

  let entries = Object.entries(rootChildren);
  while (entries.length === 1 && isGroupNode(entries[0][1])) {
    const onlyGroup = entries[0][1];
    rootKey = onlyGroup[GROUP_KEY] ?? rootKey;
    rootChildren = onlyGroup[GROUP_CHILDREN];
    entries = Object.entries(rootChildren);
  }

  return {
    root: {
      ...filters.root,
      [GROUP_KEY]: rootKey,
      [GROUP_CHILDREN]: rootChildren,
    },
  };
}

const isCompleteItem = (item) => {
  if (isNullOrWhitespace(item?.[ITEM_KEY])) return false;
  if (isNullOrWhitespace(item?.[ITEM_OPERATOR])) return false;

  const value = item?.[ITEM_VALUE];
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value === null || value === undefined) {
    return false;
  }

  return !isNullOrWhitespace(`${value}`);
};

const flattenFilters = (nodes) => {
  const results = [];

  const walk = (currentNodes) => {
    if (!currentNodes) return;

    for (const node of Object.values(currentNodes)) {
      if (isGroupNode(node)) {
        walk(node[GROUP_CHILDREN]);
      } else if (isCompleteItem(node)) {
        results.push([node[ITEM_KEY], node[ITEM_OPERATOR], node[ITEM_VALUE]]);
      }
    }
  };

  walk(nodes);
  return results;
};

// Kedalaman nesting yang dianggap wajar. Group pada depth >= nilai ini memicu
// peringatan (tetap diizinkan, tidak diblokir). Root = depth 0.
const MAX_NESTED_DEPTH = 3;

/**
 * Kedalaman group terdalam DI BAWAH `node` (termasuk node itu sendiri),
 * dihitung secara absolut dari `baseDepth`. Mis. node pada depth 1 dengan
 * cucu group menghasilkan 3. Dipakai untuk peringatan retrospektif per-node.
 */
const getSubtreeMaxDepth = (node, baseDepth = 0) => {
  if (!node || !isGroupNode(node)) return baseDepth;

  let max = baseDepth;
  for (const child of Object.values(node[GROUP_CHILDREN] ?? {})) {
    if (isGroupNode(child)) {
      max = Math.max(max, getSubtreeMaxDepth(child, baseDepth + 1));
    }
  }
  return max;
};

/**
 * Telusur seluruh tree dan kembalikan kedalaman group terdalam. Root = 0,
 * tiap group nested menambah 1. Dipakai untuk peringatan global.
 */
const getMaxDepth = (filters) => {
  const root = filters?.root;
  if (!root || !isGroupNode(root)) return 0;

  return getSubtreeMaxDepth(root, 0);
};

const NestedFiltersContext = createContext(null);

function NestedFiltersProvider({ initialFilters, columns, children }) {
  const [filters, setFilters] = useState(() =>
    normalizeInitialFilters(initialFilters),
  );
  const columnChildrenCacheRef = useRef({});

  useEffect(() => {
    columnChildrenCacheRef.current = {};
  }, [columns]);

  const setFromInitial = useCallback((value) => {
    setFilters(normalizeInitialFilters(value));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(normalizeFiltersState());
  }, []);

  const updateGroupKey = useCallback((id, key) => {
    setFilters((state) =>
      updateNodeById(state, id, (node) => {
        if (!isGroupNode(node)) return node;
        return { ...node, [GROUP_KEY]: key };
      }),
    );
  }, []);

  const updateItem = useCallback((id, payload) => {
    setFilters((state) =>
      updateNodeById(state, id, (node) => {
        if (isGroupNode(node)) return node;
        return { ...node, ...payload };
      }),
    );
  }, []);

  const addItemToGroup = useCallback((groupId) => {
    setFilters((state) => addNodeToGroup(state, groupId, createFilterItem()));
  }, []);

  const wrapGroupWithGroup = useCallback((groupId) => {
    setFilters((state) => {
      const node = getNodeById(state, groupId);
      if (!node || !isGroupNode(node)) return state;
      if (!canWrapGroup(state, groupId)) return state;

      const children = {
        [createId()]: node,
        [createId()]: createFilterItem(),
      };

      if (groupId === "root") {
        return { root: createFilterGroup(children) };
      }

      return replaceNodeById(state, groupId, createFilterGroup(children));
    });
  }, []);

  const wrapItemWithGroup = useCallback((id) => {
    setFilters((state) => {
      const node = getNodeById(state, id);
      if (!node || isGroupNode(node)) return state;
      if (isOnlyChildOfRoot(state, id)) return state;

      const children = {
        [createId()]: normalizeItem(node),
        [createId()]: createFilterItem(),
      };

      return replaceNodeById(state, id, createFilterGroup(children));
    });
  }, []);

  const removeNode = useCallback((id) => {
    setFilters((state) => {
      const node = getNodeById(state, id);
      // Cegah hapus satu-satunya item di root (minimal 1 filter harus ada).
      if (node && !isGroupNode(node) && isOnlyChildOfRoot(state, id)) {
        return state;
      }
      return normalizeFiltersState(removeNodeById(state, id));
    });
  }, []);

  const getCachedChildren = useCallback((path) => {
    if (!path) return undefined;
    return columnChildrenCacheRef.current[path];
  }, []);

  const setCachedChildren = useCallback((path, children) => {
    if (!path) return;
    columnChildrenCacheRef.current[path] = Array.isArray(children)
      ? children
      : [];
  }, []);

  const value = useMemo(
    () => ({
      columns,
      filters,
      setFromInitial,
      resetFilters,
      updateGroupKey,
      updateItem,
      addItemToGroup,
      wrapGroupWithGroup,
      wrapItemWithGroup,
      removeNode,
      getCachedChildren,
      setCachedChildren,
    }),
    [
      columns,
      filters,
      setFromInitial,
      resetFilters,
      updateGroupKey,
      updateItem,
      addItemToGroup,
      wrapGroupWithGroup,
      wrapItemWithGroup,
      removeNode,
      getCachedChildren,
      setCachedChildren,
    ],
  );

  return (
    <NestedFiltersContext.Provider value={value}>
      {children}
    </NestedFiltersContext.Provider>
  );
}

function useNestedFilters() {
  const context = useContext(NestedFiltersContext);
  if (!context) {
    throw new Error("useNestedFilters harus dipakai di NestedFiltersProvider.");
  }

  return context;
}

export {
  createFilterGroup,
  createFilterItem,
  canWrapGroup,
  flattenFilters,
  getMaxDepth,
  getSubtreeMaxDepth,
  getNodeById,
  isGroupNode,
  isOnlyChildOfRoot,
  MAX_NESTED_DEPTH,
  normalizeFiltersState,
  NestedFiltersProvider,
};

export default useNestedFilters;
