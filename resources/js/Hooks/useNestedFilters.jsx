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

const createFilterItem = (overrides = {}) => ({
  key: "",
  operator: "",
  value: "",
  ...overrides,
});

const normalizeItem = (node) => ({
  key: node?.key ?? "",
  operator: node?.operator ?? "",
  value: node?.value ?? "",
});

const createFilterGroup = (children) => ({
  key: "and",
  children: children ?? { [createId()]: createFilterItem() },
});

const isGroupNode = (node) => {
  return Boolean(node && typeof node === "object" && "children" in node);
};

const normalizeGroup = (group, isRoot = false) => {
  const children = {};

  if (group?.children && typeof group.children === "object") {
    for (const [id, node] of Object.entries(group.children)) {
      if (isGroupNode(node)) {
        const normalizedChild = normalizeGroup(node, false);
        if (Object.keys(normalizedChild.children).length > 0) {
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
    key: group?.key ?? "and",
    children,
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
      key: "and",
      children,
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
      const found = getNodeById(node.children, targetId);
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
      const found = findParentId(node.children, targetId, id);
      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
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
      const updatedChildren = updateNodeById(node.children, targetId, updater);
      if (updatedChildren !== node.children) {
        result[id] = { ...node, children: updatedChildren };
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
        children: {
          ...node.children,
          [createId()]: nodeToAdd,
        },
      };
      updated = true;
      continue;
    }

    if (isGroupNode(node)) {
      const updatedChildren = addNodeToGroup(node.children, groupId, nodeToAdd);
      if (updatedChildren !== node.children) {
        result[id] = { ...node, children: updatedChildren };
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
      const updatedChildren = removeNodeById(node.children, targetId);
      if (updatedChildren !== node.children) {
        result[id] = { ...node, children: updatedChildren };
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

  const collapsedChildren = collapseChildren(node.children);
  const entries = Object.entries(collapsedChildren);

  if (entries.length === 0) {
    return [];
  }

  if (entries.length === 1) {
    const [childId, childNode] = entries[0];
    return collapseEntry(childId, childNode);
  }

  return [[id, { ...node, children: collapsedChildren }]];
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

  return {
    root: {
      ...filters.root,
      children: collapseChildren(filters.root.children),
    },
  };
}

const isCompleteItem = (item) => {
  if (isNullOrWhitespace(item?.key)) return false;
  if (isNullOrWhitespace(item?.operator)) return false;

  const value = item?.value;
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
        walk(node.children);
      } else if (isCompleteItem(node)) {
        results.push([node.key, node.operator, node.value]);
      }
    }
  };

  walk(nodes);
  return results;
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
        return { ...node, key };
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

  const addGroupToGroup = useCallback((groupId) => {
    setFilters((state) =>
      addNodeToGroup(
        state,
        groupId,
        createFilterGroup({
          [createId()]: createFilterItem(),
          [createId()]: createFilterItem(),
        }),
      ),
    );
  }, []);

  const addSiblingItem = useCallback((id) => {
    setFilters((state) => {
      const parentId = findParentId(state, id);
      if (!parentId) return state;
      return addNodeToGroup(state, parentId, createFilterItem());
    });
  }, []);

  const wrapItemWithGroup = useCallback((id) => {
    setFilters((state) => {
      const node = getNodeById(state, id);
      if (!node || isGroupNode(node)) return state;

      const children = {
        [createId()]: normalizeItem(node),
        [createId()]: createFilterItem(),
      };

      return replaceNodeById(state, id, createFilterGroup(children));
    });
  }, []);

  const removeNode = useCallback((id) => {
    setFilters((state) => normalizeFiltersState(removeNodeById(state, id)));
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
      addGroupToGroup,
      addSiblingItem,
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
      addGroupToGroup,
      addSiblingItem,
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
  flattenFilters,
  getNodeById,
  isGroupNode,
  normalizeFiltersState,
  NestedFiltersProvider,
};

export default useNestedFilters;
