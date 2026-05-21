import {
  BlocksIcon,
  BracesIcon,
  Brush,
  CogIcon,
  Layers3Icon,
} from "lucide-react";
import {
  BlocksProvider,
  LayersProvider,
  StylesProvider,
} from "@grapesjs/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";

import CustomBlockManager from "./CustomBlockManager";
import CustomLayerManager from "./CustomLayerManager";
import CustomStyleManager from "./CustomStyleManager";
import React from "react";
import RelationsInspector from "./Inspector/RelationsInspector";
import StaticHTMLInspector from "./Inspector/StaticHTMLInspector";
import VariableManager from "./VariableManager";
import { cn } from "@/lib/utils";

const sidebarTabs = [
  {
    value: "style",
    label: "Style",
    icon: Brush,
  },
  {
    value: "layer",
    label: "Layer",
    icon: Layers3Icon,
  },
  {
    value: "blocks",
    label: "Blocks",
    icon: BlocksIcon,
  },
  {
    value: "variables",
    label: "Variabel",
    icon: BracesIcon,
  },
  {
    value: "inspector",
    label: "Inspector",
    icon: CogIcon,
  },
];

function Sidebar() {
  return (
    <Tabs
      defaultValue="variables"
      className={cn(
        "order-1 flex h-full max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs",
      )}
    >
      <TabsList className="sticky top-0 z-10 h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-card p-1 duration-300 ease-in-out">
        {sidebarTabs.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className={cn(
              "h-8 shrink-0 gap-1.5 rounded-md border border-transparent px-2 text-xs font-medium text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs",
            )}
          >
            <Icon />
            <span>{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="style" className="mt-0 h-full overflow-auto">
        <StylesProvider>
          {(props) => <CustomStyleManager {...props} />}
        </StylesProvider>
      </TabsContent>
      <TabsContent value="layer" className="mt-0 h-full overflow-hidden">
        <LayersProvider>
          {(props) => <CustomLayerManager {...props} />}
        </LayersProvider>
      </TabsContent>
      <TabsContent value="blocks" className="mt-0 h-full overflow-auto">
        <BlocksProvider>
          {(props) => <CustomBlockManager {...props} />}
        </BlocksProvider>
      </TabsContent>
      {/* 🧾 VARIABEL */}
      <TabsContent value="variables" className="mt-0 h-full overflow-auto">
        <VariableManager />
      </TabsContent>
      <TabsContent value="inspector" className="mt-0 h-full overflow-auto">
        <div className="space-y-3 p-3">
          <RelationsInspector />
          <StaticHTMLInspector />
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default Sidebar;
