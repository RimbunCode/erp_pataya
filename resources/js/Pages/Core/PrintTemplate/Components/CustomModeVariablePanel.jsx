import React, { useMemo } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import VariableItem from "./VariableItem";
import { buildTitleTransLookupMap } from "../utils/variableInsertUtils";
import { filterRelationColumns } from "../utils/customModeUtils";

/**
 * Variable panel scoped to the bound relation's columns when Custom Mode is active.
 * Replaces the default document-level VariableManager.
 *
 * Includes basic columns and single-relation (type "relation") columns.
 * Excludes many-relation (type "relations") columns.
 * @param {object} props
 * @param {string} props.relationName - The relation name bound to the gjsRelationsTable
 */
function CustomModeVariablePanel({ relationName }) {
  const { t } = useLaravelReactI18n();
  const { dataTableColumns } = usePage().props;

  const relationColumns = useMemo(() => {
    return filterRelationColumns(
      Array.isArray(dataTableColumns) ? dataTableColumns : [],
      relationName,
    );
  }, [dataTableColumns, relationName]);

  const titleTransLookup = useMemo(() => {
    return buildTitleTransLookupMap(
      Array.isArray(dataTableColumns) ? dataTableColumns : [],
    );
  }, [dataTableColumns]);

  const relationPath = relationName ? `doc.${relationName}` : "";

  return (
    <div className="space-y-2 p-3">
      <h3 className="text-sm font-semibold text-muted-foreground">
        {t(
          "core.printTemplate.editor.relation_columns",
          {},
          "Relation Columns",
        )}
        {relationName && (
          <span className="ml-1 font-mono text-xs text-primary">
            ({relationName})
          </span>
        )}
      </h3>

      {relationColumns.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "core.printTemplate.editor.no_relation_variables",
            {},
            "No variables available for this relation",
          )}
        </p>
      ) : (
        <div className="space-y-1">
          {relationColumns.map((col) => (
            <VariableItem
              key={col.name}
              path={relationPath}
              titleTransLookup={titleTransLookup}
              {...col}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CustomModeVariablePanel;
