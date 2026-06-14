# Implementation Plan: Print Editor Style Manager - GrapeJS Layout

## Overview

Implementasi redesain `CustomStyleManager.jsx` dengan pendekatan bottom-up: mulai dari utility functions dan atomic components, lalu composite components, dan terakhir integrasi ke CustomStyleManager. Setiap komponen menggunakan shadcn UI components yang sudah ada (ButtonGroup, InputGroup, Input, Select, Accordion) dan lucide-react icons.

## Tasks

- [x] 1. Create utility functions (parseValueAndUnit, combineValueUnit, mapSectorsToSections, resolveFieldComponent)
  - [x] 1.1 Create `resources/js/Pages/Core/PrintTemplate/utils/styleManagerUtils.js` with parseValueAndUnit and combineValueUnit functions
    - Parse CSS value strings into { numericValue, unit } objects
    - Combine numericValue + unit into CSS value strings
    - Handle edge cases: "auto", empty values, purely numeric values, unrecognized units
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  - [x] 1.2 Add mapSectorsToSections function to styleManagerUtils.js
    - Define SECTION_MAP constant with property ID categorization
    - Flatten all properties from sectors, filter hidden ones
    - Categorize each property into dimension/typography/decorations/background/advanced
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 1.3 Add resolveFieldComponent function to styleManagerUtils.js
    - Map property ID/type to the correct field component
    - Handle special cases: text-align, text-decoration, font-style, composite spacing, border, color, dimension
    - Fallback to default Input for unrecognized types
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_
  - [x]\* 1.4 Write property tests for parseValueAndUnit/combineValueUnit round-trip
    - **Property 1: Value-Unit Round Trip**
    - **Validates: Requirements 11.2, 11.7, 2.3, 2.4, 2.5**
  - [x]\* 1.5 Write property test for mapSectorsToSections completeness
    - **Property 2: Section Mapping Completeness**
    - **Validates: Requirements 1.1, 1.6**
  - [x]\* 1.6 Write unit tests for parseValueAndUnit edge cases and mapSectorsToSections specific mappings
    - Test "auto" input, empty input, numeric-only input
    - Test specific property IDs map to correct sections
    - Test resolveFieldComponent returns correct component types
    - _Requirements: 11.1, 11.3, 11.4, 11.5, 11.6, 1.2, 1.3, 1.4, 1.5, 10.1-10.9_

- [x] 2. Create UnitInputField component
  - [x] 2.1 Create `resources/js/Pages/Core/PrintTemplate/Components/StyleFields/UnitInputField.jsx`
    - Render InputGroup with numeric Input + unit Select dropdown
    - Use parseValueAndUnit to split current prop value
    - Use combineValueUnit to construct new value on change
    - Handle "auto" special case (disable numeric input)
    - Support configurable units array (default: px, %, em, rem, vw, vh, auto)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  - [ ]\* 2.2 Write property test for unit selector consistency
    - **Property 3: Unit Selector Consistency**
    - **Validates: Requirements 2.4, 2.5**

- [x] 3. Create CompositeSpacingField component
  - [x] 3.1 Create `resources/js/Pages/Core/PrintTemplate/Components/StyleFields/CompositeSpacingField.jsx`
    - Render 4 UnitInputField components in horizontal row
    - Label each with T, R, B, L
    - Bind each to corresponding sub-property from composite GrapeJS property
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4. Create TextAlignButtons component
  - [x] 4.1 Create `resources/js/Pages/Core/PrintTemplate/Components/StyleFields/TextAlignButtons.jsx`
    - Render ButtonGroup with AlignLeft, AlignCenter, AlignRight, AlignJustify icons
    - Highlight active button based on current prop value
    - Call prop.upValue() on button click
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]\* 4.2 Write property test for button group state
    - **Property 4: Button Group State Reflects Property Value**
    - **Validates: Requirements 3.2, 3.4**

- [x] 5. Create TextDecorationButtons and FontStyleButtons components
  - [x] 5.1 Create `resources/js/Pages/Core/PrintTemplate/Components/StyleFields/TextDecorationButtons.jsx`
    - Render ButtonGroup with Type (none), Underline, Strikethrough icons
    - Highlight active button based on current prop value
    - Call prop.upValue() on button click
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 Create `resources/js/Pages/Core/PrintTemplate/Components/StyleFields/FontStyleButtons.jsx`
    - Render ButtonGroup with "A" (normal) and "I" (italic) buttons
    - Highlight active button based on current prop value
    - Call prop.upValue() on button click
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Create BorderField component
  - [x] 6.1 Create `resources/js/Pages/Core/PrintTemplate/Components/StyleFields/BorderField.jsx`
    - Render border-width UnitInputField + border-style Select + border-color ColorField in one row
    - Use sub-properties from composite border GrapeJS property
    - Support border-style options: none, solid, dashed, dotted, double, groove, ridge, inset, outset
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7. Create ColorField component
  - [x] 7.1 Create `resources/js/Pages/Core/PrintTemplate/Components/StyleFields/ColorField.jsx`
    - Render InputGroup with clickable color swatch + hex text input
    - Synchronize swatch background with current value
    - Open native color picker on swatch click
    - Update prop.upValue() on color change from picker or text input
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 8. Checkpoint - Verify all field components
  - Ensure all tests pass, ask the user if questions arise.
  - Verify each field component renders correctly in isolation

- [x] 9. Refactor CustomStyleManager to use new section-based layout
  - [x] 9.1 Update `CustomStyleManager.jsx` to use mapSectorsToSections instead of filteredSectors
    - Replace normalizeSectorName logic with mapSectorsToSections
    - Render sections using Accordion with section labels (Dimension, Typography, Decorations, Background)
    - Keep layout controls (flex/grid), class manager, and manual CSS editor sections unchanged
    - _Requirements: 1.7, 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 9.2 Integrate resolveFieldComponent into section rendering
    - Replace direct StylePropertyField usage with resolveFieldComponent-based rendering
    - Each property renders with the appropriate specialized field component
    - Maintain the hasValue indicator styling (emerald border/dot)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_
  - [x] 9.3 Create index barrel file for StyleFields components
    - Create `resources/js/Pages/Core/PrintTemplate/Components/StyleFields/index.js`
    - Export all field components for clean imports
    - _Requirements: 10.1-10.9_

- [ ] 10. Final checkpoint - Ensure all tests pass and UI renders correctly
  - Ensure all tests pass, ask the user if questions arise.
  - Verify section reorganization displays correctly
  - Verify all field components integrate properly with GrapeJS property API
  - Verify existing functionality (flex/grid controls, class manager, CSS editor) still works

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All components use existing shadcn UI components (ButtonGroup, InputGroup, Input, Select, Accordion)
- Icons from lucide-react: AlignLeft, AlignCenter, AlignRight, AlignJustify, Underline, Strikethrough, Type
- Field components are placed in a new `StyleFields/` subdirectory for organization

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5", "1.6", "2.1", "7.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "5.1", "5.2", "6.1"] },
    { "id": 3, "tasks": ["4.2", "8"] },
    { "id": 4, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 5, "tasks": ["10"] }
  ]
}
```
