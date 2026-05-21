import React, { useEffect, useMemo, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";

function resolveMonacoTheme() {
  if (typeof document === "undefined") {
    return "vs";
  }

  return document.documentElement.classList.contains("dark") ? "vs-dark" : "vs";
}

function MonacoCSSEditor({
  value,
  onChange,
  onValidationChange,
  height = "200px",
  componentId,
}) {
  const draftByComponentRef = useRef(new Map());
  const previousComponentIdRef = useRef(componentId || "global");
  const [editorValue, setEditorValue] = useState(value ?? "");
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    const previousComponentId = previousComponentIdRef.current;
    draftByComponentRef.current.set(previousComponentId, editorValue);

    const nextComponentId = componentId || "global";
    previousComponentIdRef.current = nextComponentId;

    const cachedValue = draftByComponentRef.current.get(nextComponentId);
    setEditorValue(cachedValue ?? value ?? "");
  }, [componentId]);

  useEffect(() => {
    const activeComponentId = componentId || "global";
    if (draftByComponentRef.current.has(activeComponentId)) {
      return;
    }

    setEditorValue(value ?? "");
  }, [componentId, value]);

  useEffect(() => {
    const activeComponentId = componentId || "global";
    draftByComponentRef.current.set(activeComponentId, editorValue);
  }, [componentId, editorValue]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onChange?.(editorValue);
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editorValue, isValid, onChange]);

  const options = useMemo(
    () => ({
      minimap: { enabled: false },
      lineNumbers: "on",
      folding: true,
      wordWrap: "on",
      automaticLayout: true,
      scrollBeyondLastLine: false,
      formatOnPaste: true,
      formatOnType: true,
      tabSize: 2,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
    }),
    [],
  );

  return (
    <MonacoEditor
      height={height}
      defaultLanguage="css"
      language="css"
      value={editorValue}
      onChange={(nextValue) => {
        setEditorValue(nextValue ?? "");
      }}
      onValidate={(markers) => {
        const hasErrors = markers.some((marker) => marker.severity >= 8);
        const nextIsValid = !hasErrors;

        setIsValid(nextIsValid);
        onValidationChange?.(nextIsValid, markers);
      }}
      theme={resolveMonacoTheme()}
      options={options}
    />
  );
}

export default MonacoCSSEditor;
