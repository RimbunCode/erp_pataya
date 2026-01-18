import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useRef } from "react";
import LayerItem from "./LayerItem-D8wdUPwX.js";
import { c as cn } from "./utils-ClCZGsDL.js";
import { useEditor } from "@grapesjs/react";
import "lucide-react";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
const wrapGridStyle = {
  touchAction: "none"
};
const LAYER_PAD = 5;
const getDragTarget = (ev) => {
  const el = document.elementFromPoint(ev.clientX, ev.clientY);
  const elLayer = el == null ? void 0 : el.closest("[data-layer-item]");
  return {
    el: elLayer,
    cmp: elLayer == null ? void 0 : elLayer.__cmp
  };
};
function CustomLayerManager({ root }) {
  const editor = useEditor();
  const [pointerDown, setPointerDown] = useState(false);
  const [canMoveRes, setCanMoveRes] = useState({});
  const [cmpPointerOver, setCmpPointerOver] = useState();
  const [dragging, setDragging] = useState();
  const [dragParent, setDragParent] = useState();
  const [dragRect, setDragRect] = useState();
  const indicatorRef = useRef(null);
  const { Components } = editor;
  const onDragStart = () => {
    setPointerDown(true);
  };
  const onDragMove = (ev) => {
    if (!pointerDown) return;
    const { cmp, el: elLayer } = getDragTarget(ev);
    if (!elLayer || !cmp) return;
    const layerRect = elLayer.getBoundingClientRect();
    const layerH = elLayer.offsetHeight;
    const layerY = elLayer.offsetTop;
    const pointerY = ev.clientY;
    const isBefore = pointerY < layerRect.y + layerH / 2;
    const cmpSource = !dragging ? cmp : dragging;
    const cmpTarget = cmp.parent();
    const cmpIndex = cmp.index() + (isBefore ? 0 : 1);
    !dragging && setDragging(cmp);
    setCmpPointerOver(cmp);
    const canMove = Components.canMove(cmpTarget, cmpSource, cmpIndex);
    const canMoveInside = Components.canMove(cmp, cmpSource);
    const canMoveRes2 = {
      ...canMove,
      canMoveInside,
      index: cmpIndex
    };
    let pointerInside = false;
    if (canMoveInside.result && pointerY > layerRect.y + LAYER_PAD && pointerY < layerRect.y + layerH - LAYER_PAD) {
      pointerInside = true;
      canMoveRes2.target = cmp;
      delete canMoveRes2.index;
    }
    setDragParent(pointerInside ? cmp : void 0);
    setCanMoveRes(canMoveRes2);
    setDragRect({
      pointerInside,
      y: layerY + (isBefore ? 0 : layerH),
      h: layerH
    });
  };
  const onDragEnd = () => {
    var _a;
    (canMoveRes == null ? void 0 : canMoveRes.result) && ((_a = canMoveRes.source) == null ? void 0 : _a.move(canMoveRes.target, { at: canMoveRes.index }));
    setCanMoveRes({});
    setPointerDown(false);
    setDragging(void 0);
    setCmpPointerOver(void 0);
    setDragParent(void 0);
    setDragRect(void 0);
  };
  const dragLevel = (cmpPointerOver ? cmpPointerOver.parents() : []).length;
  const showIndicator = !!(dragging && dragRect && (canMoveRes == null ? void 0 : canMoveRes.result) && !dragRect.pointerInside);
  const indicatorStyle = showIndicator ? { top: dragRect.y, left: 0, marginLeft: dragLevel * 10 + 20 } : {};
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "gjs-custom-layer-manager h-full overflow-y-auto overflow-x-hidden text-sm text-left select-none relative",
      style: wrapGridStyle,
      onPointerDown: onDragStart,
      onPointerMove: onDragMove,
      onPointerUp: onDragEnd,
      children: [
        !!root && /* @__PURE__ */ jsx(
          LayerItem,
          {
            component: root,
            level: -1,
            draggingCmp: dragging,
            dragParent
          }
        ),
        showIndicator && /* @__PURE__ */ jsx(
          "div",
          {
            ref: indicatorRef,
            className: cn("absolute w-full h-0.5 bg-yellow-400"),
            style: indicatorStyle
          }
        )
      ]
    }
  );
}
export {
  CustomLayerManager as default
};
