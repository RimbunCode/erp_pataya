export function resolveCssModalInitialDraft({
  cssDraft = "",
  selectedComponentId = "",
  isBodyNode = false,
} = {}) {
  if (typeof cssDraft === "string" && cssDraft.trim()) {
    return cssDraft;
  }

  if (isBodyNode) {
    return typeof cssDraft === "string" ? cssDraft : "";
  }

  const componentId = String(selectedComponentId || "").trim();
  if (!componentId) {
    return typeof cssDraft === "string" ? cssDraft : "";
  }

  return `#${componentId}{ }`;
}

export function isSaveShortcut(event) {
  if (!event) {
    return false;
  }

  const isMetaPressed = Boolean(event.ctrlKey || event.metaKey);
  const pressedKey = String(event.key || "").toLowerCase();

  return isMetaPressed && pressedKey === "s";
}

export function handleModalEditorKeyDown(event, onSave) {
  if (!event) {
    return false;
  }

  if (event.key === "/") {
    event.stopPropagation?.();
  }

  if (!isSaveShortcut(event)) {
    return false;
  }

  event.preventDefault?.();
  event.stopPropagation?.();
  onSave?.();
  return true;
}
