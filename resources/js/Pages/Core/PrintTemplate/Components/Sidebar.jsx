import {
  BlocksIcon,
  BracesIcon,
  Brush,
  ChevronRight,
  CogIcon,
  Layers3Icon,
} from "lucide-react";
import {
  BlocksProvider,
  LayersProvider,
  StylesProvider,
  TraitsProvider,
  useEditor,
} from "@grapesjs/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/Components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";

import CustomBlockManager from "./CustomBlockManager";
import CustomLayerManager from "./CustomLayerManager";
import CustomStyleManager from "./CustomStyleManager";
import React from "react";
import RelationsInspector from "./Inspector/RelationsInspector";
import TraitPropertyField from "./TraitPropertyField";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

function VariableItem({ path = "", ...variable }) {
  const { editor } = useEditor();
  const { t } = useLaravelReactI18n();
  const fullKey = path ? `${path}.${variable.name}` : variable.name;
  const isRelation =
    (variable.type === "relation" ||
      variable.type === "data" ||
      variable.type === "preferences") &&
    variable.columns?.length;

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
          fontFamily: "monospace",
        },
      });
    }
  };

  // Kalau bukan relasi, langsung render item biasa
  if (!isRelation) {
    return (
      <div
        className="flex flex-col px-2 py-1 border rounded-md hover:bg-muted cursor-pointer transition-colors mt-1"
        draggable
        onClick={() => {
          if (
            variable.type === "relations" ||
            variable.type === "data" ||
            variable.type === "preferences"
          )
            return;
          handleInsert();
        }}
        onDragStart={(e) => {
          if (variable.type === "data" || variable.type === "preferences") {
            return;
          }
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData(
            "variable/json",
            JSON.stringify({
              ...variable,
            }),
          );

          // const token = `{{${variable.parentType == "preferences" ? "companyDetail " : ""}${fullKey}}}`;
          // e.dataTransfer.setData("text/html", `<p>${token}</p>`);
        }}
      >
        <span className="text-sm font-medium">
          {variable.title ||
            (variable.titleTrans ? t(variable.titleTrans) : variable.name)}
        </span>
        {!(variable.type === "data" || variable.type === "preferences") && (
          <code className="text-xs text-muted-foreground">
            {`{{${variable.type === "relation" ? "relation " : ""}${variable.name}}}`}
          </code>
        )}
      </div>
    );
  }

  // Kalau relasi, pakai Collapsible
  return (
    <Collapsible className="mt-1">
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-1 w-full px-2 py-1 border rounded-md hover:bg-muted transition-colors [&[data-state=open]_svg]:rotate-90",
        )}
      >
        <ChevronRight className="h-4 w-4 transition-transform duration-200" />
        <div className="flex flex-col text-left">
          <span className="text-sm font-medium">
            {variable.title ||
              (variable.titleTrans ? t(variable.titleTrans) : variable.name)}
          </span>
          {!(variable.type === "data" || variable.type === "preferences") && (
            <code className="text-xs text-muted-foreground">
              {"{{" + variable.name + "}}"}
            </code>
          )}
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="pl-4 mt-1 border-l border-muted-foreground/25">
        {variable.columns.map((sub) => {
          sub.parentType =
            variable.type === "data" || variable.type === "preferences"
              ? variable.type
              : variable.parentType;
          return (
            <VariableItem
              key={sub.name}
              path={
                variable.type === "data" || variable.type === "preferences"
                  ? ""
                  : fullKey
              }
              {...sub}
            />
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
function Sidebar() {
  const { dataTableColumns } = usePage().props;
  return (
    <Tabs
      className={cn(
        "flex flex-col [&_svg]:size-4 order-1 max-w-full  border  lg:col-start-1 border-muted-foreground/25",
        "[&_:not(div[role=content])+div[role=content]]:border-t-0 [&_div[role=content]:first-child]:border-t-0! [&_div[role=content]]:border-t [&_div[role=content]]:border-muted-foreground/25",
      )}
    >
      <TabsList className="duration-300 ease-in-out sticky z-9 w-full py-2! h-auto rounded-b-none rounded-t-xl items-center justify-start overflow-x-auto divide-x dark:divide-muted bg-background dark:border-muted border-b">
        <TabsTrigger
          value="style"
          className="text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors"
        >
          <Brush />
        </TabsTrigger>
        {/* <TabsTrigger
          value="trait"
          className="text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors"
        >
          <CogIcon />
        </TabsTrigger> */}
        <TabsTrigger
          value="layer"
          className="text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors"
        >
          <Layers3Icon />
        </TabsTrigger>
        <TabsTrigger
          value="blocks"
          className="text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors"
        >
          <BlocksIcon />
        </TabsTrigger>
        <TabsTrigger
          value="variables"
          className="text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors"
        >
          <BracesIcon />
        </TabsTrigger>
        <TabsTrigger
          value="inspector"
          className="text-base border-0 data-[state=active]:font-bold p-0! px-4! group rounded-none transition-colors"
        >
          <CogIcon />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="style">
        {/* <SelectorsProvider>
          {(props) => <CustomSelectorManager {...props} />}
        </SelectorsProvider> */}
        <StylesProvider>
          {(props) => <CustomStyleManager {...props} />}
        </StylesProvider>
      </TabsContent>
      {/* <TabsContent value="trait">
        <TraitsProvider>
          {({ traits }) => (
            <div className="gjs-custom-style-manager text-left mt-3 p-1">
              {!traits.length ? (
                <div>No properties available</div>
              ) : (
                traits.map((trait) => (
                  <TraitPropertyField key={trait.getId()} trait={trait} />
                ))
              )}
            </div>
          )}
        </TraitsProvider>
      </TabsContent> */}
      <TabsContent value="layer">
        <LayersProvider>
          {(props) => <CustomLayerManager {...props} />}
        </LayersProvider>
      </TabsContent>
      <TabsContent value="blocks">
        <BlocksProvider>
          {(props) => <CustomBlockManager {...props} />}
        </BlocksProvider>
      </TabsContent>
      {/* 🧾 VARIABEL */}
      <TabsContent value="variables">
        <div className="p-3 text-left overflow-y-auto max-h-[80vh] space-y-2">
          <h3 className="font-semibold mb-2 text-base flex items-center gap-2">
            Variabel Dokumen
          </h3>

          {!dataTableColumns.length ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada variabel tersedia.
            </p>
          ) : (
            dataTableColumns.map((v) => <VariableItem key={v.name} {...v} />)
          )}
        </div>
      </TabsContent>
      <TabsContent value="inspector">
        <RelationsInspector />
      </TabsContent>
    </Tabs>
  );
}

export default Sidebar;
