# Print Editor Bugfixes Design

## Overview

This design addresses four bugs in the GrapesJS-based Print Template Editor:

1. **Drag and Drop Failure**: Blocks from `CustomBlockManager` and variables from `VariableItem` cannot be dropped onto the canvas because the HTML5 native drag events (`onDragStart`/`onDragEnd`) are not compatible with GrapesJS's internal sorter system.
2. **Missing CSS Default Template**: When opening the Manual CSS modal (`CSSEditorModal`) with a selected node that has no existing CSS, the editor shows an empty textarea instead of providing a `#<node_id>{ }` template as a starting point.
3. **CSS Format Not Kebab-Case**: The `cssUtils.js` module and `CSSEditorModal` accept camelCase CSS property names without normalizing them to kebab-case before applying styles.
4. **Missing Ctrl+S Shortcut**: Neither `CSSEditorModal` nor `StaticHTMLComponent` intercept `Ctrl+S`/`Cmd+S` keyboard events to trigger their respective save actions.

## Glossary

- **Bug_Condition (C)**: The set of conditions that trigger each bug — drag events from sidebar panels, empty CSS on modal open, camelCase property names, and Ctrl+S keypress inside modals
- **Property (P)**: The desired correct behavior — successful component insertion, default CSS template display, kebab-case normalization, and keyboard-triggered save
- **Preservation**: Existing behaviors that must remain unchanged — click-to-insert variables, global Ctrl+S save, existing CSS display, valid kebab-case acceptance, cancel/close behavior
- **GrapesJS Sorter**: The internal drag-and-drop system in GrapesJS that manages component placement via `editor.getModel().get('dragMode')` and block drag APIs
- **`BlocksProvider`**: The `@grapesjs/react` component that provides `dragStart(block, nativeEvent)` and `dragStop(cancel)` callbacks for block dragging
- **`canvas:dragdata`**: GrapesJS event fired when external data is dropped onto the canvas, allowing interception of `dataTransfer` payloads
- **`componentIdOf()`**: Helper function in `CustomStyleManager.jsx` that returns the component's `cid` or `getId()` value

## Bug Details

### Bug Condition

The bugs manifest across four distinct scenarios in the Print Template Editor:

**Bug 1 & 2 — Drag and Drop**: The `CustomBlockManager` uses `dragStart(block, ev.nativeEvent)` from `BlocksProvider` which calls GrapesJS's internal block drag API. However, the native `draggable` attribute and `onDragStart`/`onDragEnd` React events conflict with GrapesJS's sorter mechanism. The `VariableItem` sets `dataTransfer.setData("variable/json", ...)` but the canvas iframe may not receive the HTML5 drop event properly because GrapesJS expects its own drag coordination.

**Bug 3 — CSS Default Template**: In `CustomStyleManager.jsx`, when a component is selected and has no cached CSS draft, `cssDraft` is set from `styleObjectToCssText(selectedComponent.getStyle())`. If the component has no inline styles, `cssDraft` becomes an empty string. The `CSSEditorModal` receives this empty string as `initialCSS` and displays nothing — no `#<node_id>{ }` template is provided.

**Bug 4 — CSS Kebab-Case**: The `parseCssDeclarations()` function in `cssUtils.js` calls `.toLowerCase()` on property names but does NOT convert camelCase to kebab-case. For example, `backgroundColor` becomes `backgroundcolor` (invalid) instead of `background-color`.

**Bug 5 & 6 — Ctrl+S in Modals**: Neither `CSSEditorModal` nor `StaticHTMLComponent` have `onKeyDown` handlers that intercept `Ctrl+S`/`Cmd+S`. The keyboard event propagates to the browser default (download page) or is swallowed without triggering the modal's save function.

**Formal Specification:**

```
FUNCTION isBugCondition_DragDrop(input)
  INPUT: input of type DragEvent from CustomBlockManager or VariableItem to Canvas
  OUTPUT: boolean

  RETURN input.source IN {CustomBlockManager, VariableItem}
         AND input.target = GrapesJS_Canvas
         AND NOT componentInsertedSuccessfully(input)
END FUNCTION

FUNCTION isBugCondition_CSSDefault(input)
  INPUT: input of type CSSModalOpenEvent
  OUTPUT: boolean

  RETURN input.selectedComponent != null
         AND input.selectedComponent.getId() != null
         AND cssByComponentRef.get(componentId) = undefined
         AND styleObjectToCssText(selectedComponent.getStyle()) = ""
END FUNCTION

FUNCTION isBugCondition_CSSFormat(input)
  INPUT: input of type string (CSS property name)
  OUTPUT: boolean

  RETURN input.matches(/[A-Z]/) = true
END FUNCTION

FUNCTION isBugCondition_CtrlS(input)
  INPUT: input of type KeyboardEvent
  OUTPUT: boolean

  RETURN (input.ctrlKey OR input.metaKey)
         AND input.key = "s"
         AND input.context IN {CSSEditorModal, StaticHTMLComponent}
END FUNCTION
```

### Examples

- **Drag Block**: User drags "Text" block from Block panel to canvas → block is NOT inserted, no visual feedback on canvas
- **Drag Variable**: User drags `customer_name` from Variables panel to canvas → variable component is NOT created on canvas
- **CSS Default**: User selects a `<div>` with id `i7k2` and opens Manual CSS → editor shows empty content instead of `#i7k2{ }`
- **CSS Format**: User types `fontSize: 14px;` in CSS editor → applied as `fontsize: 14px` (invalid) instead of `font-size: 14px`
- **Ctrl+S CSS Modal**: User presses Ctrl+S in CSS editor modal → browser attempts to download page instead of saving CSS
- **Ctrl+S HTML Modal**: User presses Ctrl+S in Static HTML modal → browser attempts to download page instead of saving HTML

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Click-to-insert on `VariableItem` must continue to work (insert variable into selected text component or create new component)
- Global `Ctrl+S` on the main editor canvas must continue to trigger `core:save-template` command
- When a component already has cached CSS in `cssByComponentRef`, the modal must show that cached CSS (not the default template)
- CSS properties already in valid kebab-case format must be accepted without modification
- Cancel/Close buttons on both modals must discard unsaved changes
- The `/` key prevention in Monaco editors must continue to stop GrapesJS command palette propagation
- Mobile mode restrictions on drag-and-drop must remain in effect

**Scope:**
All inputs that do NOT match the bug conditions should be completely unaffected by these fixes. This includes:

- Mouse clicks on blocks and variables (click-to-insert)
- Keyboard shortcuts outside of modals
- CSS text that is already in valid kebab-case format
- Opening CSS modal when existing CSS is cached for the component

## Hypothesized Root Cause

Based on code analysis, the root causes are:

1. **Drag and Drop — GrapesJS Sorter Conflict**: The `CustomBlockManager` correctly receives `dragStart` and `dragStop` from `BlocksProvider`, but the React `onDragStart` handler fires the native event which conflicts with GrapesJS's internal sorter. GrapesJS's block drag system expects to control the entire drag lifecycle. The `VariableItem` uses native HTML5 `dataTransfer.setData()` which works with the `canvas:dragdata` event listener, but the drag initiation itself may not trigger GrapesJS's drop zone detection because the canvas iframe doesn't receive the native drag events from the parent frame.

2. **CSS Default Template — Missing Initial Value Logic**: In `CustomStyleManager.jsx`, the `cssDraft` state is set from either the cached value or `styleObjectToCssText()`. When both are empty, the `CSSEditorModal` receives `initialCSS=""`. There is no logic to generate a default `#<node_id>{ }` template when the CSS is empty and a component is selected.

3. **CSS Kebab-Case — Incomplete Normalization**: `parseCssDeclarations()` in `cssUtils.js` uses `.toLowerCase()` which converts `backgroundColor` to `backgroundcolor` — a single lowercase word that is not valid CSS. The function lacks a camelCase-to-kebab-case conversion step (inserting `-` before uppercase letters).

4. **Ctrl+S — Missing Event Handler**: Both `CSSEditorModal` and `StaticHTMLComponent` have `onKeyDown` handlers that only intercept the `/` key. Neither component listens for `Ctrl+S`/`Cmd+S` to trigger their save functions.

## Correctness Properties

Property 1: Bug Condition - Drag and Drop Inserts Components

_For any_ drag event originating from `CustomBlockManager` or `VariableItem` panel targeting the GrapesJS canvas, the fixed drag-and-drop mechanism SHALL successfully insert the corresponding block or variable component at the drop position on the canvas.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - CSS Default Template Provided

_For any_ CSS modal open event where a component is selected and no existing CSS is stored for that component, the fixed `CSSEditorModal` SHALL display a default template of `#<node_id>{ }` (where `<node_id>` is the selected component's ID) as the initial editor content.

**Validates: Requirements 2.3**

Property 3: Bug Condition - CSS Properties Normalized to Kebab-Case

_For any_ CSS property name containing uppercase letters (camelCase format), the fixed `parseCssDeclarations` function SHALL convert it to valid kebab-case format by inserting a hyphen before each uppercase letter and lowercasing the result.

**Validates: Requirements 2.4**

Property 4: Bug Condition - Ctrl+S Triggers Save in Modals

_For any_ keyboard event where Ctrl+S (or Cmd+S on macOS) is pressed while `CSSEditorModal` or `StaticHTMLComponent` is open, the fixed modal SHALL prevent the browser default action and execute the same save function as clicking the Save/Apply button.

**Validates: Requirements 2.5, 2.6**

Property 5: Preservation - Existing Click-to-Insert Behavior

_For any_ click event on a `VariableItem` (not a drag), the fixed code SHALL produce the same result as the original code, preserving the click-to-insert functionality that adds variables to the selected component.

**Validates: Requirements 3.1**

Property 6: Preservation - Global Ctrl+S and Non-Bug Inputs

_For any_ input that does NOT match the bug conditions (global Ctrl+S outside modals, existing cached CSS, valid kebab-case properties, cancel/close actions), the fixed code SHALL produce exactly the same behavior as the original code.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `resources/js/Pages/Core/PrintTemplate/Components/CustomBlockManager.jsx`

**Change 1 — Fix Block Drag Integration with GrapesJS**:

- Remove the native `draggable` attribute and React `onDragStart`/`onDragEnd` handlers
- Use `onMouseDown` to initiate GrapesJS's internal block drag via `dragStart(block, event)` from `BlocksProvider`
- Use `onMouseUp` or document-level listener to call `dragStop(false)` when drag ends
- This aligns with how GrapesJS expects block dragging to work — through its sorter system, not HTML5 drag API

**File**: `resources/js/Pages/Core/PrintTemplate/Components/VariableItem.jsx`

**Change 2 — Fix Variable Drag Integration with GrapesJS**:

- Instead of relying solely on native HTML5 `dataTransfer.setData()`, use GrapesJS's `editor.trigger('canvas:dragenter')` or initiate a synthetic block drag
- Alternative approach: Use `onMouseDown` to start a GrapesJS-compatible drag operation that sets the content via `editor.addComponents()` at the drop position
- Ensure the `canvas:dragdata` event is properly triggered by using GrapesJS's drag coordination APIs

**File**: `resources/js/Pages/Core/PrintTemplate/Components/CustomStyleManager.jsx`

**Change 3 — Provide Default CSS Template**:

- When opening the CSS modal (`setCssModalOpen(true)`), compute the `initialCSS` value
- If `cssDraft` is empty and `selectedComponent` exists, generate `#<componentId>{ }` as the default
- Pass this computed value to `CSSEditorModal` as `initialCSS` instead of raw `cssDraft`
- Only apply this default when `isBodyNode` is false (body node uses different CSS format)

**File**: `resources/js/Pages/Core/PrintTemplate/utils/cssUtils.js`

**Change 4 — Add camelCase to Kebab-Case Conversion**:

- Add a `toKebabCase(property)` helper function that converts camelCase to kebab-case: `property.replace(/[A-Z]/g, m => '-' + m.toLowerCase())`
- Modify `parseCssDeclarations()` to apply `toKebabCase()` before `.toLowerCase()` on property names
- Export `toKebabCase` for use in tests

**File**: `resources/js/Pages/Core/PrintTemplate/Components/CSSEditorModal.jsx`

**Change 5 — Add Ctrl+S Keyboard Shortcut**:

- Add an `onKeyDown` handler on the `DialogContent` wrapper (or the existing `div` wrapping `MonacoCSSEditor`)
- Intercept `(e.ctrlKey || e.metaKey) && e.key === 's'`
- Call `e.preventDefault()` and `e.stopPropagation()` to prevent browser default
- Invoke `handleSave()` to save and close the modal

**File**: `resources/js/Pages/Core/PrintTemplate/Components/StaticHTMLComponent.jsx`

**Change 6 — Add Ctrl+S Keyboard Shortcut**:

- Add an `onKeyDown` handler on the `DialogContent` wrapper
- Intercept `(e.ctrlKey || e.metaKey) && e.key === 's'`
- Call `e.preventDefault()` and `e.stopPropagation()` to prevent browser default
- Invoke `handleSave()` to save and close the modal

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that simulate the bug conditions and assert the expected behavior fails on unfixed code.

**Test Cases**:

1. **Block Drag Test**: Simulate `onDragStart` on a block element and verify the block is NOT inserted into the canvas (will fail on unfixed code — confirms drag doesn't work)
2. **Variable Drag Test**: Simulate drag of a VariableItem and verify the `canvas:dragdata` event is NOT properly triggered (will fail on unfixed code)
3. **CSS Default Template Test**: Open CSSEditorModal with empty `initialCSS` and a selected component → verify no default template is shown (will fail on unfixed code)
4. **CSS Kebab-Case Test**: Call `parseCssDeclarations("backgroundColor: red;")` → verify it returns `{ "backgroundcolor": "red" }` instead of `{ "background-color": "red" }` (will fail on unfixed code — confirms incorrect normalization)
5. **Ctrl+S CSS Modal Test**: Simulate Ctrl+S keydown inside CSSEditorModal → verify `handleSave` is NOT called (will fail on unfixed code)
6. **Ctrl+S HTML Modal Test**: Simulate Ctrl+S keydown inside StaticHTMLComponent → verify `handleSave` is NOT called (will fail on unfixed code)

**Expected Counterexamples**:

- `parseCssDeclarations("backgroundColor: red;")` returns `{ "backgroundcolor": "red" }` — invalid CSS property
- CSSEditorModal shows empty editor when component has no CSS
- Ctrl+S in modals triggers browser download dialog

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**

```
FOR ALL input WHERE isBugCondition_CSSFormat(input) DO
  result := parseCssDeclarations_fixed(input)
  ASSERT Object.keys(result).every(key => key === toKebabCase(key))
END FOR

FOR ALL input WHERE isBugCondition_CSSDefault(input) DO
  result := getInitialCSS_fixed(input.componentId, input.cssDraft)
  ASSERT result === "#" + input.componentId + "{ }"
END FOR

FOR ALL input WHERE isBugCondition_CtrlS(input) DO
  result := handleKeyDown_fixed(input)
  ASSERT result.defaultPrevented = true AND result.saveTriggered = true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**

```
FOR ALL input WHERE NOT isBugCondition_CSSFormat(input) DO
  ASSERT parseCssDeclarations_original(input) = parseCssDeclarations_fixed(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_CSSDefault(input) DO
  ASSERT getInitialCSS_original(input) = getInitialCSS_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for the CSS kebab-case conversion because:

- It generates many random CSS property names to verify correct conversion
- It catches edge cases like properties with multiple uppercase letters, vendor prefixes, or already-kebab-case names
- It provides strong guarantees that valid kebab-case properties pass through unchanged

**Test Plan**: Observe behavior on UNFIXED code first for valid CSS properties and non-modal keyboard events, then write property-based tests capturing that behavior.

**Test Cases**:

1. **CSS Kebab-Case Preservation**: Verify that `parseCssDeclarations("font-size: 12px;")` continues to return `{ "font-size": "12px" }` after the fix
2. **Existing CSS Display Preservation**: Verify that when `cssByComponentRef` has cached CSS for a component, the modal shows that cached CSS (not the default template)
3. **Click-to-Insert Preservation**: Verify that clicking a VariableItem still inserts the variable into the selected component
4. **Cancel/Close Preservation**: Verify that closing modals without saving discards changes

### Unit Tests

- Test `toKebabCase()` with various inputs: `backgroundColor` → `background-color`, `fontSize` → `font-size`, `WebkitTransform` → `-webkit-transform`
- Test `parseCssDeclarations()` with camelCase properties returns kebab-case keys
- Test CSS default template generation logic
- Test Ctrl+S event handler prevents default and triggers save
- Test that already-kebab-case properties are unchanged

### Property-Based Tests

- Generate random camelCase strings and verify `toKebabCase()` produces valid kebab-case output (no uppercase, hyphens before former-uppercase positions)
- Generate random valid kebab-case CSS property names and verify `parseCssDeclarations()` preserves them unchanged (preservation property)
- Generate random CSS declaration strings mixing camelCase and kebab-case and verify all output keys are valid kebab-case

### Integration Tests

- Test full drag-and-drop flow from Block panel to canvas
- Test full drag-and-drop flow from Variable panel to canvas
- Test opening CSS modal with empty component → verify default template appears
- Test Ctrl+S in CSS modal saves and closes
- Test Ctrl+S in HTML modal saves and closes
- Test that global Ctrl+S still works when modals are closed
