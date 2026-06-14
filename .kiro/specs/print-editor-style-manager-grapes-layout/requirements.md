# Requirements Document

## Introduction

Dokumen ini mendefinisikan requirements untuk redesain komponen `CustomStyleManager.jsx` agar mengikuti layout default GrapeJS Style Manager. Perubahan meliputi reorganisasi section berdasarkan kategori CSS, penambahan unit selector pada field dimensi, penggunaan icon button groups untuk text-align/decoration/font-style, composite fields untuk margin/padding, border controls terintegrasi, dan color fields yang konsisten.

## Glossary

- **Style_Manager**: Komponen React `CustomStyleManager.jsx` yang menampilkan dan mengelola CSS properties dari GrapeJS editor
- **Section_Mapper**: Utility function yang mengkategorikan GrapeJS properties ke dalam section berdasarkan property ID
- **UnitInputField**: Komponen input field dengan unit selector dropdown untuk properti dimensi
- **CompositeSpacingField**: Komponen yang merender 4 inline fields (Top, Right, Bottom, Left) untuk margin/padding
- **TextAlignButtons**: Komponen ButtonGroup dengan icon buttons untuk text-align
- **TextDecorationButtons**: Komponen ButtonGroup dengan icon buttons untuk text-decoration
- **FontStyleButtons**: Komponen ButtonGroup toggle untuk font-style (normal/italic)
- **BorderField**: Komponen yang merender border controls (width + style + color) dalam satu baris
- **ColorField**: Komponen color picker + hex input yang konsisten
- **GrapeJS_Property**: Object dari GrapeJS API yang merepresentasikan satu CSS property dengan methods getValue(), upValue(), getType(), getId()
- **Sector**: Grouping default dari GrapeJS yang berisi kumpulan properties

## Requirements

### Requirement 1: Reorganisasi Section

**User Story:** Sebagai pengguna print editor, saya ingin CSS properties dikelompokkan ke dalam section yang terstruktur (Dimension, Typography, Decorations, Background), sehingga saya dapat menemukan dan mengedit properti dengan lebih mudah.

#### Acceptance Criteria

1. WHEN the Style_Manager receives GrapeJS sectors, THE Section_Mapper SHALL categorize all properties into exactly one of: Dimension, Typography, Decorations, Background, or Advanced sections
2. THE Section_Mapper SHALL place width, height, max-width, min-width, max-height, min-height, margin, margin-top, margin-right, margin-bottom, margin-left, padding, padding-top, padding-right, padding-bottom, padding-left into the Dimension section
3. THE Section_Mapper SHALL place font-family, font-size, font-weight, font-style, letter-spacing, line-height, color, text-align, text-decoration, text-shadow, vertical-align into the Typography section
4. THE Section_Mapper SHALL place background-color, opacity, border-collapse, border-radius, border-top-left-radius, border-top-right-radius, border-bottom-left-radius, border-bottom-right-radius, border, border-width, border-style, border-color, box-shadow into the Decorations section
5. THE Section_Mapper SHALL place background-image, background-repeat, background-position, background-size, background-attachment into the Background section
6. WHEN a property does not match any predefined section, THE Section_Mapper SHALL place it in the Advanced section
7. THE Style_Manager SHALL render each non-empty section as an Accordion item with the section label as trigger

### Requirement 2: Unit Input Fields

**User Story:** Sebagai pengguna print editor, saya ingin field dimensi memiliki unit selector dropdown, sehingga saya dapat dengan mudah mengubah unit CSS tanpa mengetik manual.

#### Acceptance Criteria

1. THE UnitInputField SHALL render an InputGroup containing a numeric input and a unit selector dropdown
2. THE UnitInputField SHALL support units: px, %, em, rem, vw, vh, auto
3. WHEN a CSS value string is provided (e.g., "200px"), THE UnitInputField SHALL parse it into separate numeric value and unit parts
4. WHEN the user changes the numeric value, THE UnitInputField SHALL combine the new value with the current unit and call prop.upValue() with the combined string
5. WHEN the user changes the unit from the dropdown, THE UnitInputField SHALL combine the current numeric value with the new unit and call prop.upValue() with the combined string
6. WHEN the unit "auto" is selected, THE UnitInputField SHALL disable the numeric input and call prop.upValue("auto")
7. WHEN the input value is purely numeric without a recognized unit, THE UnitInputField SHALL default the unit to "px"
8. THE UnitInputField SHALL be used for width, height, max-width, min-width, max-height, min-height, font-size, letter-spacing, and line-height properties

### Requirement 3: Text Align Group Buttons

**User Story:** Sebagai pengguna print editor, saya ingin text-align ditampilkan sebagai icon buttons, sehingga saya dapat memilih alignment secara visual dan cepat.

#### Acceptance Criteria

1. THE TextAlignButtons SHALL render a ButtonGroup with four icon buttons: AlignLeft, AlignCenter, AlignRight, AlignJustify
2. WHEN the current text-align value matches a button, THE TextAlignButtons SHALL display that button in active/pressed state
3. WHEN the user clicks an alignment button, THE TextAlignButtons SHALL call prop.upValue() with the corresponding value (left, center, right, justify)
4. THE TextAlignButtons SHALL have exactly one button in active state at any time when a valid text-align value is set

### Requirement 4: Text Decoration Group Buttons

**User Story:** Sebagai pengguna print editor, saya ingin text-decoration ditampilkan sebagai icon buttons, sehingga saya dapat menambahkan underline atau strikethrough secara visual.

#### Acceptance Criteria

1. THE TextDecorationButtons SHALL render a ButtonGroup with icon buttons for: none (Type icon), underline (Underline icon), line-through (Strikethrough icon)
2. WHEN the current text-decoration value matches a button, THE TextDecorationButtons SHALL display that button in active/pressed state
3. WHEN the user clicks a decoration button, THE TextDecorationButtons SHALL call prop.upValue() with the corresponding value (none, underline, line-through)

### Requirement 5: Font Style Toggle

**User Story:** Sebagai pengguna print editor, saya ingin font-style ditampilkan sebagai toggle buttons (Normal/Italic), sehingga saya dapat mengubah style font dengan satu klik.

#### Acceptance Criteria

1. THE FontStyleButtons SHALL render a ButtonGroup with two buttons: "A" for normal and "I" for italic
2. WHEN the current font-style value is "italic", THE FontStyleButtons SHALL display the italic button in active/pressed state
3. WHEN the current font-style value is "normal" or empty, THE FontStyleButtons SHALL display the normal button in active/pressed state
4. WHEN the user clicks a font-style button, THE FontStyleButtons SHALL call prop.upValue() with the corresponding value (normal, italic)

### Requirement 6: Composite Spacing Fields

**User Story:** Sebagai pengguna print editor, saya ingin margin dan padding ditampilkan sebagai 4 inline fields (Top, Right, Bottom, Left), sehingga saya dapat mengatur spacing per sisi dengan mudah.

#### Acceptance Criteria

1. THE CompositeSpacingField SHALL render four UnitInputField components in a single horizontal row
2. THE CompositeSpacingField SHALL label each field with T (Top), R (Right), B (Bottom), L (Left)
3. WHEN a composite GrapeJS property (margin/padding) has sub-properties, THE CompositeSpacingField SHALL bind each UnitInputField to the corresponding sub-property
4. WHEN the user changes a value in any of the four fields, THE CompositeSpacingField SHALL update only the corresponding sub-property via prop.upValue()
5. THE CompositeSpacingField SHALL support the same unit options as UnitInputField (px, %, em, rem, vw, vh, auto)

### Requirement 7: Border Controls

**User Story:** Sebagai pengguna print editor, saya ingin border controls ditampilkan sebagai width + style dropdown + color dalam satu baris, sehingga saya dapat mengatur border secara komprehensif dan efisien.

#### Acceptance Criteria

1. THE BorderField SHALL render border-width input (with unit selector), border-style Select dropdown, and border-color picker in a single row
2. THE BorderField SHALL use the sub-properties from the composite border GrapeJS property
3. WHEN the user changes border-width, THE BorderField SHALL update the border-width sub-property
4. WHEN the user selects a border-style from the dropdown, THE BorderField SHALL update the border-style sub-property with the selected value (none, solid, dashed, dotted, double, groove, ridge, inset, outset)
5. WHEN the user changes border-color, THE BorderField SHALL update the border-color sub-property

### Requirement 8: Color Fields

**User Story:** Sebagai pengguna print editor, saya ingin color properties menampilkan color swatch + hex input secara konsisten, sehingga saya dapat memilih warna dengan visual preview.

#### Acceptance Criteria

1. THE ColorField SHALL render a clickable color swatch and a hex text input within an InputGroup
2. THE ColorField SHALL synchronize the color swatch background with the current property value
3. WHEN the user clicks the color swatch, THE ColorField SHALL open a native color picker
4. WHEN the user selects a color from the picker, THE ColorField SHALL update both the swatch and hex input, and call prop.upValue() with the new color value
5. WHEN the user types a valid hex color in the text input, THE ColorField SHALL update the swatch and call prop.upValue() with the typed value

### Requirement 9: Existing Functionality Preserved

**User Story:** Sebagai pengguna print editor, saya ingin layout controls (flex/grid), class manager, dan manual CSS editor tetap berfungsi setelah redesain, sehingga tidak ada fitur yang hilang.

#### Acceptance Criteria

1. WHILE a component with display:flex is selected, THE Style_Manager SHALL render FlexLayoutControls above the style sections
2. WHILE a component with display:grid is selected, THE Style_Manager SHALL render GridLayoutControls above the style sections
3. THE Style_Manager SHALL render the class manager section with add/remove class functionality
4. THE Style_Manager SHALL render the manual CSS editor section with edit button and CSS preview
5. WHEN the user applies manual CSS via the CSS editor modal, THE Style_Manager SHALL merge manual CSS with visual panel styles correctly

### Requirement 10: Field Component Resolution

**User Story:** Sebagai developer, saya ingin setiap property secara otomatis di-render dengan field component yang tepat berdasarkan property type dan ID, sehingga UI konsisten tanpa konfigurasi manual per-property.

#### Acceptance Criteria

1. WHEN a property has ID "text-align", THE Style_Manager SHALL render TextAlignButtons
2. WHEN a property has ID "text-decoration", THE Style_Manager SHALL render TextDecorationButtons
3. WHEN a property has ID "font-style", THE Style_Manager SHALL render FontStyleButtons
4. WHEN a property has type "composite" and is a spacing property (margin/padding), THE Style_Manager SHALL render CompositeSpacingField
5. WHEN a property has type "composite" and ID starts with "border", THE Style_Manager SHALL render BorderField
6. WHEN a property has type "color", THE Style_Manager SHALL render ColorField
7. WHEN a property is in the Dimension section or is font-size/letter-spacing/line-height, THE Style_Manager SHALL render UnitInputField
8. WHEN a property has type "select" or "radio", THE Style_Manager SHALL render a Select dropdown
9. WHEN a property does not match any specific rule, THE Style_Manager SHALL render a default text Input field

### Requirement 11: Value-Unit Parsing

**User Story:** Sebagai developer, saya ingin utility functions yang reliable untuk parsing dan combining CSS value+unit, sehingga semua field components dapat menggunakan logic yang sama.

#### Acceptance Criteria

1. WHEN parseValueAndUnit receives "auto", THE function SHALL return { numericValue: "", unit: "auto" }
2. WHEN parseValueAndUnit receives a value with recognized unit (e.g., "200px", "50%", "1.5em"), THE function SHALL split it into numeric and unit parts correctly
3. WHEN parseValueAndUnit receives a purely numeric value (e.g., "200"), THE function SHALL default the unit to "px"
4. WHEN parseValueAndUnit receives an empty or null value, THE function SHALL return { numericValue: "", unit: "px" }
5. WHEN combineValueUnit receives unit "auto", THE function SHALL return "auto" regardless of numericValue
6. WHEN combineValueUnit receives an empty numericValue (except "0"), THE function SHALL return empty string
7. WHEN combineValueUnit receives valid numericValue and unit, THE function SHALL return the concatenation (e.g., "200" + "px" = "200px")
