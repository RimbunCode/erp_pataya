import * as React from "react";

import { Input, InputWrapper } from "@/Components/ui/input";

import { Button } from "@/Components/ui/button";
import Checkbox from "@/Components/Checkbox";
import Select from "@/Components/Select";
import { cn } from "@/lib/utils";
import { useEditor } from "@grapesjs/react";

export default function TraitPropertyField({ trait, ...rest }) {
  const editor = useEditor();
  const handleChange = (value) => {
    trait.setValue(value);
  };

  const onChange = (ev) => {
    handleChange(ev.target.value);
  };

  const handleButtonClick = () => {
    const command = trait.get("command");
    if (command) {
      typeof command === "string"
        ? editor.runCommand(command)
        : command(editor, trait);
    }
  };

  const type = trait.getType();
  const defValue = trait.getDefault() || trait.attributes.placeholder;
  const value = trait.getValue();
  const valueWithDef = typeof value !== "undefined" ? value : defValue;

  let inputToRender = (
    <Input placeholder={defValue} value={value} onValueChange={onChange} />
  );

  switch (type) {
    case "select":
      {
        inputToRender = (
          <Select
            value={value}
            onValueChange={onChange}
            options={trait.getOptions().map((opt) => ({
              value: trait.getOptionId(opt),
              label: trait.getOptionLabel(opt),
            }))}
          />
        );
      }
      break;
    case "color":
      {
        inputToRender = (
          <InputWrapper>
            <div
              className={`w-[15px] h-[15px] `}
              style={{ backgroundColor: valueWithDef }}
            >
              <input
                type="color"
                className="w-[15px] h-[15px] cursor-pointer opacity-0"
                value={valueWithDef}
                onChange={(ev) => handleChange(ev.target.value)}
              />
            </div>
            <Input
              placeholder={defValue}
              value={value}
              onValueChange={onChange}
            />
          </InputWrapper>
        );
      }
      break;
    case "checkbox":
      {
        inputToRender = (
          <Checkbox
            checked={value}
            onChange={(ev) => trait.setValue(ev.target.checked)}
            size="small"
          />
        );
      }
      break;
    case "button":
      {
        inputToRender = (
          <Button onClick={handleButtonClick}>{trait.getLabel()}</Button>
        );
      }
      break;
  }

  return (
    <div {...rest} className={cn("mb-3 px-1 w-full")}>
      <div className={cn("flex mb-2 items-center")}>
        <div className="flex-grow capitalize">{trait.getLabel()}</div>
      </div>
      {inputToRender}
    </div>
  );
}
