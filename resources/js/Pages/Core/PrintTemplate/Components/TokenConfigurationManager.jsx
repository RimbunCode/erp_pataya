import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor } from "@grapesjs/react";
import { usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import axios from "axios";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/Components/ui/accordion";
import { Button } from "@/Components/ui/button";
import { FormCheckbox } from "@/Components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import NestedSelect from "@/Components/NestedSelect";
import { ChevronDownIcon, GripVerticalIcon, Trash2Icon } from "lucide-react";
import { buildExampleDataTable } from "@/lib/gjsRelationsTable";
import {
  buildTreeOptions,
  filterTokenOptions,
  filterRelationPathOptions,
  formatTokenLabel,
  generateRelationToken,
  simplifyTokenDisplay,
} from "./tokenConfigHelpers";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/Components/ui/collapsible";

function createId(prefix = "g") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function decodeTokenFromBase64(base64Token) {
  if (!base64Token || typeof window === "undefined") {
    return "";
  }

  try {
    const binary = window.atob(base64Token);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function encodeTokenToBase64(token) {
  if (!token || typeof window === "undefined") {
    return "";
  }

  try {
    const bytes = new TextEncoder().encode(token);
    const binary = String.fromCharCode(...bytes);
    return window.btoa(binary);
  } catch {
    return "";
  }
}

function stripDocPrefix(variablePath = "") {
  return variablePath.replace(/^doc\./, "");
}

function getVariableTokenConfiguration(component) {
  if (!component) {
    return null;
  }

  const attributes = component.getAttributes?.() || {};

  if (attributes["data-variable-inline"]) {
    const inlineToken =
      attributes["data-token"] ||
      decodeTokenFromBase64(attributes["data-token-b64"]);

    return {
      kind: "inline",
      component,
      componentId: component.cid ?? component.getId?.() ?? "",
      variablePath:
        attributes["data-variable-inline"] ||
        attributes["data-variable-path"] ||
        "",
      variableType: "inline",
      token: inlineToken,
      labelKey: "",
      labelComponent: null,
      tokenComponent: component,
      previewValue: simplifyTokenDisplay(inlineToken),
    };
  }

  const tokenComponent = Array.from(component.find?.("[data-token]") || [])[0];
  const labelComponent = Array.from(
    component.find?.("[data-label-key]") || [],
  )[0];

  const tokenAttributes = tokenComponent?.getAttributes?.() || {};
  const labelAttributes = labelComponent?.getAttributes?.() || {};

  const previewContent = tokenComponent?.get?.("content");

  return {
    kind: "variable",
    component,
    componentId: component.cid ?? component.getId?.() ?? "",
    variablePath: attributes["data-variable"] || "",
    variableType: attributes["data-variable-type"] || "data",
    token: tokenAttributes["data-token"] || "",
    labelKey: labelAttributes["data-label-key"] || "",
    labelComponent,
    tokenComponent,
    previewValue:
      typeof previewContent === "string"
        ? previewContent.replace(/^:\s*/, "").trim()
        : simplifyTokenDisplay(tokenAttributes["data-token"] || ""),
  };
}
function findTokenComponent(component) {
  if (!component) {
    return null;
  }

  const attributes = component.getAttributes?.() || {};
  if (attributes["data-token"]) {
    return component;
  }

  const results = component.find?.("[data-token]");
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}

function findLabelComponent(component) {
  if (!component) {
    return null;
  }

  const attributes = component.getAttributes?.() || {};
  if (attributes["data-label-key"]) {
    return component;
  }

  const results = component.find?.("[data-label-key]");
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}
function findVariableComponent(component) {
  let current = component;

  while (current) {
    const attributes = current.getAttributes?.() || {};
    if (attributes["data-variable"] || attributes["data-variable-inline"]) {
      return current;
    }

    current = current.parent?.();
  }

  return null;
}

function collectCanvasTokenConfigurations(editor) {
  if (!editor) {
    return [];
  }

  const wrapper = editor.getWrapper?.();
  if (!wrapper) {
    return [];
  }

  const variableComponents = Array.from(
    wrapper.find?.("[data-variable]") || [],
  );
  const inlineComponents = Array.from(
    wrapper.find?.("[data-variable-inline]") || [],
  );

  const configs = [...variableComponents, ...inlineComponents]
    .map((component) => getVariableTokenConfiguration(component))
    .filter(Boolean);

  return configs.sort((left, right) =>
    (left.variablePath || "").localeCompare(right.variablePath || ""),
  );
}

function collectCanvasLabelConfigurations(editor) {
  if (!editor) {
    return [];
  }

  const wrapper = editor.getWrapper?.();
  if (!wrapper) {
    return [];
  }

  const labelComponents = Array.from(wrapper.find?.("[data-label-key]") || []);

  return labelComponents
    .map((component) => {
      const attributes = component.getAttributes?.() || {};
      const labelKey = attributes["data-label-key"] || "";
      const componentId = component.cid ?? component.getId?.() ?? "";

      // Check if parent has data-variable
      let parentVariablePath = "";
      let parentComponent = component.parent?.();
      while (parentComponent) {
        const parentAttributes = parentComponent.getAttributes?.() || {};
        if (parentAttributes["data-variable"]) {
          parentVariablePath = parentAttributes["data-variable"];
          break;
        }
        parentComponent = parentComponent.parent?.();
      }

      return {
        component,
        componentId,
        labelKey,
        parentVariablePath,
        displayLabel: attributes["title"] || labelKey || "-",
      };
    })
    .filter((config) => config.labelKey)
    .sort((left, right) =>
      (left.labelKey || "").localeCompare(right.labelKey || ""),
    );
}

function collectRelationTokenConfigurations(editor) {
  if (!editor) {
    return [];
  }

  const wrapper = editor.getWrapper?.();
  if (!wrapper) {
    return [];
  }

  const relationComponents = Array.from(
    wrapper.find?.("[data-relations]") || [],
  ).filter((component) => component.getType?.() === "gjsRelationsTable");

  return relationComponents.map((component) => {
    const attributes = component.getAttributes?.() || {};
    const relationPath = attributes["data-relations"] || "";
    const columns = component.get("columnsConfig") || [];

    return {
      component,
      componentId: component.cid ?? component.getId?.() ?? "",
      relationPath,
      token: relationPath
        ? `{{#each ${relationPath}}} ... {{/each}}`
        : "{{#each relation}} ... {{/each}}",
      columns,
    };
  });
}

function resolveRelationNodeByPath(dataTableColumns, relationPath = "") {
  if (!Array.isArray(dataTableColumns) || !relationPath) {
    return null;
  }

  const normalizedPath = relationPath.replace(/^doc\./, "");
  const segments = normalizedPath
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return null;
  }

  let currentColumns =
    dataTableColumns.find((column) => column.type === "doc")?.columns || [];
  let currentNode = null;

  for (const segment of segments) {
    currentNode = currentColumns.find((column) => column.name === segment);
    if (!currentNode) {
      return null;
    }

    currentColumns = Array.isArray(currentNode.columns)
      ? currentNode.columns
      : [];
  }

  return currentNode;
}

function mergeRelationColumns(latestColumns, currentColumns = []) {
  const currentMap = new Map(
    (currentColumns || []).map((column) => [column.name, column]),
  );

  return (latestColumns || [])
    .map((column, index) => {
      const previous = currentMap.get(column.name);
      const order = previous?.order ?? column.order ?? index;
      const show = column.required ? true : (previous?.show ?? column.show);

      return {
        ...column,
        order,
        show: Boolean(show),
      };
    })
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}

function flattenVariableOptions(
  columns,
  path = "",
  inheritedType = "data",
  depth = 0,
) {
  if (!Array.isArray(columns)) {
    return [];
  }

  const entries = [];

  columns.forEach((column) => {
    if (!column?.name && !Array.isArray(column?.columns)) {
      return;
    }
    // Skip FK/ignored cols (flag hidden/ignore) dari opsi variabel.
    if (column?.hidden || column?.ignore) {
      return;
    }

    if (column.type === "doc" || column.type === "company") {
      entries.push(
        ...flattenVariableOptions(column.columns || [], "", column.type, 0),
      );
      return;
    }

    const fullPath =
      path && column.name ? `${path}.${column.name}` : column.name || path;
    const variableType =
      column.parentType || inheritedType || column.type || "data";

    if (fullPath) {
      entries.push({
        value: fullPath,
        label: fullPath,
        depth,
        type: variableType,
        title: column.title,
      });
    }

    if (Array.isArray(column.columns) && column.columns.length) {
      entries.push(
        ...flattenVariableOptions(
          column.columns,
          fullPath,
          variableType,
          depth + 1,
        ),
      );
    }
  });

  return entries;
}

function buildTokenFromOption(option) {
  if (!option?.value) {
    return "";
  }

  if (option.type === "company") {
    const preferenceKey = option.value.split(".").pop();
    return `{{company.${preferenceKey}}}`;
  }

  if (option.type === "relation") {
    return generateRelationToken(option.value);
  }

  const variablePath = option.value.startsWith("doc.")
    ? option.value
    : `doc.${option.value}`;

  return `{{${variablePath}}}`;
}

function RelationColumnDialog({
  open,
  onOpenChange,
  columns,
  onApply,
  t,
  isLoadingColumns = false,
}) {
  const [localColumns, setLocalColumns] = useState(columns || []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLocalColumns(columns || []);
  }, [columns, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full md:max-w-[50%]  min-w-64">
        <DialogHeader className="border-b border-muted-foreground/25 pb-2">
          <DialogTitle>{t("core.formtable.select_columns")}</DialogTitle>
          <DialogDescription className="sr-only" />
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t("core.formtable.select_columns.description")}
        </p>

        <div className="overflow-y-auto columns-[196px] space-y-4 space-x-4 [&_div]:break-inside-avoid">
          {isLoadingColumns && (
            <p className="text-xs text-muted-foreground">
              {t("core.printTemplate.editor.loading_latest_columns")}
            </p>
          )}

          {localColumns.map((column) => (
            <FormCheckbox
              key={column.name}
              label={
                <>
                  {column.title ||
                    (column.titleTrans
                      ? t(column.titleTrans)
                      : (column.title ?? column.name))}
                  {column.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </>
              }
              classNameCheckbox="pointer-events-auto!"
              disabled={column.required}
              checked={column.required || column.show}
              onCheckedChange={(value) => {
                setLocalColumns((previous) =>
                  previous.map((item) => {
                    if (item.name !== column.name || item.required) {
                      return item;
                    }

                    return {
                      ...item,
                      show: Boolean(value),
                    };
                  }),
                );
              }}
            />
          ))}
        </div>

        <DialogFooter className="-mb-2 border-t border-muted-foreground/25 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="h-8"
            disabled={isLoadingColumns}
            onClick={() => {
              setLocalColumns((previous) =>
                previous.map((item) => ({
                  ...item,
                  show: true,
                })),
              );
            }}
          >
            {t("core.formtable.select_all")}
          </Button>
          <DialogClose asChild>
            <Button
              className="h-8"
              type="button"
              disabled={isLoadingColumns}
              onClick={() => onApply(localColumns)}
            >
              {t("core.formtable.apply")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableColumnItem({ column, onRemove }) {
  const { t } = useLaravelReactI18n();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: column.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid col-span-full grid-cols-subgrid items-center border-muted-foreground/25 bg-background [&>div]:text-sm lg:[&>div]:text-base"
    >
      <button
        type="button"
        className="cursor-move"
        {...listeners}
        {...attributes}
      >
        <GripVerticalIcon className="size-5 text-muted-foreground/50 transition-[color,opacity] group-hover:text-foreground" />
      </button>

      <div>
        {column.title ||
          (column.titleTrans
            ? t(column.titleTrans)
            : (column.title ?? column.name))}
        {column.required && <span className="ml-1 text-red-500">*</span>}
      </div>

      <div className="w-10">
        {!column.required && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => onRemove(column.name)}
          >
            <Trash2Icon className="size-3 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}

function TokenConfigurationManager() {
  const editor = useEditor();
  const { t } = useLaravelReactI18n();
  const { dataTableColumns, printTemplate } = usePage().props;

  const [selectedTokenConfig, setSelectedTokenConfig] = useState(null);
  const [selectedLabelConfig, setSelectedLabelConfig] = useState(null);
  const [allTokenConfigs, setAllTokenConfigs] = useState([]);
  const [allLabelConfigs, setAllLabelConfigs] = useState([]);
  const [relationConfigs, setRelationConfigs] = useState([]);
  const [activeRelationConfig, setActiveRelationConfig] = useState(null);
  const [openSelectColumn, setOpenSelectColumn] = useState(false);
  const [isRelationColumnLoading, setIsRelationColumnLoading] = useState(false);
  const [relationColumnDialogComponentId, setRelationColumnDialogComponentId] =
    useState(null);
  const [tokenFormState, setTokenFormState] = useState({
    token: "",
    variablePath: "",
  });
  const [labelFormState, setLabelFormState] = useState({
    labelKey: "",
  });

  const availableOptions = useMemo(() => {
    const rawEntries = flattenVariableOptions(dataTableColumns || []);
    const byValue = new Map();

    rawEntries.forEach((entry) => {
      if (!byValue.has(entry.value)) {
        byValue.set(entry.value, entry);
      }
    });

    return Array.from(byValue.values());
  }, [dataTableColumns]);

  const labelTreeOptions = useMemo(
    () => buildTreeOptions(dataTableColumns || []),
    [dataTableColumns],
  );

  const tokenTreeOptions = useMemo(() => {
    const tree = buildTreeOptions(dataTableColumns || []);
    const filtered = filterTokenOptions(tree);

    // Apply formatTokenLabel to all nodes recursively
    const applyTokenLabels = (nodes) =>
      nodes.map((node) => ({
        ...node,
        label: formatTokenLabel(node),
        children: node.children ? applyTokenLabels(node.children) : [],
      }));

    return applyTokenLabels(filtered);
  }, [dataTableColumns]);

  const relationPathTreeOptions = useMemo(() => {
    const tree = buildTreeOptions(dataTableColumns || []);
    return filterRelationPathOptions(tree);
  }, [dataTableColumns]);

  const relationColumnDialogConfig = useMemo(() => {
    if (!relationColumnDialogComponentId) {
      return null;
    }

    return (
      relationConfigs.find(
        (item) =>
          String(item.componentId) === String(relationColumnDialogComponentId),
      ) || null
    );
  }, [relationConfigs, relationColumnDialogComponentId]);

  const relationColumnDnDSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
  );

  const displayLabelLookup = useMemo(() => {
    const lookup = new Map();

    availableOptions.forEach((option) => {
      lookup.set(option.value, option.title || option.value);
    });

    return lookup;
  }, [availableOptions]);

  const updateActiveRelationConfig = useCallback((updater) => {
    setActiveRelationConfig((previous) => {
      if (!previous) {
        return previous;
      }

      const nextConfig =
        typeof updater === "function" ? updater(previous) : updater;
      if (!nextConfig) {
        return previous;
      }

      setRelationConfigs((currentConfigs) =>
        currentConfigs.map((item) =>
          String(item.componentId) === String(previous.componentId)
            ? nextConfig
            : item,
        ),
      );

      return nextConfig;
    });
  }, []);

  const handleOpenSelectColumn = useCallback(() => {
    if (!activeRelationConfig?.componentId) {
      return;
    }

    const targetComponentId = activeRelationConfig.componentId;
    setRelationColumnDialogComponentId(targetComponentId);
    setOpenSelectColumn(true);

    const targetConfig =
      relationConfigs.find(
        (item) => String(item.componentId) === String(targetComponentId),
      ) || activeRelationConfig;

    if (
      !targetConfig?.relationPath ||
      typeof window === "undefined" ||
      typeof window.route !== "function"
    ) {
      return;
    }

    const relationNode = resolveRelationNodeByPath(
      dataTableColumns || [],
      targetConfig.relationPath,
    );
    const relationModel = relationNode?.related;

    if (!relationModel) {
      return;
    }

    setIsRelationColumnLoading(true);

    const visibleColumns = (targetConfig.columns || [])
      .filter((column) => column.show)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .map((column) => column.name);

    axios
      .get(window.route("model.columns", { model: relationModel }), {
        params: visibleColumns.length ? { columns: visibleColumns } : {},
      })
      .then((response) => {
        const latestColumns = response?.data?.columns;
        if (!Array.isArray(latestColumns)) {
          return;
        }

        const mergedColumns = mergeRelationColumns(
          latestColumns,
          targetConfig.columns || [],
        );

        setRelationConfigs((currentConfigs) =>
          currentConfigs.map((item) =>
            String(item.componentId) === String(targetComponentId)
              ? {
                  ...item,
                  columns: mergedColumns,
                }
              : item,
          ),
        );

        setActiveRelationConfig((previous) => {
          if (
            !previous ||
            String(previous.componentId) !== String(targetComponentId)
          ) {
            return previous;
          }

          return {
            ...previous,
            columns: mergedColumns,
          };
        });
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        setIsRelationColumnLoading(false);
      });
  }, [activeRelationConfig, dataTableColumns, relationConfigs]);

  const handleApplyRelationColumns = useCallback(
    (nextColumns) => {
      const targetComponentId =
        relationColumnDialogComponentId || activeRelationConfig?.componentId;

      if (!targetComponentId) {
        return;
      }

      const normalizedColumns = (nextColumns || []).map((column, index) => ({
        ...column,
        order: column.order ?? index,
      }));

      setRelationConfigs((currentConfigs) =>
        currentConfigs.map((item) =>
          String(item.componentId) === String(targetComponentId)
            ? {
                ...item,
                columns: normalizedColumns,
              }
            : item,
        ),
      );

      setActiveRelationConfig((previous) => {
        if (
          !previous ||
          String(previous.componentId) !== String(targetComponentId)
        ) {
          return previous;
        }

        return {
          ...previous,
          columns: normalizedColumns,
        };
      });
    },
    [relationColumnDialogComponentId, activeRelationConfig],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    const refreshTokenConfigs = () => {
      setAllTokenConfigs(collectCanvasTokenConfigurations(editor));
      setAllLabelConfigs(collectCanvasLabelConfigurations(editor));
      setRelationConfigs(collectRelationTokenConfigurations(editor));
    };

    const findRelationTableComponent = (component) => {
      let current = component;
      while (current) {
        if (current.getType?.() === "gjsRelationsTable") {
          return current;
        }
        current = current.parent?.();
      }
      return null;
    };

    const refreshSelection = (component) => {
      const selected = component || editor.getSelected();

      // Find token component using findTokenComponent (data-token attribute)
      const tokenComp = findTokenComponent(selected);
      // Find label component using findLabelComponent (data-label-key attribute)
      const labelComp = findLabelComponent(selected);

      // Check if parent has data-variable to determine context
      const variableComponent = findVariableComponent(selected);
      const variableAttributes = variableComponent?.getAttributes?.() || {};
      const hasVariableParent = Boolean(
        variableAttributes["data-variable"] ||
        variableAttributes["data-variable-inline"],
      );

      // Token configuration
      // Resolve the effective token component: either found directly on selected,
      // or search within the variable parent when it has data-variable
      const effectiveTokenComp =
        tokenComp ||
        (hasVariableParent && variableComponent
          ? findTokenComponent(variableComponent)
          : null);

      if (effectiveTokenComp) {
        const tokenAttributes = effectiveTokenComp.getAttributes?.() || {};
        const token =
          tokenAttributes["data-token"] ||
          decodeTokenFromBase64(tokenAttributes["data-token-b64"]) ||
          "";
        const variablePath =
          variableAttributes["data-variable"] ||
          variableAttributes["data-variable-inline"] ||
          variableAttributes["data-variable-path"] ||
          "";
        const isInline = Boolean(variableAttributes["data-variable-inline"]);

        setSelectedTokenConfig({
          kind: isInline ? "inline" : "variable",
          component: variableComponent || effectiveTokenComp,
          tokenComponent: effectiveTokenComp,
          componentId:
            effectiveTokenComp.cid ?? effectiveTokenComp.getId?.() ?? "",
          variablePath,
          token,
          hasVariableParent,
        });
        setTokenFormState({
          token,
          variablePath,
        });
      } else if (
        hasVariableParent &&
        variableAttributes["data-variable-inline"]
      ) {
        // Inline variable without separate token component
        const inlineToken =
          variableAttributes["data-token"] ||
          decodeTokenFromBase64(variableAttributes["data-token-b64"]) ||
          "";
        const variablePath =
          variableAttributes["data-variable-inline"] ||
          variableAttributes["data-variable-path"] ||
          "";

        setSelectedTokenConfig({
          kind: "inline",
          component: variableComponent,
          tokenComponent: variableComponent,
          componentId:
            variableComponent.cid ?? variableComponent.getId?.() ?? "",
          variablePath,
          token: inlineToken,
          hasVariableParent: true,
        });
        setTokenFormState({
          token: inlineToken,
          variablePath,
        });
      } else {
        setSelectedTokenConfig(null);
        setTokenFormState({ token: "", variablePath: "" });
      }

      // Label configuration
      // Resolve the effective label component: either found directly on selected,
      // or search within the variable parent when it has data-variable
      const effectiveLabelComp =
        labelComp ||
        (hasVariableParent && variableComponent
          ? findLabelComponent(variableComponent)
          : null);

      if (effectiveLabelComp) {
        const labelAttributes = effectiveLabelComp.getAttributes?.() || {};
        const labelKey = labelAttributes["data-label-key"] || "";

        setSelectedLabelConfig({
          component: variableComponent || effectiveLabelComp,
          labelComponent: effectiveLabelComp,
          componentId:
            effectiveLabelComp.cid ?? effectiveLabelComp.getId?.() ?? "",
          labelKey,
          hasVariableParent,
        });
        setLabelFormState({ labelKey });
      } else {
        setSelectedLabelConfig(null);
        setLabelFormState({ labelKey: "" });
      }

      refreshTokenConfigs();

      const relationTableComponent = findRelationTableComponent(selected);
      if (relationTableComponent) {
        const allRelations = collectRelationTokenConfigurations(editor);
        const activeConfig = allRelations.find(
          (item) =>
            String(item.componentId) ===
            String(
              relationTableComponent.cid ??
                relationTableComponent.getId?.() ??
                "",
            ),
        );
        setActiveRelationConfig(activeConfig || null);
      } else {
        setActiveRelationConfig(null);
      }
    };

    editor.on("component:selected", refreshSelection);
    editor.on("component:deselected", refreshSelection);
    editor.on("component:update", refreshSelection);
    editor.on("component:add", refreshTokenConfigs);
    editor.on("component:remove", refreshTokenConfigs);

    refreshSelection();
    refreshTokenConfigs();

    return () => {
      editor.off("component:selected", refreshSelection);
      editor.off("component:deselected", refreshSelection);
      editor.off("component:update", refreshSelection);
      editor.off("component:add", refreshTokenConfigs);
      editor.off("component:remove", refreshTokenConfigs);
    };
  }, [editor]);

  const handleTokenSelect = (config) => {
    if (!config?.component) {
      return;
    }

    editor.select(config.component);
    const element = config.component.getEl?.();
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const applyTokenConfiguration = () => {
    if (!selectedTokenConfig?.tokenComponent) {
      return;
    }

    const trimmedToken = tokenFormState.token.trim();
    const trimmedVariablePath = tokenFormState.variablePath.trim();

    if (selectedTokenConfig.kind === "inline") {
      const displayContent =
        simplifyTokenDisplay(trimmedToken) ||
        `{{${stripDocPrefix(trimmedVariablePath || selectedTokenConfig.variablePath)}}}`;

      selectedTokenConfig.component.addAttributes({
        "data-variable-inline":
          trimmedVariablePath || selectedTokenConfig.variablePath,
        "data-variable-path":
          trimmedVariablePath || selectedTokenConfig.variablePath,
        "data-token": trimmedToken,
        "data-token-b64": encodeTokenToBase64(trimmedToken),
        title: trimmedToken,
      });
      selectedTokenConfig.component.set("content", displayContent);
    } else {
      selectedTokenConfig.tokenComponent.addAttributes({
        "data-token": trimmedToken,
        title: trimmedToken,
      });
      selectedTokenConfig.tokenComponent.set(
        "content",
        simplifyTokenDisplay(trimmedToken),
      );
    }

    setAllTokenConfigs(collectCanvasTokenConfigurations(editor));
    setAllLabelConfigs(collectCanvasLabelConfigurations(editor));
  };

  const applyLabelConfiguration = () => {
    if (!selectedLabelConfig?.labelComponent) {
      return;
    }

    const trimmedLabelKey = labelFormState.labelKey.trim();
    const displayLabel =
      displayLabelLookup.get(trimmedLabelKey) || trimmedLabelKey || "-";

    selectedLabelConfig.labelComponent.addAttributes({
      "data-label-key": trimmedLabelKey,
      title: `{{label "${trimmedLabelKey}"}}`,
    });
    selectedLabelConfig.labelComponent.set("content", displayLabel);

    setAllTokenConfigs(collectCanvasTokenConfigurations(editor));
    setAllLabelConfigs(collectCanvasLabelConfigurations(editor));
  };

  const applyRelationConfiguration = (config) => {
    if (!config?.component) {
      return;
    }

    const relationPath = config.relationPath.trim();
    if (!relationPath) {
      return;
    }

    const normalizedColumns = (config.columns || []).map((column, order) => ({
      ...column,
      order,
    }));

    config.component.addAttributes({
      "data-relations": relationPath,
    });

    config.component.set("columnsConfig", normalizedColumns);

    const visibleColumns = normalizedColumns
      .filter((column) => column.show)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

    // Req 4.5: When all columns are hidden, render empty table structure
    if (visibleColumns.length === 0) {
      config.component.components([
        {
          type: "tableHead",
          tagName: "thead",
          selectable: false,
          droppable: false,
          layerable: false,
          editable: false,
          draggable: false,
          components: [],
        },
        {
          tagName: "tbody",
          selectable: false,
          droppable: false,
          layerable: false,
          editable: false,
          draggable: false,
          components: [],
        },
      ]);
    } else {
      config.component.components(
        buildExampleDataTable({
          columns: visibleColumns,
          relationName: relationPath,
          exampleData: [],
          t,
          genId: createId,
          locale: printTemplate?.default_language,
        }),
      );
    }

    const updatedRelations = collectRelationTokenConfigurations(editor);
    setRelationConfigs(updatedRelations);
    setAllTokenConfigs(collectCanvasTokenConfigurations(editor));
    setAllLabelConfigs(collectCanvasLabelConfigurations(editor));

    const updatedActive = updatedRelations.find(
      (item) => String(item.componentId) === String(config.componentId),
    );
    setActiveRelationConfig(updatedActive || null);
  };

  const unifiedTokenItems = useMemo(
    () => [
      ...allTokenConfigs.map((config) => ({
        id: `var-${config.componentId}`,
        kind: config.kind === "inline" ? "Inline" : "Token",
        label: config.variablePath || "-",
        token: config.token || "-",
        config,
      })),
      ...allLabelConfigs.map((config) => ({
        id: `lbl-${config.componentId}`,
        kind: "Label",
        label: config.labelKey || "-",
        token: `{{label "${config.labelKey}"}}`,
        config,
      })),
      ...relationConfigs.map((config) => ({
        id: `rel-${config.componentId}`,
        kind: "Relasi",
        label: config.relationPath || "-",
        token: config.token || "-",
        config,
      })),
    ],
    [allTokenConfigs, allLabelConfigs, relationConfigs],
  );

  return (
    <div className="space-y-3 p-3">
      <Collapsible className="rounded-md border border-muted-foreground/25 p-3">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2">
            <ChevronDownIcon className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            <span className="text-sm font-medium">Daftar Token</span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          {!unifiedTokenItems.length ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Belum ada token di canvas.
            </p>
          ) : (
            <Accordion type="single" collapsible className="mt-2 w-full">
              {unifiedTokenItems.map((item) => {
                return (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger
                      className="px-2 py-2 text-xs hover:bg-muted/50 hover:no-underline! hover:cursor-pointer"
                      onClick={() => handleTokenSelect(item.config)}
                    >
                      <div className="flex w-full items-center justify-between gap-2 pr-2 text-left">
                        <span className="truncate">{item.label}</span>
                        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {item.kind}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 px-2 pb-2 text-xs">
                      <p>
                        <span className="font-medium">Token:</span>{" "}
                        <code>{item.token}</code>
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleTokenSelect(item.config)}
                      >
                        Pilih di Canvas
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CollapsibleContent>
      </Collapsible>

      <div className="rounded-md border border-muted-foreground/25 p-3">
        <h4 className="text-sm font-semibold">Konfigurasi Handlebar Token</h4>

        {!selectedTokenConfig ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Pilih komponen dengan atribut data-token di canvas untuk mengubah
            konfigurasi.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="grid gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Handlebar Token</Label>
                <NestedSelect
                  value={tokenFormState.variablePath}
                  onValueChange={(value) => {
                    // Find the option in the tree to determine its type
                    const findOption = (nodes, targetValue) => {
                      for (const node of nodes) {
                        if (node.value === targetValue) return node;
                        if (node.children?.length) {
                          const found = findOption(node.children, targetValue);
                          if (found) return found;
                        }
                      }
                      return null;
                    };

                    const tree = buildTreeOptions(dataTableColumns || []);
                    const selectedOption = findOption(tree, value);
                    const token = selectedOption
                      ? buildTokenFromOption(selectedOption)
                      : `{{doc.${value}}}`;

                    setTokenFormState({
                      token,
                      variablePath: value,
                    });
                  }}
                  options={tokenTreeOptions}
                  placeholder="Pilih token"
                />
              </div>

              {selectedTokenConfig.kind === "inline" && (
                <div className="space-y-1">
                  <Label className="text-xs">Variable Path</Label>
                  <Input
                    value={tokenFormState.variablePath}
                    onChange={(event) =>
                      setTokenFormState((previous) => ({
                        ...previous,
                        variablePath: event.target.value,
                      }))
                    }
                    className="h-8 text-xs font-mono"
                    placeholder="customer.name"
                  />
                </div>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={applyTokenConfiguration}
            >
              Terapkan Token
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border border-muted-foreground/25 p-3">
        <h4 className="text-sm font-semibold">Konfigurasi Label Key</h4>

        {!selectedLabelConfig ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Pilih komponen dengan atribut data-label-key di canvas untuk
            mengubah konfigurasi.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="grid gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Label Key</Label>
                <NestedSelect
                  value={labelFormState.labelKey}
                  onValueChange={(value) =>
                    setLabelFormState({ labelKey: value })
                  }
                  options={labelTreeOptions}
                  placeholder="Pilih label key"
                />
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={applyLabelConfiguration}
            >
              Terapkan Label
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border border-muted-foreground/25 p-3">
        <h4 className="text-sm font-semibold">
          {t("core.printTemplate.editor.relation_table")}
        </h4>

        {!activeRelationConfig ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("core.printTemplate.editor.no_relation_active")}
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            <div
              key={
                activeRelationConfig.componentId ||
                activeRelationConfig.relationPath
              }
              className="space-y-2 rounded-md border border-muted-foreground/20 p-2"
            >
              <div className="space-y-1">
                <Label className="text-xs">
                  {t("core.printTemplate.editor.relation_path")}
                </Label>
                <NestedSelect
                  value={activeRelationConfig.relationPath}
                  onValueChange={(value) => {
                    updateActiveRelationConfig((previous) => ({
                      ...previous,
                      relationPath: value,
                      token: value
                        ? `{{#each ${value}}} ... {{/each}}`
                        : "{{#each relation}} ... {{/each}}",
                    }));
                  }}
                  options={relationPathTreeOptions}
                  placeholder="Pilih relation path"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  {t("core.printTemplate.editor.columns")}
                </Label>
                {!activeRelationConfig.columns?.length ? (
                  <p className="text-xs text-muted-foreground">
                    Kolom relasi belum tersedia pada komponen ini.
                  </p>
                ) : (
                  <DndContext
                    sensors={relationColumnDnDSensors}
                    collisionDetection={closestCenter}
                    onDragOver={(event) => {
                      const { active, over } = event;
                      if (!over || active.id === over.id) {
                        return;
                      }

                      updateActiveRelationConfig((previous) => {
                        const sortedColumns = [
                          ...(previous.columns || []),
                        ].sort(
                          (left, right) =>
                            (left.order ?? 0) - (right.order ?? 0),
                        );
                        const previousIndex = sortedColumns.findIndex(
                          (column) => column.name === active.id,
                        );
                        const nextIndex = sortedColumns.findIndex(
                          (column) => column.name === over.id,
                        );

                        if (previousIndex === -1 || nextIndex === -1) {
                          return previous;
                        }

                        const nextColumns = arrayMove(
                          sortedColumns,
                          previousIndex,
                          nextIndex,
                        ).map((column, order) => ({
                          ...column,
                          order,
                        }));

                        return {
                          ...previous,
                          columns: nextColumns,
                        };
                      });
                    }}
                  >
                    <div className="grid max-w-full grid-cols-[auto_2fr_auto] overflow-x-hidden rounded-lg border border-muted-foreground/25 text-sm [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25">
                      <div className="grid col-span-full grid-cols-subgrid items-center rounded-t-md bg-muted px-2 [&>div]:py-1 [&>div]:text-sm [&>div]:font-semibold">
                        <div />
                        <div>{t("core.formtable.column")}</div>
                      </div>
                      <div className="grid col-span-full grid-cols-subgrid overflow-x-hidden overflow-y-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:border-muted-foreground/25 [&>div>*]:px-2 [&>div>*]:py-1 [&>div>*]:flex [&>div]:h-fit [&>*:not(:last-child)]:border-b *:border-muted-foreground/25">
                        <SortableContext
                          items={activeRelationConfig.columns
                            .filter((column) => column.show)
                            .sort(
                              (left, right) =>
                                (left.order ?? 0) - (right.order ?? 0),
                            )
                            .map((column) => column.name)}
                          strategy={verticalListSortingStrategy}
                        >
                          {activeRelationConfig.columns
                            .filter((column) => column.show)
                            .sort(
                              (left, right) =>
                                (left.order ?? 0) - (right.order ?? 0),
                            )
                            .map((column) => (
                              <SortableColumnItem
                                key={column.name}
                                column={column}
                                onRemove={(name) => {
                                  updateActiveRelationConfig((previous) => ({
                                    ...previous,
                                    columns: (previous.columns || []).map(
                                      (item) => {
                                        if (item.name !== name) {
                                          return item;
                                        }

                                        return {
                                          ...item,
                                          show: false,
                                        };
                                      },
                                    ),
                                  }));
                                }}
                              />
                            ))}
                        </SortableContext>
                      </div>
                    </div>
                  </DndContext>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="my-2 inline h-6 w-fit text-left font-medium"
                  onClick={handleOpenSelectColumn}
                >
                  {t("core.formtable.add_or_remove_columns")}
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => applyRelationConfiguration(activeRelationConfig)}
              >
                Terapkan Path & Kolom
              </Button>
            </div>
          </div>
        )}
      </div>

      <RelationColumnDialog
        open={openSelectColumn}
        onOpenChange={setOpenSelectColumn}
        columns={
          relationColumnDialogConfig?.columns ||
          activeRelationConfig?.columns ||
          []
        }
        onApply={handleApplyRelationColumns}
        t={t}
        isLoadingColumns={isRelationColumnLoading}
      />
    </div>
  );
}

export default TokenConfigurationManager;
