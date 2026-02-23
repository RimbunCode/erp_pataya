import * as React from "react";

import {
  ChevronDownCircleIcon,
  ChevronUpCircleIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { Input, InputWrapper } from "@/Components/ui/input";
import { Slider, SliderThumb } from "@/Components/ui/slider";

import { Button } from "@/Components/ui/button";
import FormInput from "@/Components/FormInput";
import Select from "@/Components/Select";
import { cn } from "@/lib/utils";
import { useEditor } from "@grapesjs/react";

export default function StylePropertyField({ prop }) {
  const editor = useEditor();
  const handleChange = (value) => {
    prop.upValue(value);
  };

  const onChange = (ev) => {
    handleChange(ev);
  };

  const openAssets = () => {
    const { Assets } = editor;
    Assets.open({
      select: (asset, complete) => {
        console.log({ complete });
        prop.upValue(asset.getSrc(), { partial: !complete });
        complete && Assets.close();
      },
      types: ["image"],
      accept: "image/*",
    });
  };

  const type = prop.getType();
  const defValue = prop.getDefaultValue();
  // const canClear = prop.canClear();
  const hasValue = prop.hasValue();
  const value = prop.getValue();
  const valueString = hasValue ? value : "";
  const valueWithDef = hasValue ? value : defValue;

  let inputToRender = (
    <Input
      placeholder={defValue}
      value={valueString}
      onValueChange={onChange}
    />
  );

  switch (type) {
    case "radio":
    case "select":
      {
        const selectProp = prop;
        inputToRender = (
          <Select
            value={value}
            onValueChange={onChange}
            options={selectProp.getOptions().map((opt) => ({
              value: selectProp.getOptionId(opt),
              label: selectProp.getOptionLabel(opt),
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
    case "slider":
      {
        const sliderProp = prop;
        console.log({
          value: parseFloat(value),
          min: sliderProp.getMin(),
          max: sliderProp.getMax(),
          step: sliderProp.getStep(),
        });
        inputToRender = (
          <Slider
            size="small"
            className="col-span-full"
            value={[parseFloat(value)]}
            min={sliderProp.getMin()}
            max={sliderProp.getMax()}
            step={sliderProp.getStep()}
            onValueChange={(val) => onChange(val[0])}
          >
            <SliderThumb />
          </Slider>
        );
      }
      break;
    case "file":
      {
        inputToRender = (
          <div className="flex flex-col items-center gap-3">
            {value && value !== defValue && (
              <div
                className="w-[50px] h-[50px] rounded inline-block bg-cover bg-center cursor-pointer"
                style={{ backgroundImage: `url("${value}")` }}
                onClick={() => handleChange("")}
              />
            )}
            <button type="button" onClick={openAssets}>
              Select Image
            </button>
          </div>
        );
      }
      break;
    case "composite":
      {
        const compositeProp = prop;
        inputToRender = (
          <div className={cn("grid gap-2 grid-cols-subgrid col-span-full")}>
            {compositeProp.getProperties().map((prop) => (
              <StylePropertyField key={prop.getId()} prop={prop} />
            ))}
          </div>
        );
      }
      break;
    case "stack":
      {
        const stackProp = prop;
        const layers = stackProp.getLayers();
        const isTextShadow = stackProp.getName() === "text-shadow";
        inputToRender = (
          <div
            className={cn("flex flex-col p-2 gap-2 bg-black/20 min-h-[54px]")}
          >
            {layers.map((layer) => (
              <div key={layer.getId()}>
                <div className="flex gap-1 bg-slate-800 px-2 py-1 items-center">
                  <Button
                    variant="icon"
                    onClick={() => layer.move(layer.getIndex() - 1)}
                  >
                    <ChevronUpCircleIcon />
                  </Button>
                  <Button
                    size="small"
                    onClick={() => layer.move(layer.getIndex() + 1)}
                  >
                    <ChevronDownCircleIcon />
                  </Button>
                  <button className="flex-grow" onClick={() => layer.select()}>
                    {layer.getLabel()}
                  </button>
                  <div
                    className={cn(
                      "bg-white min-w-[17px] min-h-[17px] text-black text-sm flex justify-center",
                    )}
                    style={layer.getStylePreview({
                      number: { min: -3, max: 3 },
                      camelCase: true,
                    })}
                  >
                    {isTextShadow && "T"}
                  </div>
                  <Button variant="icon" onClick={() => layer.remove()}>
                    <Trash2Icon />
                  </Button>
                </div>
                {layer.isSelected() && (
                  <div className="p-2 flex flex-wrap">
                    {stackProp.getProperties().map((prop) => (
                      <StylePropertyField key={prop.getId()} prop={prop} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }
      break;
  }

  return (
    <div
      className={cn(
        type == "composite" && "col-span-full grid grid-cols-subgrid ",
        (type == "stack" || type == "slider") && "col-span-full ",
      )}
    >
      <FormInput
        label={prop.getLabel()}
        className={cn(
          type == "composite" && "col-span-full grid grid-cols-subgrid",
        )}
      >
        {inputToRender}
      </FormInput>

      {type === "stack" && (
        <Button
          variant="icon"
          className="!ml-2"
          onClick={() => prop.addLayer({}, { at: 0 })}
        >
          <PlusIcon />
        </Button>
      )}
    </div>
  );
}
