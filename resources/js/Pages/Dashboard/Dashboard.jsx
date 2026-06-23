import { ChevronDownIcon, GripVerticalIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/Components/ui/collapsible";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AppLayout from "@/Layouts/AppLayout";
import { Button } from "@/Components/ui/button";
import { CSS } from "@dnd-kit/utilities";
import DashboardChart from "@/Components/DashboardChart";
import DashboardForm from "./DashboardForm";
import { FormPageDialog } from "../Core/FormPage";
import { Head } from "@inertiajs/react";
import axios from "axios";
import { cn } from "@/lib/utils";
import { gooeyToast } from "@/lib/gooeyToast";
import { useLaravelReactI18n } from "laravel-react-i18n";

function SortableWidgetCard({ itemId, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-lg border border-muted-foreground/20 bg-background/40 p-2",
        isDragging && "opacity-80 ring-1 ring-primary/30",
      )}
    >
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          className="inline-flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag widget"
        >
          <GripVerticalIcon className="size-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

function SortableDashboardSection({ defaultOpen, dashboard, onWidgetReorder }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dashboard.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const widgetSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const widgetIds = useMemo(
    () => (dashboard.widgets ?? []).map((widget) => widget.id),
    [dashboard.widgets],
  );

  const handleWidgetDragEnd = useCallback(
    (event) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const widgets = dashboard.widgets ?? [];
      const oldIndex = widgets.findIndex((widget) => widget.id === active.id);
      const newIndex = widgets.findIndex((widget) => widget.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const previousWidgets = [...widgets];
      const reorderedWidgets = arrayMove(widgets, oldIndex, newIndex);
      onWidgetReorder(dashboard.id, reorderedWidgets, previousWidgets);
    },
    [dashboard.id, dashboard.widgets, onWidgetReorder],
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("rounded-md", isDragging && "opacity-80")}
    >
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="[&[data-state=open]_.dashboard-chevron]:rotate-180 group flex w-full items-center gap-x-2 border-b border-muted-foreground/30 py-2 text-left text-2xl font-bold">
          <button
            type="button"
            className="inline-flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            {...attributes}
            {...listeners}
            aria-label="Drag dashboard"
          >
            <GripVerticalIcon className="size-5" />
          </button>
          <ChevronDownIcon className="dashboard-chevron size-6 shrink-0 transition-transform duration-200" />
          <span>{dashboard.title}</span>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <div className="border-b border-muted-foreground/30 py-4">
            <DndContext
              sensors={widgetSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleWidgetDragEnd}
            >
              <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                  {(dashboard.widgets ?? []).map((widget) => (
                    <SortableWidgetCard key={widget.id} itemId={widget.id}>
                      <DashboardChart widget={widget.widget} />
                    </SortableWidgetCard>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function Dashboard({ dashboards }) {
  const dialogRef = useRef();
  const { t } = useLaravelReactI18n();
  const [dashboardItems, setDashboardItems] = useState(dashboards ?? []);

  useEffect(() => {
    setDashboardItems(dashboards ?? []);
  }, [dashboards]);

  const dashboardSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const dashboardIds = useMemo(
    () => dashboardItems.map((dashboard) => dashboard.id),
    [dashboardItems],
  );

  const dataDashboard = useMemo(() => {
    return { dashboards: dashboardItems.map((dashboard) => ({ dashboard })) };
  }, [dashboardItems]);

  const persistDashboardOrder = useCallback(async (orderedDashboards) => {
    await axios.post(route("dashboardForms.store"), {
      dashboards: orderedDashboards.map((dashboard) => ({
        dashboard: {
          id: dashboard.id,
        },
      })),
    });
  }, []);

  const persistWidgetOrder = useCallback(
    async (dashboardId, orderedWidgets) => {
      await axios.post(route("dashboard.widgets.reorder", dashboardId), {
        widgets: orderedWidgets.map((widget) => ({
          id: widget.id,
        })),
      });
    },
    [],
  );

  const handleDashboardDragEnd = useCallback(
    (event) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = dashboardItems.findIndex(
        (dashboard) => dashboard.id === active.id,
      );
      const newIndex = dashboardItems.findIndex(
        (dashboard) => dashboard.id === over.id,
      );

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const previousDashboards = [...dashboardItems];
      const reorderedDashboards = arrayMove(dashboardItems, oldIndex, newIndex);

      setDashboardItems(reorderedDashboards);

      void persistDashboardOrder(reorderedDashboards).catch(() => {
        setDashboardItems(previousDashboards);
        gooeyToast.error(t("core.errors.fetch_failed"));
      });
    },
    [dashboardItems, persistDashboardOrder],
  );

  const handleWidgetReorder = useCallback(
    (dashboardId, widgets, previousWidgets) => {
      setDashboardItems((previousDashboards) =>
        previousDashboards.map((dashboard) =>
          dashboard.id === dashboardId
            ? {
                ...dashboard,
                widgets,
              }
            : dashboard,
        ),
      );

      void persistWidgetOrder(dashboardId, widgets).catch(() => {
        setDashboardItems((previousDashboards) =>
          previousDashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  widgets: previousWidgets,
                }
              : dashboard,
          ),
        );
        gooeyToast.error(t("core.errors.fetch_failed"));
      });
    },
    [persistWidgetOrder],
  );

  return (
    <AppLayout
      actions={
        <Button
          type="button"
          variant="primary"
          className="border"
          onClick={() => {
            dialogRef.current?.open();
          }}
        >
          Add Dashboard
        </Button>
      }
    >
      <Head title="Dashboard" />

      <DndContext
        sensors={dashboardSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDashboardDragEnd}
      >
        <SortableContext
          items={dashboardIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {dashboardItems.map((dashboard, idx) => (
              <SortableDashboardSection
                key={dashboard.id}
                defaultOpen={idx === 0}
                dashboard={dashboard}
                onWidgetReorder={handleWidgetReorder}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <FormPageDialog
        ref={dialogRef}
        title={t("settings.dashboard.titleForm")}
        className=""
        name="dashboardForm"
        defaultValue={dataDashboard}
      >
        <DashboardForm />
      </FormPageDialog>
    </AppLayout>
  );
}
