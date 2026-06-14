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

export default function StylePropertyField({ prop, hideLabel = false }) {
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
        const selectedLayer =
          stackProp.getSelectedLayer?.() ||
          layers.find((layer) => layer.isSelected());
        const layerProperties = selectedLayer
          ? stackProp.getProperties(selectedLayer)
          : [];

        const handleLayerSelect = (layer) => {
          if (typeof stackProp.selectLayer === "function") {
            stackProp.selectLayer(layer);
            return;
          }

          layer.select();
        };

        const handleLayerMove = (layer, nextIndex) => {
          if (typeof stackProp.moveLayer === "function") {
            stackProp.moveLayer(layer, nextIndex);
            return;
          }

          layer.move(nextIndex);
        };

        const handleLayerRemove = (layer, layerIndex) => {
          if (typeof stackProp.removeLayer === "function") {
            stackProp.removeLayer(layer);
          } else {
            layer.remove();
          }

          const nextLayer =
            stackProp.getLayer?.(Math.max(0, layerIndex - 1)) ||
            stackProp.getLayer?.(0);

          if (nextLayer) {
            handleLayerSelect(nextLayer);
          }
        };

        const handleLayerAdd = () => {
          const createdLayer = stackProp.addLayer({}, { at: 0 });
          if (createdLayer) {
            handleLayerSelect(createdLayer);
          }
        };

        inputToRender = (
          <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  Layers
                </p>
                <p className="text-[10px] text-muted-foreground/80">
                  {layers.length} layer
                  {layers.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                onClick={handleLayerAdd}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            {layers.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 bg-background/60 p-2 text-[11px] text-muted-foreground">
                Belum ada layer. Klik Add untuk menambah layer baru.
              </div>
            ) : (
              <div className="space-y-2">
                {layers.map((layer, layerIndex) => {
                  const isSelected = layer.isSelected();
                  const isFirst = layerIndex === 0;
                  const isLast = layerIndex === layers.length - 1;

                  return (
                    <div
                      key={layer.getId()}
                      className={cn(
                        "rounded-md border",
                        isSelected
                          ? "border-primary/40 bg-background"
                          : "border-border/60 bg-card",
                      )}
                    >
                      <div className="flex items-center gap-1 p-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={isFirst}
                          onClick={() =>
                            !isFirst &&
                            handleLayerMove(layer, layer.getIndex() - 1)
                          }
                          aria-label="Move layer up"
                        >
                          <ChevronUpCircleIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={isLast}
                          onClick={() =>
                            !isLast &&
                            handleLayerMove(layer, layer.getIndex() + 1)
                          }
                          aria-label="Move layer down"
                        >
                          <ChevronDownCircleIcon className="h-4 w-4" />
                        </Button>

                        <button
                          type="button"
                          className={cn(
                            "min-w-0 flex-1 truncate rounded-sm px-1.5 py-1 text-left text-xs",
                            isSelected
                              ? "font-medium text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => handleLayerSelect(layer)}
                          title={layer.getLabel()}
                        >
                          {layer.getLabel() || `Layer ${layerIndex + 1}`}
                        </button>

                        <div
                          className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-sm border border-border bg-white text-[10px] text-black"
                          style={layer.getStylePreview({
                            number: { min: -3, max: 3 },
                            camelCase: true,
                          })}
                          title="Layer preview"
                        >
                          {isTextShadow && "T"}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleLayerRemove(layer, layerIndex)}
                          aria-label="Remove layer"
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedLayer && (
              <div className="rounded-md border border-border/70 bg-background p-2">
                <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                  Layer Properties
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {layerProperties.map((prop) => (
                    <StylePropertyField key={prop.getId()} prop={prop} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }
      break;
  }

  const fieldInput = hideLabel ? (
    <div className="space-y-1">{inputToRender}</div>
  ) : (
    <FormInput
      label={prop.getLabel()}
      className={cn(
        type == "composite" && "col-span-full grid grid-cols-subgrid",
      )}
    >
      {inputToRender}
    </FormInput>
  );

  return (
    <div
      className={cn(
        type == "composite" && "col-span-full grid grid-cols-subgrid ",
        (type == "stack" || type == "slider") && "col-span-full ",
      )}
    >
      {fieldInput}
    </div>
  );
}
