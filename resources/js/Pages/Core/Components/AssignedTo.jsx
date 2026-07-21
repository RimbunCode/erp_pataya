import { Deferred, router, usePage } from "@inertiajs/react";
import { Dialog } from "@/Components/ui/dialog";
import { Plus, UserCheck, X } from "lucide-react";
import React, { useEffect, useState } from "react";

import AssignDialog from "./AssignDialog";
import BadgeStatus from "@/Components/BadgeStatus";
import { Button } from "@/Components/ui/button";
import LoadingIcon from "@/Components/LoadingIcon";
import { cn, generateRandom } from "@/lib/utils";
import { useFormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

function AssignedTo() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const [assignees, setAssignees] = useState([]);
  const { assignees: _assignees } = usePage().props;
  // SidebarChildren bisa dirender di luar FormPageContext (sidebar FormPage),
  // jadi context bisa undefined → fallback ke edit-mode (isCreate falsy).
  const { isCreate, data, setData } = useFormPage() ?? {};
  const bufferedAssignees = data?.buffered_assignees ?? [];
  // null = dialog tertutup, {} = mode tambah baru, {...item} = edit buffer item.
  const [dialogState, setDialogState] = useState(null);

  const currentPath = window.location.pathname.replace(/\/$/, "");
  const currentQueryString = window.location.search;
  const basePath = `${currentPath}/assignee`;

  useEffect(() => {
    setAssignees(isCreate ? bufferedAssignees : (_assignees ?? []));
  }, [_assignees, isCreate, JSON.stringify(bufferedAssignees)]);

  const activeAssigneeIds = assignees.map((a) => a.allocated_to_id);

  const handleRowClick = (item) => {
    if (isCreate) {
      setDialogState(item);
      return;
    }
    router.visit(route("todos.show", item.id));
  };

  const handleDialogSubmit = (value) => {
    if (isCreate) {
      const isEdit = !!dialogState?.id;
      const item = {
        ...value,
        allocated_to_id: value.allocated_to.id,
        name: value.allocated_to.name,
        type: value.allocated_to.type,
        id: isEdit ? dialogState.id : generateRandom(8),
      };
      const next = isEdit
        ? bufferedAssignees.map((a) => (a.id === dialogState.id ? item : a))
        : [...bufferedAssignees, item];
      setData("buffered_assignees", next);
      setAssignees(next);
    } else {
      setAssignees([
        ...assignees,
        {
          allocated_to_id: value.allocated_to.id,
          name: value.allocated_to.name,
          type: value.allocated_to.type,
          status: "open",
          isLoading: true,
        },
      ]);
      router.post(`${basePath}${currentQueryString}`, value, {
        reset: ["assignees"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
      });
    }
    setDialogState(null);
  };

  const removeAssignee = (id) => {
    if (isCreate) {
      const next = bufferedAssignees.filter((a) => a.id !== id);
      setData("buffered_assignees", next);
      setAssignees(next);
      return;
    }
    router.delete(`${basePath}/${id}${currentQueryString}`, {
      reset: ["assignees"],
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  };

  const assigneeList = (
    <ul
      className={cn(
        "ml-3.5 w-[calc(100%-calc(var(--spacing,0.25rem)*3.5))] flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border pl-2.5 py-0.5 pr-3.5",
      )}
    >
      {assignees &&
        assignees.map((item) => {
          const { id, type, name, status, isLoading } = item;
          const canRemove = status !== "closed" && status !== "canceled";

          return (
            <li key={id}>
              <div
                className={cn(
                  "w-full flex h-6 min-w-0 -translate-x-px items-center gap-2 rounded-md px-2 text-sidebar-foreground outline-none [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
                  "text-base",
                )}
              >
                <button
                  type="button"
                  className="flex items-center flex-1 overflow-hidden gap-x-2 text-left"
                  onClick={() => handleRowClick(item)}
                >
                  <p className="text-sm truncate flex-1">
                    {type} : {name}
                  </p>
                  <BadgeStatus status={status ?? "open"} className="text-xs" />
                </button>
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full p-0! m-0! w-auto h-auto group-data-[disabled=true]/form:hidden"
                    onClick={() => {
                      if (!isLoading) removeAssignee(id);
                    }}
                  >
                    {isLoading ? (
                      <LoadingIcon className="size-4" />
                    ) : (
                      <X className="size-4!" />
                    )}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
    </ul>
  );

  return (
    <div>
      <div className="flex w-full items-center gap-2 overflow-hidden rounded-md py-2 text-left outline-none [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-base ">
        <UserCheck />
        <span className="flex-1">{t("core.form.assigned_to")}</span>
        <Button
          variant="ghost"
          className="rounded-full p-0! "
          size="icon"
          type="button"
          onClick={() => setDialogState({})}
        >
          <Plus />
        </Button>
      </div>
      <Dialog
        open={!!dialogState}
        onOpenChange={(v) => !v && setDialogState(null)}
      >
        {dialogState && (
          <AssignDialog
            initialValue={dialogState.id ? dialogState : null}
            activeAssigneeIds={activeAssigneeIds}
            onClose={() => setDialogState(null)}
            onSubmit={handleDialogSubmit}
          />
        )}
      </Dialog>
      {/* Create: assignee dari buffer lokal — tanpa Deferred (cegah loading abadi). */}
      {isCreate ? (
        assigneeList
      ) : (
        <Deferred
          data={["assignees"]}
          fallback={
            <div className="mb-3 first:mt-2 ms-6">
              <div className="text-base! font-normal text-foreground flex gap-x-4">
                <LoadingIcon className="size-4" />
                <span>{t("core.form.loading")} ...</span>
              </div>
            </div>
          }
        >
          {assigneeList}
        </Deferred>
      )}
    </div>
  );
}

export default AssignedTo;
