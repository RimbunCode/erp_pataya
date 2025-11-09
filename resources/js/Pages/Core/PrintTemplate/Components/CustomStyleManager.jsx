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
    <div className=" text-left">
      <Accordion type="single" collapsible>
        {sectors.map((sector) => (
          <AccordionItem key={sector.getId()} value={sector.getId()}>
            <AccordionTrigger className=" px-4">
              {sector.getName()}
            </AccordionTrigger>
            <AccordionContent className={`grid grid-cols-2 gap-2 px-4`}>
              {sector.getProperties().map((prop) => {
                console.log(prop);
                return <StylePropertyField key={prop.getId()} prop={prop} />;
              })}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
