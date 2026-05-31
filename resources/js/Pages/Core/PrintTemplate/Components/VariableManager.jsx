import React, { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import VariableItem from "./VariableItem";
import { buildTitleTransLookupMap } from "../utils/variableInsertUtils";

function VariableManager() {
  const { dataTableColumns, docInfo } = usePage().props;
  const { t } = useLaravelReactI18n();

  const availableVariables = useMemo(() => {
    return Array.isArray(dataTableColumns) ? dataTableColumns : [];
  }, [dataTableColumns]);
  const titleTransLookup = useMemo(() => {
    return buildTitleTransLookupMap(availableVariables);
  }, [availableVariables]);
  /**
   * Build docInfo variables from the docInfo prop.
   * Each field in docInfo becomes a draggable variable generating {{docInfo.<field>}} tokens.
   * Shown on all printTemplate types (letter_head and document).
   *
   * Requirements: 15.1, 15.2, 15.3, 15.4
   */
  const docInfoVariables = useMemo(() => {
    if (!docInfo || typeof docInfo !== "object") return [];

    return Object.keys(docInfo).map((key) => ({
      name: key,
      title: key,
      type: "docInfo",
      parentType: "docInfo",
    }));
  }, [docInfo]);

  return (
    <div className="max-h-[80vh] space-y-3 overflow-y-auto p-3 text-left">
      <h3 className="text-base font-semibold">
        {t("core.printTemplate.editor.document_variables")}
      </h3>

      {!availableVariables.length ? (
        <p className="text-sm text-muted-foreground">
          {t("core.printTemplate.editor.no_variables_available")}
        </p>
      ) : (
        <div className="space-y-2">
          {availableVariables.map((variable) => (
            <VariableItem
              key={variable.name}
              titleTransLookup={titleTransLookup}
              {...variable}
            />
          ))}
        </div>
      )}

      {/* DocInfo group - shown on all printTemplate types (letter_head and document) */}
      {docInfoVariables.length > 0 && (
        <>
          <h3 className="text-base font-semibold">
            {t("core.printTemplate.editor.doc_info")}
          </h3>
          <div className="space-y-2">
            {docInfoVariables.map((variable) => (
              <VariableItem
                key={`docInfo.${variable.name}`}
                titleTransLookup={titleTransLookup}
                {...variable}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default VariableManager;
