import React from "react";
import { Alert, AlertContent, AlertTitle } from "@/Components/ui/alert";

export default function PriceControlWarnings({ title, warnings = [] }) {
  if (!warnings.length) {
    return null;
  }

  return (
    <Alert
      variant="warning"
      appearance="light"
      role="status"
      data-testid="price-control-warnings"
    >
      <AlertContent>
        <AlertTitle>{title}</AlertTitle>
        <ul>
          {warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      </AlertContent>
    </Alert>
  );
}
