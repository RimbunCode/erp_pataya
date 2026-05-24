import {
  BlocksIcon,
  BracesIcon,
  Brush,
  CogIcon,
  KeyRound,
  Layers3Icon,
} from "lucide-react";
import {
  BlocksProvider,
  LayersProvider,
  StylesProvider,
  useEditor,
} from "@grapesjs/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";

import CustomBlockManager from "./CustomBlockManager";
import CustomLayerManager from "./CustomLayerManager";
import CustomStyleManager from "./CustomStyleManager";
import React, { useEffect, useMemo, useState } from "react";
import StaticHTMLInspector from "./Inspector/StaticHTMLInspector";
import TokenConfigurationManager from "./TokenConfigurationManager";
import VariableManager from "./VariableManager";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

const sidebarTabDefs = [
  {
    value: "style",
    labelKey: "core.printTemplate.editor.tab_style",
    fallback: "Style",
    icon: Brush,
  },
  {
    value: "layer",
    labelKey: "core.printTemplate.editor.tab_layer",
    fallback: "Layer",
    icon: Layers3Icon,
  },
  {
    value: "blocks",
    labelKey: "core.printTemplate.editor.tab_blocks",
    fallback: "Blocks",
    icon: BlocksIcon,
  },
  {
    value: "variables",
    labelKey: "core.printTemplate.editor.tab_variables",
    fallback: "Variables",
    icon: BracesIcon,
  },
  {
    value: "token",
    labelKey: "core.printTemplate.editor.tab_token",
    fallback: "Token",
    icon: KeyRound,
  },
  {
    value: "inspector",
    labelKey: "core.printTemplate.editor.tab_inspector",
    fallback: "Inspector",
    icon: CogIcon,
  },
];

function Sidebar() {
  const editor = useEditor();
  const { t } = useLaravelReactI18n();
  const [activeTab, setActiveTab] = useState("variables");
  const [isStaticHtmlSelected, setIsStaticHtmlSelected] = useState(false);

  useEffect(() => {
    const updateSelectedComponentState = () => {
      const selectedType = editor.getSelected()?.getType?.();
      setIsStaticHtmlSelected(selectedType === "staticHTML");
    };

    editor.on("component:selected", updateSelectedComponentState);
    editor.on("component:deselected", updateSelectedComponentState);
    editor.on("component:update", updateSelectedComponentState);

    updateSelectedComponentState();

    return () => {
      editor.off("component:selected", updateSelectedComponentState);
      editor.off("component:deselected", updateSelectedComponentState);
      editor.off("component:update", updateSelectedComponentState);
    };
  }, [editor]);

  useEffect(() => {
    if (isStaticHtmlSelected && activeTab === "style") {
      setActiveTab("variables");
    }
  }, [activeTab, isStaticHtmlSelected]);

  const sidebarTabs = useMemo(
    () =>
      sidebarTabDefs.map((tab) => ({
        ...tab,
        label: t(tab.labelKey) || tab.fallback,
      })),
    [t],
  );

  const visibleTabs = useMemo(() => {
    if (isStaticHtmlSelected) {
      return sidebarTabs.filter((tab) => tab.value !== "style");
    }

    return sidebarTabs;
  }, [isStaticHtmlSelected, sidebarTabs]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className={cn(
        "order-1 flex h-full max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs",
      )}
    >
      <TabsList className="sticky top-0 z-10 h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-card p-1 duration-300 ease-in-out">
        {visibleTabs.map(({ value, label, icon: Icon }) => (
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
      {!isStaticHtmlSelected && (
        <TabsContent value="style" className="mt-0 h-full overflow-auto">
          <StylesProvider>
            {(props) => <CustomStyleManager {...props} />}
          </StylesProvider>
        </TabsContent>
      )}
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
      <TabsContent value="token" className="mt-0 h-full overflow-auto">
        <TokenConfigurationManager />
      </TabsContent>
      <TabsContent value="inspector" className="mt-0 h-full overflow-auto">
        <div className="space-y-3 p-3">
          <StaticHTMLInspector />
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default Sidebar;
