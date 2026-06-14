import BorderField from "./BorderField";
import ColorField from "./ColorField";
import CompositeSpacingField from "./CompositeSpacingField";
import DefaultInputField from "./DefaultInputField";
import FontStyleButtons from "./FontStyleButtons";
import LegacyStyleField from "./LegacyStyleField";
import SelectField from "./SelectField";
import TextAlignButtons from "./TextAlignButtons";
import TextDecorationButtons from "./TextDecorationButtons";
import UnitInputField from "./UnitInputField";
import { FIELD_COMPONENT_TYPES } from "../../utils/styleManagerUtils";

export const FIELD_COMPONENT_MAP = Object.freeze({
  [FIELD_COMPONENT_TYPES.TEXT_ALIGN_BUTTONS]: TextAlignButtons,
  [FIELD_COMPONENT_TYPES.TEXT_DECORATION_BUTTONS]: TextDecorationButtons,
  [FIELD_COMPONENT_TYPES.FONT_STYLE_BUTTONS]: FontStyleButtons,
  [FIELD_COMPONENT_TYPES.COMPOSITE_SPACING]: CompositeSpacingField,
  [FIELD_COMPONENT_TYPES.BORDER_FIELD]: BorderField,
  [FIELD_COMPONENT_TYPES.COLOR_FIELD]: ColorField,
  [FIELD_COMPONENT_TYPES.UNIT_INPUT]: UnitInputField,
  [FIELD_COMPONENT_TYPES.SELECT_FIELD]: SelectField,
  [FIELD_COMPONENT_TYPES.LEGACY_FIELD]: LegacyStyleField,
  [FIELD_COMPONENT_TYPES.DEFAULT_INPUT]: DefaultInputField,
});

export function getStyleFieldComponent(fieldType) {
  return FIELD_COMPONENT_MAP[fieldType] || DefaultInputField;
}

export {
  BorderField,
  ColorField,
  CompositeSpacingField,
  DefaultInputField,
  FontStyleButtons,
  LegacyStyleField,
  SelectField,
  TextAlignButtons,
  TextDecorationButtons,
  UnitInputField,
};
