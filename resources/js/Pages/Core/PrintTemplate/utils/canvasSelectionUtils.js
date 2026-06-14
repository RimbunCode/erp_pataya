function resolveEventTargetElement(rawTarget) {
  if (!rawTarget || typeof rawTarget !== "object") {
    return null;
  }

  if (typeof rawTarget.closest === "function") {
    return rawTarget;
  }

  if (
    rawTarget.nodeType === 3 &&
    rawTarget.parentElement &&
    typeof rawTarget.parentElement.closest === "function"
  ) {
    return rawTarget.parentElement;
  }

  return null;
}

export function shouldClearSelectionOnCanvasClick({
  target,
  wrapperElement = null,
} = {}) {
  const element = resolveEventTargetElement(target);
  if (!element) {
    return false;
  }

  const ownerDocument = element.ownerDocument;
  if (ownerDocument) {
    if (
      element === ownerDocument.body ||
      element === ownerDocument.documentElement
    ) {
      return true;
    }
  }

  const closestComponentElement = element.closest?.("[data-gjs-type]");
  if (!closestComponentElement) {
    return true;
  }

  if (wrapperElement && closestComponentElement === wrapperElement) {
    return true;
  }

  const componentType = String(
    closestComponentElement.getAttribute?.("data-gjs-type") || "",
  ).toLowerCase();

  return componentType === "wrapper";
}

export function removeAllSelectedComponents(editor) {
  if (
    !editor ||
    typeof editor.getSelectedAll !== "function" ||
    typeof editor.removeSelected !== "function"
  ) {
    return false;
  }

  const selectedComponents = editor.getSelectedAll() || [];
  if (!Array.isArray(selectedComponents) || selectedComponents.length === 0) {
    return false;
  }

  editor.removeSelected(selectedComponents);
  return true;
}
