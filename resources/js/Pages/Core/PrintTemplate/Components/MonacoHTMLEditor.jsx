import React, { useMemo } from "react";
import MonacoEditor from "@monaco-editor/react";

function resolveMonacoTheme() {
  if (typeof document === "undefined") {
    return "vs";
  }

  return document.documentElement.classList.contains("dark") ? "vs-dark" : "vs";
}

function MonacoHTMLEditor({
  value,
  onChange,
  height = "300px",
  readOnly = false,
}) {
  const options = useMemo(
    () => ({
      readOnly,
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
    [readOnly],
  );

  return (
    <MonacoEditor
      height={height}
      defaultLanguage="html"
      language="html"
      value={value ?? ""}
      onChange={(nextValue) => onChange?.(nextValue ?? "")}
      theme={resolveMonacoTheme()}
      options={options}
    />
  );
}

export default MonacoHTMLEditor;
