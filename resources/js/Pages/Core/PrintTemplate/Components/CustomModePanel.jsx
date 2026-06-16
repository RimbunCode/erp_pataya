import React, { useCallback, useMemo } from "react";
import { useEditor } from "@grapesjs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import CustomModeToggle from "./CustomModeToggle";
import CustomModeVariablePanel from "./CustomModeVariablePanel";
import CustomModeHeaderEditor from "./CustomModeHeaderEditor";
import { buildExampleDataTable } from "@/lib/gjsRelationsTable";
import { usePage } from "@inertiajs/react";

/**
 * Main panel displayed in the sidebar when a gjsRelationsTable is selected.
 * Coordinates Custom Mode toggle, variable panel, and header editor.
 *
 * @param {object} props
 * @param {object} props.selectedComponent - GrapesJS gjsRelationsTable component
 */
function CustomModePanel({ selectedComponent }) {
  const editor = useEditor();
  const { t } = useLaravelReactI18n();
  const { dataTableColumns } = usePage().props;

  const isCustomMode = useMemo(
    () => selectedComponent?.get("customMode") === true,
    [selectedComponent],
  );

  const relationName = useMemo(() => {
    const attrs = selectedComponent?.getAttributes() || {};
    return attrs["data-relations"] || "";
  }, [selectedComponent]);

  const handleModeChange = useCallback(
    (enabled) => {
      if (!selectedComponent) return;

      if (enabled) {
        // Activate Custom Mode — preserve existing structure, will trigger onCustomModeChange
        selectedComponent.set("customMode", true);
        editor.trigger("update");
      } else {
        // Deactivate Custom Mode — regenerate table from columnsConfig
        selectedComponent.set("customMode", false);

        const columnsConfig = selectedComponent.get("columnsConfig") || [];
        const visibleColumns = columnsConfig
          .filter((col) => col.show)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        if (visibleColumns.length > 0) {
          const genId = (prefix = "g") =>
            `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

          const newChildren = buildExampleDataTable({
            columns: visibleColumns,
            relationName,
            exampleData: null,
            t,
            genId,
          });

          selectedComponent.components().reset(newChildren);
        }

        editor.trigger("update");
        toast.info(
          t(
            "core.printTemplate.editor.reverted_standard_mode",
            {},
            "Table reverted to standard mode",
          ),
        );
      }
    },
    [editor, relationName, selectedComponent, t, dataTableColumns],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CustomModeToggle
        isCustomMode={isCustomMode}
        onModeChange={handleModeChange}
      />

      {isCustomMode ? (
        <div className="flex flex-col flex-1 overflow-y-auto divide-y divide-border">
          {/* Header row management */}
          <CustomModeHeaderEditor tableComponent={selectedComponent} />

          {/* Relation-scoped variable panel */}
          <CustomModeVariablePanel relationName={relationName} />
        </div>
      ) : (
        <div className="p-3">
          <p className="text-xs text-muted-foreground">
            {t(
              "core.printTemplate.editor.custom_mode_description",
              {},
              "Enable Custom Mode to control table header and body layout directly.",
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default CustomModePanel;
