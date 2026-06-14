import React, { useEffect, useState } from "react";
import { AlertTriangle, Code2 } from "lucide-react";
import { useEditor } from "@grapesjs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Button } from "@/Components/ui/button";

function findStaticHTMLComponent(component) {
  let current = component;

  while (current) {
    if (current.get?.("type") === "staticHTML") {
      return current;
    }

    current = current.parent?.();
  }

  return null;
}

function extractStaticHTMLState(component) {
  if (!component) {
    return {
      selectedComponent: null,
      rawHTML: "",
      sanitizedHTML: "",
      warnings: [],
    };
  }

  const warnings = component.get?.("sanitizationWarnings");

  return {
    selectedComponent: component,
    rawHTML: component.get?.("customHTML") || "",
    sanitizedHTML: component.get?.("sanitizedHTML") || "",
    warnings: Array.isArray(warnings) ? warnings : [],
  };
}

function StaticHTMLInspector() {
  const { t } = useLaravelReactI18n();
  const editor = useEditor();
  const [state, setState] = useState(() => extractStaticHTMLState(null));

  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateSelection = (component) => {
      const selected = component || editor.getSelected();
      const staticHTMLComponent = findStaticHTMLComponent(selected);
      setState(extractStaticHTMLState(staticHTMLComponent));
    };

    editor.on("component:selected", updateSelection);
    editor.on("component:deselected", updateSelection);
    editor.on("component:update", updateSelection);

    updateSelection();

    return () => {
      editor.off("component:selected", updateSelection);
      editor.off("component:deselected", updateSelection);
      editor.off("component:update", updateSelection);
    };
  }, [editor]);

  if (!state.selectedComponent) {
    return (
      <div className="p-4 border rounded-md border-muted-foreground/25 bg-background">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Code2 className="h-4 w-4" />
          {t("core.printTemplate.editor.static_html_inspector")}
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("core.printTemplate.editor.select_html_component")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-md border-muted-foreground/25 bg-background space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Code2 className="h-4 w-4" />
          {t("core.printTemplate.editor.static_html_inspector")}
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            editor.trigger("staticHTML:edit", state.selectedComponent)
          }
        >
          {t("core.printTemplate.editor.edit_html")}
        </Button>
      </div>

      <div className="space-y-1 text-xs">
        <p className="font-medium">{t("core.printTemplate.editor.raw_html")}</p>
        <pre className="max-h-32 overflow-auto rounded-md border border-muted-foreground/20 bg-muted/40 p-2 whitespace-pre-wrap break-all">
          {state.rawHTML || "-"}
        </pre>
      </div>

      {state.warnings.length > 0 && (
        <div className="rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 p-2">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">
              {t("core.printTemplate.editor.sanitization_warning")}
            </span>
          </div>
          <ul className="mt-1 space-y-1 text-xs text-amber-700 dark:text-amber-300">
            {state.warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1 text-xs">
        <p className="font-medium">
          {t("core.printTemplate.editor.sanitized_preview")}
        </p>
        <div className="max-h-40 overflow-auto rounded-md border border-muted-foreground/20 bg-white dark:bg-zinc-950 p-2">
          {state.sanitizedHTML ? (
            <div dangerouslySetInnerHTML={{ __html: state.sanitizedHTML }} />
          ) : (
            <p className="text-muted-foreground italic">
              {t("core.printTemplate.editor.no_html_stored")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default StaticHTMLInspector;
