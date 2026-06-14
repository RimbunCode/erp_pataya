import React from "react";
import StylePropertyField from "../StylePropertyField";

function LegacyStyleField({ prop }) {
  return <StylePropertyField prop={prop} hideLabel />;
}

export default LegacyStyleField;
