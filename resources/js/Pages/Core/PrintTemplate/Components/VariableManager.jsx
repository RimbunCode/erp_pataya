import React, { useEffect, useMemo, useState } from "react";
import { useEditor } from "@grapesjs/react";
import { usePage } from "@inertiajs/react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import VariableItem from "./VariableItem";

function findVariableComponent(component) {
  let current = component;

  while (current) {
    const attributes = current.getAttributes?.() || {};

    if (attributes["data-variable"]) {
      return current;
    }

    current = current.parent?.();
  }

  return null;
}

function getVariableTokenConfiguration(component) {
  if (!component) {
    return null;
  }

  const attributes = component.getAttributes?.() || {};
  const tokenComponent = Array.from(component.find?.("[data-token]") || [])[0];
  const labelComponent = Array.from(component.find?.("[data-label-key]") || [])[0];

  const tokenAttributes = tokenComponent?.getAttributes?.() || {};
  const labelAttributes = labelComponent?.getAttributes?.() || {};

  const previewContent = tokenComponent?.get("content");

  return {
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
        : "",
  };
}

function collectCanvasTokenConfigurations(editor) {
  if (!editor) {
    return [];
  }

  const wrapper = editor.getWrapper?.();
  if (!wrapper) {
    return [];
  }

  const components = Array.from(wrapper.find?.("[data-variable]") || []);

  return components
    .map((component) => getVariableTokenConfiguration(component))
    .filter(Boolean);
}

function collectRelationTokenConfigurations(editor) {
  if (!editor) {
    return [];
  }

  const wrapper = editor.getWrapper?.();
  if (!wrapper) {
    return [];
  }

  const components = Array.from(wrapper.find?.("[data-relations]") || []).filter(
    (component) => component.getType?.() === "gjsRelationsTable",
  );

  return components.map((component) => {
    const attributes = component.getAttributes?.() || {};
    const relationPath = attributes["data-relations"] || "";

    return {
      component,
      componentId: component.cid ?? component.getId?.() ?? "",
      relationPath,
      token: relationPath
        ? `{{#each ${relationPath}}} ... {{/each}}`
        : "{{#each relation}} ... {{/each}}",
    };
  });
}

function VariableManager() {
  const editor = useEditor();
  const { dataTableColumns, exampleData } = usePage().props;
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [allTokenConfigs, setAllTokenConfigs] = useState([]);
  const [relationConfigs, setRelationConfigs] = useState([]);
  const [formState, setFormState] = useState({
    labelKey: "",
    token: "",
  });

  const availableVariables = useMemo(() => {
    return Array.isArray(dataTableColumns) ? dataTableColumns : [];
  }, [dataTableColumns]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const refreshAllTokenConfigs = () => {
      setAllTokenConfigs(collectCanvasTokenConfigurations(editor));
      setRelationConfigs(collectRelationTokenConfigurations(editor));
    };

    const updateSelection = (component) => {
      const selected = component || editor.getSelected();
      const variableComponent = findVariableComponent(selected);
      const config = getVariableTokenConfiguration(variableComponent);
      setSelectedConfig(config);
      setFormState({
        labelKey: config?.labelKey || "",
        token: config?.token || "",
      });
      refreshAllTokenConfigs();
    };

    const clearSelection = () => {
      const selected = editor.getSelected();
      const variableComponent = findVariableComponent(selected);
      const config = getVariableTokenConfiguration(variableComponent);
      setSelectedConfig(config);
      setFormState({
        labelKey: config?.labelKey || "",
        token: config?.token || "",
      });
      refreshAllTokenConfigs();
    };

    editor.on("component:selected", updateSelection);
    editor.on("component:deselected", clearSelection);
    editor.on("component:update", updateSelection);
    editor.on("component:add", refreshAllTokenConfigs);
    editor.on("component:remove", refreshAllTokenConfigs);

    updateSelection();
    refreshAllTokenConfigs();

    return () => {
      editor.off("component:selected", updateSelection);
      editor.off("component:deselected", clearSelection);
      editor.off("component:update", updateSelection);
      editor.off("component:add", refreshAllTokenConfigs);
      editor.off("component:remove", refreshAllTokenConfigs);
    };
  }, [editor]);

  const applyTokenConfiguration = () => {
    if (!selectedConfig?.component) {
      return;
    }

    const trimmedLabelKey = formState.labelKey.trim();
    const trimmedToken = formState.token.trim();

    if (selectedConfig.labelComponent) {
      selectedConfig.labelComponent.addAttributes({
        "data-label-key": trimmedLabelKey,
        title: `{{label "${trimmedLabelKey}"}}`,
      });

      const variableType = selectedConfig.variableType;
      const labelTypeArg =
        variableType === "preferences" ? ' type="companyDetail"' : "";
      selectedConfig.labelComponent.set(
        "content",
        `{{label "${trimmedLabelKey}"${labelTypeArg}}}`,
      );
    }

    if (selectedConfig.tokenComponent) {
      selectedConfig.tokenComponent.addAttributes({
        "data-token": trimmedToken,
        title: trimmedToken,
      });
    }

    setSelectedConfig((current) =>
      current
        ? {
            ...current,
            labelKey: trimmedLabelKey,
            token: trimmedToken,
          }
        : current,
    );
    setAllTokenConfigs(collectCanvasTokenConfigurations(editor));
  };

  const applyRelationPath = (componentId, relationPath) => {
    if (!editor) {
      return;
    }

    const trimmedPath = relationPath.trim();
    const target = relationConfigs.find(
      (config) => String(config.componentId) === String(componentId),
    )?.component;

    if (!target || !trimmedPath) {
      return;
    }

    target.addAttributes({
      "data-relations": trimmedPath,
    });

    setRelationConfigs((prev) =>
      prev.map((config) => {
        if (String(config.componentId) !== String(componentId)) {
          return config;
        }

        return {
          ...config,
          relationPath: trimmedPath,
          token: `{{#each ${trimmedPath}}} ... {{/each}}`,
        };
      }),
    );
  };

  return (
    <div className="p-3 text-left overflow-y-auto max-h-[80vh] space-y-3">
      <h3 className="font-semibold text-base">Variabel Dokumen</h3>

      {!availableVariables.length ? (
        <p className="text-sm text-muted-foreground">Tidak ada variabel tersedia.</p>
      ) : (
        <div className="space-y-2">
          {availableVariables.map((variable) => (
            <VariableItem
              key={variable.name}
              exampleData={exampleData}
              {...variable}
            />
          ))}
        </div>
      )}

      <div className="border border-muted-foreground/25 rounded-md p-3 space-y-2">
        <h4 className="text-sm font-semibold">Konfigurasi Token</h4>

        {!selectedConfig ? (
          <p className="text-xs text-muted-foreground">
            Pilih komponen variabel di canvas untuk melihat konfigurasi token.
          </p>
        ) : (
          <div className="space-y-1.5 text-xs">
            <p>
              <span className="font-medium">Path:</span>{" "}
              <code>{selectedConfig.variablePath || "-"}</code>
            </p>
            <p>
              <span className="font-medium">Tipe:</span>{" "}
              <code>{selectedConfig.variableType || "-"}</code>
            </p>
            <p>
              <span className="font-medium">Label Key:</span>{" "}
              <code>{selectedConfig.labelKey || "-"}</code>
            </p>
            <p>
              <span className="font-medium">Token:</span>{" "}
              <code>{selectedConfig.token || "-"}</code>
            </p>
            <p>
              <span className="font-medium">Preview Value:</span>{" "}
              <span className="text-muted-foreground">
                {selectedConfig.previewValue || "-"}
              </span>
            </p>
            <div className="pt-2 border-t border-muted-foreground/20 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Label Key</Label>
                <Input
                  value={formState.labelKey}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      labelKey: event.target.value,
                    }))
                  }
                  className="h-8 text-xs"
                  placeholder="customer.name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Handlebar Token</Label>
                <Input
                  value={formState.token}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      token: event.target.value,
                    }))
                  }
                  className="h-8 text-xs font-mono"
                  placeholder='{{doc.customerName}}'
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={applyTokenConfiguration}
                className="h-8 text-xs"
              >
                Terapkan Konfigurasi
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border border-muted-foreground/25 rounded-md p-3 space-y-2">
        <h4 className="text-sm font-semibold">Token di Canvas</h4>
        {!allTokenConfigs.length ? (
          <p className="text-xs text-muted-foreground">
            Belum ada komponen variabel di canvas.
          </p>
        ) : (
          <div className="space-y-2">
            {allTokenConfigs.map((config) => (
              <div
                key={config.componentId || config.variablePath}
                className="rounded-md border border-muted-foreground/20 p-2 space-y-1"
              >
                <p className="text-xs">
                  <span className="font-medium">Path:</span>{" "}
                  <code>{config.variablePath || "-"}</code>
                </p>
                <p className="text-xs">
                  <span className="font-medium">Token:</span>{" "}
                  <code>{config.token || "-"}</code>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border border-muted-foreground/25 rounded-md p-3 space-y-2">
        <h4 className="text-sm font-semibold">Token Tabel Relasi</h4>
        {!relationConfigs.length ? (
          <p className="text-xs text-muted-foreground">
            Belum ada komponen tabel relasi di canvas.
          </p>
        ) : (
          <div className="space-y-2">
            {relationConfigs.map((config) => (
              <div
                key={config.componentId || config.relationPath}
                className="rounded-md border border-muted-foreground/20 p-2 space-y-1.5"
              >
                <Label className="text-xs">Relation Path</Label>
                <Input
                  value={config.relationPath}
                  onChange={(event) =>
                    setRelationConfigs((prev) =>
                      prev.map((item) => {
                        if (
                          String(item.componentId) !== String(config.componentId)
                        ) {
                          return item;
                        }

                        return {
                          ...item,
                          relationPath: event.target.value,
                          token: event.target.value.trim()
                            ? `{{#each ${event.target.value.trim()}}} ... {{/each}}`
                            : "{{#each relation}} ... {{/each}}",
                        };
                      }),
                    )
                  }
                  className="h-8 text-xs"
                />
                <p className="text-xs">
                  <span className="font-medium">Token:</span>{" "}
                  <code>{config.token}</code>
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() =>
                    applyRelationPath(config.componentId, config.relationPath)
                  }
                >
                  Terapkan Path Relasi
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VariableManager;
