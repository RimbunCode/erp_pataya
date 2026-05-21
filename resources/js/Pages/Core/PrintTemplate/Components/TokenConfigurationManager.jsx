import React, { useEffect, useMemo, useState } from "react";
import { useEditor } from "@grapesjs/react";
import { usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/Components/ui/accordion";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import NestedSelect from "@/Components/NestedSelect";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { buildExampleDataTable } from "@/lib/gjsRelationsTable";
import {
  buildTreeOptions,
  filterTokenOptions,
  filterRelationPathOptions,
  formatTokenLabel,
  generateRelationToken,
  simplifyTokenDisplay,
} from "./tokenConfigHelpers";

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

    if (column.type === "data" || column.type === "preferences") {
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

  if (option.type === "preferences") {
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

function reorderColumns(columns, index, direction) {
  const nextColumns = [...columns];
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= columns.length) {
    return nextColumns;
  }

  const current = nextColumns[index];
  nextColumns[index] = nextColumns[targetIndex];
  nextColumns[targetIndex] = current;

  return nextColumns.map((column, order) => ({
    ...column,
    order,
  }));
}

function TokenConfigurationManager() {
  const editor = useEditor();
  const { t } = useLaravelReactI18n();
  const { dataTableColumns, exampleData, printTemplate } = usePage().props;

  const [selectedConfig, setSelectedConfig] = useState(null);
  const [allTokenConfigs, setAllTokenConfigs] = useState([]);
  const [relationConfigs, setRelationConfigs] = useState([]);
  const [activeRelationConfig, setActiveRelationConfig] = useState(null);
  const [formState, setFormState] = useState({
    labelKey: "",
    token: "",
    variablePath: "",
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

  const displayLabelLookup = useMemo(() => {
    const lookup = new Map();

    availableOptions.forEach((option) => {
      lookup.set(option.value, option.title || option.value);
    });

    return lookup;
  }, [availableOptions]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const refreshTokenConfigs = () => {
      setAllTokenConfigs(collectCanvasTokenConfigurations(editor));
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
      const variableComponent = findVariableComponent(selected);
      const config = getVariableTokenConfiguration(variableComponent);

      setSelectedConfig(config);
      setFormState({
        labelKey: config?.labelKey || config?.variablePath || "",
        token: config?.token || "",
        variablePath: config?.variablePath || "",
      });

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
    if (!selectedConfig?.component) {
      return;
    }

    const trimmedLabelKey = formState.labelKey.trim();
    const trimmedToken = formState.token.trim();
    const trimmedVariablePath = formState.variablePath.trim();

    if (selectedConfig.kind === "inline") {
      const displayContent =
        simplifyTokenDisplay(trimmedToken) ||
        `{{${stripDocPrefix(trimmedVariablePath || selectedConfig.variablePath)}}}`;

      selectedConfig.component.addAttributes({
        "data-variable-inline":
          trimmedVariablePath || selectedConfig.variablePath,
        "data-variable-path":
          trimmedVariablePath || selectedConfig.variablePath,
        "data-token": trimmedToken,
        "data-token-b64": encodeTokenToBase64(trimmedToken),
        title: trimmedToken,
      });
      selectedConfig.component.set("content", displayContent);
    } else {
      if (selectedConfig.labelComponent) {
        const displayLabel =
          displayLabelLookup.get(trimmedLabelKey) || trimmedLabelKey || "-";

        selectedConfig.labelComponent.addAttributes({
          "data-label-key": trimmedLabelKey,
          title: `{{label "${trimmedLabelKey}"}}`,
        });
        selectedConfig.labelComponent.set("content", displayLabel);
      }

      if (selectedConfig.tokenComponent) {
        selectedConfig.tokenComponent.addAttributes({
          "data-token": trimmedToken,
          title: trimmedToken,
        });
        selectedConfig.tokenComponent.set(
          "content",
          simplifyTokenDisplay(trimmedToken),
        );
      }
    }

    setAllTokenConfigs(collectCanvasTokenConfigurations(editor));
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
      const relationData = exampleData?.[relationPath];
      const previewRows = Array.isArray(relationData)
        ? relationData
        : relationData
          ? [relationData]
          : [];

      config.component.components(
        buildExampleDataTable({
          columns: visibleColumns,
          relationName: relationPath,
          exampleData: previewRows,
          t,
          genId: createId,
          locale: printTemplate?.default_language,
        }),
      );
    }

    const updatedRelations = collectRelationTokenConfigurations(editor);
    setRelationConfigs(updatedRelations);
    setAllTokenConfigs(collectCanvasTokenConfigurations(editor));

    const updatedActive = updatedRelations.find(
      (item) => String(item.componentId) === String(config.componentId),
    );
    setActiveRelationConfig(updatedActive || null);
  };

  const unifiedTokenItems = useMemo(
    () => [
      ...allTokenConfigs.map((config) => ({
        id: `var-${config.componentId}`,
        kind: config.kind === "inline" ? "Inline" : "Variabel",
        label: config.variablePath || "-",
        token: config.token || "-",
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
    [allTokenConfigs, relationConfigs],
  );

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-md border border-muted-foreground/25 p-3">
        <h4 className="text-sm font-semibold">Konfigurasi Token</h4>

        {!selectedConfig ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Pilih token di canvas untuk mengubah konfigurasi.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="grid gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Label Key</Label>
                <NestedSelect
                  value={formState.labelKey}
                  onValueChange={(value) =>
                    setFormState((previous) => ({
                      ...previous,
                      labelKey: value,
                    }))
                  }
                  options={labelTreeOptions}
                  placeholder="Pilih label key"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Handlebar Token</Label>
                <NestedSelect
                  value={formState.variablePath}
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

                    setFormState((previous) => ({
                      ...previous,
                      token,
                      variablePath: value,
                    }));
                  }}
                  options={tokenTreeOptions}
                  placeholder="Pilih token"
                />
              </div>

              {selectedConfig.kind === "inline" && (
                <div className="space-y-1">
                  <Label className="text-xs">Variable Path</Label>
                  <Input
                    value={formState.variablePath}
                    onChange={(event) =>
                      setFormState((previous) => ({
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
              Terapkan Konfigurasi
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border border-muted-foreground/25 p-3">
        <h4 className="text-sm font-semibold">Token di Canvas</h4>

        {!unifiedTokenItems.length ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Belum ada token di canvas.
          </p>
        ) : (
          <Accordion type="single" collapsible className="mt-2 w-full">
            {unifiedTokenItems.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger
                  className="px-2 py-2 text-xs hover:bg-muted/50"
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
            ))}
          </Accordion>
        )}
      </div>

      <div className="rounded-md border border-muted-foreground/25 p-3">
        <h4 className="text-sm font-semibold">
          {t("core/printTemplate.editor.relation_table")}
        </h4>

        {!activeRelationConfig ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("core/printTemplate.editor.no_relation_active")}
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
                  {t("core/printTemplate.editor.relation_path")}
                </Label>
                <NestedSelect
                  value={activeRelationConfig.relationPath}
                  onValueChange={(value) => {
                    const updated = {
                      ...activeRelationConfig,
                      relationPath: value,
                      token: value
                        ? `{{#each ${value}}} ... {{/each}}`
                        : "{{#each relation}} ... {{/each}}",
                    };
                    setActiveRelationConfig(updated);
                    setRelationConfigs((previous) =>
                      previous.map((item) =>
                        String(item.componentId) ===
                        String(activeRelationConfig.componentId)
                          ? updated
                          : item,
                      ),
                    );
                  }}
                  options={relationPathTreeOptions}
                  placeholder="Pilih relation path"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  {t("core/printTemplate.editor.columns")}
                </Label>
                {!activeRelationConfig.columns?.length ? (
                  <p className="text-xs text-muted-foreground">
                    Kolom relasi belum tersedia pada komponen ini.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {activeRelationConfig.columns
                      .slice()
                      .sort(
                        (left, right) => (left.order ?? 0) - (right.order ?? 0),
                      )
                      .map((column, index, sortedColumns) => (
                        <div
                          key={column.name || index}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(column.show)}
                            onChange={(event) => {
                              const nextColumns = sortedColumns.map(
                                (sortedColumn) => {
                                  if (sortedColumn.name !== column.name) {
                                    return sortedColumn;
                                  }
                                  return {
                                    ...sortedColumn,
                                    show: event.target.checked,
                                  };
                                },
                              );
                              const updated = {
                                ...activeRelationConfig,
                                columns: nextColumns,
                              };
                              setActiveRelationConfig(updated);
                              setRelationConfigs((previous) =>
                                previous.map((item) =>
                                  String(item.componentId) ===
                                  String(activeRelationConfig.componentId)
                                    ? updated
                                    : item,
                                ),
                              );
                            }}
                          />
                          <span className="grow text-xs">
                            {column.title || column.name}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-1.5"
                            onClick={() => {
                              const nextColumns = reorderColumns(
                                sortedColumns,
                                index,
                                "up",
                              );
                              const updated = {
                                ...activeRelationConfig,
                                columns: nextColumns,
                              };
                              setActiveRelationConfig(updated);
                              setRelationConfigs((previous) =>
                                previous.map((item) =>
                                  String(item.componentId) ===
                                  String(activeRelationConfig.componentId)
                                    ? updated
                                    : item,
                                ),
                              );
                            }}
                            disabled={index === 0}
                          >
                            <ArrowUpIcon className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-1.5"
                            onClick={() => {
                              const nextColumns = reorderColumns(
                                sortedColumns,
                                index,
                                "down",
                              );
                              const updated = {
                                ...activeRelationConfig,
                                columns: nextColumns,
                              };
                              setActiveRelationConfig(updated);
                              setRelationConfigs((previous) =>
                                previous.map((item) =>
                                  String(item.componentId) ===
                                  String(activeRelationConfig.componentId)
                                    ? updated
                                    : item,
                                ),
                              );
                            }}
                            disabled={index === sortedColumns.length - 1}
                          >
                            <ArrowDownIcon className="size-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
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
    </div>
  );
}

export default TokenConfigurationManager;
