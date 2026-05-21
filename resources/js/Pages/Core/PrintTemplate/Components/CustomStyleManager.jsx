import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/Components/ui/accordion";

import StylePropertyField from "./StylePropertyField";

export default function CustomStyleManager({ sectors }) {
  return (
    <div className="text-left">
      <Accordion type="single" collapsible className="w-full">
        {sectors.map((sector) => {
          return (
            <AccordionItem key={sector.getId()} value={sector.getId()}>
              <AccordionTrigger className="px-4 text-sm hover:bg-muted/50">
                {sector.getName()}
              </AccordionTrigger>
              <AccordionContent className={`grid grid-cols-2 gap-2 px-4`}>
                {sector.getProperties().map((prop) => {
                  return <StylePropertyField key={prop.getId()} prop={prop} />;
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
