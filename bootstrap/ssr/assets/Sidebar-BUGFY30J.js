import { jsxs, jsx } from "react/jsx-runtime";
import { Brush, Layers3Icon, BlocksIcon, BracesIcon, CogIcon, ChevronRight } from "lucide-react";
import { StylesProvider, LayersProvider, BlocksProvider, useEditor } from "@grapesjs/react";
import { C as Collapsible, a as CollapsibleTrigger, b as CollapsibleContent } from "./AppLayout-Drqdr6Z-.js";
import { T as Tabs, a as TabsList, b as TabsTrigger, c as TabsContent } from "./tabs-DhZjhdeH.js";
import CustomBlockManager from "./CustomBlockManager-3I5p96C9.js";
import CustomLayerManager from "./CustomLayerManager-Dizp7WF_.js";
import CustomStyleManager from "./CustomStyleManager-BKIr7GqM.js";
import "react";
import RelationsInspector from "./RelationsInspector-lmhuIleU.js";
import "./input-wk3Ou7wI.js";
import "./button-Us2TB7GG.js";
import "./Select-DB9toH_t.js";
import { c as cn } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "class-variance-authority";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "sonner";
import "zustand";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "radix-ui";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "@radix-ui/react-tabs";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "./LayerItem-D8wdUPwX.js";
import "./checkbox-C_BEU5E4.js";
import "@radix-ui/react-checkbox";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
import "react-detect-click-outside";
import "./InputError-2JjWc6nJ.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@date-fns/tz";
import "date-fns";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "./StylePropertyField-D6MlQOpI.js";
import "@radix-ui/react-radio-group";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
function VariableItem({ path = "", ...variable }) {
  var _a;
  const { editor } = useEditor();
  const { t } = useLaravelReactI18n();
  const fullKey = path ? `${path}.${variable.name}` : variable.name;
  const isRelation = (variable.type === "relation" || variable.type === "data" || variable.type === "preferences") && ((_a = variable.columns) == null ? void 0 : _a.length);
  const handleInsert = () => {
    if (!editor) return;
    const selected = editor.getSelected();
    const token = `{{${variable.parentType === "preferences" ? `companyDetail "${variable.name}"` : variable.name}}}`;
    if (selected && selected.is("text")) {
      const current = selected.get("content") || "";
      selected.set("content", current + token);
    } else {
      editor.addComponents({
        type: "text",
        content: token,
        style: {
          display: "inline-block",
          padding: "2px 4px",
          border: "1px dashed #999",
          backgroundColor: "#f9f9f9",
          borderRadius: "4px",
          fontFamily: "monospace"
        }
      });
    }
  };
  if (!isRelation) {
    return /* @__PURE__ */ jsxs(
      "div",
      {
        className: "flex flex-col px-2 py-1 border rounded-md hover:bg-muted cursor-pointer transition-colors mt-1",
        draggable: true,
        onClick: () => {
          if (variable.type === "relations" || variable.type === "data" || variable.type === "preferences")
            return;
          handleInsert();
        },
        onDragStart: (e) => {
          if (variable.type === "data" || variable.type === "preferences") {
            return;
          }
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData(
            "variable/json",
            JSON.stringify({
              ...variable
            })
          );
        },
        children: [
          /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: variable.title || (variable.titleTrans ? t(variable.titleTrans) : variable.name) }),
          !(variable.type === "data" || variable.type === "preferences") && /* @__PURE__ */ jsx("code", { className: "text-xs text-muted-foreground", children: `{{${variable.type === "relation" ? "relation " : ""}${variable.name}}}` })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs(Collapsible, { className: "mt-1", children: [
    /* @__PURE__ */ jsxs(
      CollapsibleTrigger,
      {
        className: cn(
          "flex items-center gap-1 w-full px-2 py-1 border rounded-md hover:bg-muted transition-colors [&[data-state=open]_svg]:rotate-90"
        ),
        children: [
          /* @__PURE__ */ jsx(ChevronRight, { className: "h-4 w-4 transition-transform duration-200" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col text-left", children: [
            /* @__PURE__ */ jsx("span", { className: "text-sm font-medium", children: variable.title || (variable.titleTrans ? t(variable.titleTrans) : variable.name) }),
            !(variable.type === "data" || variable.type === "preferences") && /* @__PURE__ */ jsx("code", { className: "text-xs text-muted-foreground", children: "{{" + variable.name + "}}" })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx(CollapsibleContent, { className: "pl-4 mt-1 border-l border-muted-foreground/25", children: variable.columns.map((sub) => {
      sub.parentType = variable.type === "data" || variable.type === "preferences" ? variable.type : variable.parentType;
      return /* @__PURE__ */ jsx(
        VariableItem,
        {
          path: variable.type === "data" || variable.type === "preferences" ? "" : fullKey,
          ...sub
        },
        sub.name
      );
    }) })
  ] });
}
function Sidebar() {
  const { dataTableColumns } = usePage().props;
  return /* @__PURE__ */ jsxs(
    Tabs,
    {
      className: cn(
        "flex flex-col [&_svg]:size-4 order-1 max-w-full  border  lg:col-start-1 border-muted-foreground/25",
        "[&_:not(div[role=content])+div[role=content]]:border-t-0 [&_div[role=content]:first-child]:border-t-0! [&_div[role=content]]:border-t [&_div[role=content]]:border-muted-foreground/25"
      ),
      children: [
        /* @__PURE__ */ jsxs(TabsList, { className: "duration-300 ease-in-out sticky z-9 w-full py-2! h-auto rounded-b-none rounded-t-xl items-center justify-start overflow-x-auto divide-x dark:divide-muted bg-background dark:border-muted border-b", children: [
          /* @__PURE__ */ jsx(
            TabsTrigger,
            {
              value: "style",
              className: "text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors",
              children: /* @__PURE__ */ jsx(Brush, {})
            }
          ),
          /* @__PURE__ */ jsx(
            TabsTrigger,
            {
              value: "layer",
              className: "text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors",
              children: /* @__PURE__ */ jsx(Layers3Icon, {})
            }
          ),
          /* @__PURE__ */ jsx(
            TabsTrigger,
            {
              value: "blocks",
              className: "text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors",
              children: /* @__PURE__ */ jsx(BlocksIcon, {})
            }
          ),
          /* @__PURE__ */ jsx(
            TabsTrigger,
            {
              value: "variables",
              className: "text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors",
              children: /* @__PURE__ */ jsx(BracesIcon, {})
            }
          ),
          /* @__PURE__ */ jsx(
            TabsTrigger,
            {
              value: "inspector",
              className: "text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors",
              children: /* @__PURE__ */ jsx(CogIcon, {})
            }
          )
        ] }),
        /* @__PURE__ */ jsx(TabsContent, { value: "style", children: /* @__PURE__ */ jsx(StylesProvider, { children: (props) => /* @__PURE__ */ jsx(CustomStyleManager, { ...props }) }) }),
        /* @__PURE__ */ jsx(TabsContent, { value: "layer", children: /* @__PURE__ */ jsx(LayersProvider, { children: (props) => /* @__PURE__ */ jsx(CustomLayerManager, { ...props }) }) }),
        /* @__PURE__ */ jsx(TabsContent, { value: "blocks", children: /* @__PURE__ */ jsx(BlocksProvider, { children: (props) => /* @__PURE__ */ jsx(CustomBlockManager, { ...props }) }) }),
        /* @__PURE__ */ jsx(TabsContent, { value: "variables", children: /* @__PURE__ */ jsxs("div", { className: "p-3 text-left overflow-y-auto max-h-[80vh] space-y-2", children: [
          /* @__PURE__ */ jsx("h3", { className: "font-semibold mb-2 text-base flex items-center gap-2", children: "Variabel Dokumen" }),
          !dataTableColumns.length ? /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Tidak ada variabel tersedia." }) : dataTableColumns.map((v) => /* @__PURE__ */ jsx(VariableItem, { ...v }, v.name))
        ] }) }),
        /* @__PURE__ */ jsx(TabsContent, { value: "inspector", children: /* @__PURE__ */ jsx(RelationsInspector, {}) })
      ]
    }
  );
}
export {
  Sidebar as default
};
