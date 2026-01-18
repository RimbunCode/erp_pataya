import { jsx, jsxs } from "react/jsx-runtime";
import { useRef, useState, useEffect, useMemo } from "react";
import { ChevronDownIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { c as cn } from "./utils-ClCZGsDL.js";
import { useEditor } from "@grapesjs/react";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
const itemStyle = { maxWidth: `100%` };
function LayerItem({
  component,
  draggingCmp,
  dragParent,
  ...props
}) {
  const editor = useEditor();
  const { Layers } = editor;
  const layerRef = useRef(null);
  const [layerData, setLayerData] = useState(Layers.getLayerData(component));
  const { open, selected, hovered, components, visible, name } = layerData;
  const componentsIds = components.map((cmp) => cmp.getId());
  const isDragging = draggingCmp === component;
  const cmpHash = componentsIds.join("-");
  const level = props.level + 1;
  const isHovered = hovered || dragParent === component;
  useEffect(() => {
    level === 0 && setLayerData(Layers.getLayerData(component));
    if (layerRef.current) {
      layerRef.current.__cmp = component;
    }
  }, [component]);
  useEffect(() => {
    const up = (cmp) => {
      cmp === component && setLayerData(Layers.getLayerData(cmp));
    };
    const ev = Layers.events.component;
    editor.on(ev, up);
    return () => {
      editor.off(ev, up);
    };
  }, [editor, Layers, component]);
  const cmpToRender = useMemo(() => {
    return components.map((cmp) => /* @__PURE__ */ jsx(
      LayerItem,
      {
        component: cmp,
        level,
        draggingCmp,
        dragParent
      },
      cmp.getId()
    ));
  }, [cmpHash, draggingCmp, dragParent]);
  const toggleOpen = (ev) => {
    ev.stopPropagation();
    Layers.setLayerData(component, { open: !open });
  };
  const toggleVisibility = (ev) => {
    ev.stopPropagation();
    Layers.setLayerData(component, { visible: !visible });
  };
  const select = (event) => {
    event.stopPropagation();
    Layers.setLayerData(component, { selected: true }, { event });
  };
  const hover = (hovered2) => {
    if (!hovered2 || !draggingCmp) {
      Layers.setLayerData(component, { hovered: hovered2 });
    }
  };
  const wrapperCls = cn(
    "layer-item flex flex-col",
    selected && "bg-sky-900",
    (!visible || isDragging) && "opacity-50"
  );
  return /* @__PURE__ */ jsxs("div", { className: wrapperCls, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        onClick: select,
        onMouseEnter: () => hover(true),
        onMouseLeave: () => hover(false),
        className: "group max-w-full",
        "data-layer-item": true,
        ref: layerRef,
        children: /* @__PURE__ */ jsxs(
          "div",
          {
            className: cn(
              "flex items-center p-1 pr-2 border-b gap-1",
              level === 0 && "border-t",
              isHovered && "bg-sky-700",
              selected && "bg-sky-500"
            ),
            children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  style: { marginLeft: `${level * 10}px` },
                  className: cn(
                    "cursor-pointer",
                    !components.length && "pointer-events-none opacity-0"
                  ),
                  onClick: toggleOpen,
                  children: /* @__PURE__ */ jsx(ChevronDownIcon, {})
                }
              ),
              /* @__PURE__ */ jsx("div", { className: "truncate flex-grow", style: itemStyle, children: name }),
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: cn(
                    "group-hover:opacity-100 cursor-pointer",
                    visible ? "opacity-0" : "opacity-100"
                  ),
                  onClick: toggleVisibility,
                  children: visible ? /* @__PURE__ */ jsx(EyeIcon, {}) : /* @__PURE__ */ jsx(EyeOffIcon, {})
                }
              )
            ]
          }
        )
      }
    ),
    !!(open && components.length) && /* @__PURE__ */ jsx("div", { className: cn("max-w-full", !open && "hidden"), children: cmpToRender })
  ] });
}
export {
  LayerItem as default
};
