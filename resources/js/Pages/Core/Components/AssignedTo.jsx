import { Deferred, router, usePage } from "@inertiajs/react";
import { Plus, UserCheck, X } from "lucide-react";
import React, { useEffect, useState } from "react";

import AssignableLinkModel from "@/Pages/Users/ManageUsers/AssignableLinkModel";
import { Button } from "@/Components/ui/button";
import ClickAwayListener from "react-click-away-listener";
import LoadingIcon from "@/Components/LoadingIcon";
import { cn } from "@/lib/utils";
import { useFormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

function AssignedTo() {
  const { t } = useLaravelReactI18n();
  const [assignees, setAssignees] = useState([]);
  const { assignees: _assignees } = usePage().props;
  // SidebarChildren bisa dirender di luar FormPageContext (sidebar FormPage),
  // jadi context bisa undefined → fallback ke edit-mode (isCreate falsy).
  const { isCreate, data, setData } = useFormPage() ?? {};
  const bufferedAssignees = data?.buffered_assignees ?? [];
  const [showPicker, setShowPicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(null);

  const currentPath = window.location.pathname.replace(/\/$/, "");
  const currentQueryString = window.location.search;
  const basePath = `${currentPath}/assignee`;

  useEffect(() => {
    setAssignees(isCreate ? bufferedAssignees : (_assignees ?? []));
  }, [_assignees, isCreate, JSON.stringify(bufferedAssignees)]);

  const addAssignee = (assignable) => {
    if (!assignable) return;
    if (assignees.findIndex((a) => a.id === assignable.id) >= 0) {
      setShowPicker(false);
      setPickerValue(null);
      return;
    }
    if (isCreate) {
      const next = [...bufferedAssignees, assignable];
      setData("buffered_assignees", next);
      setAssignees(next);
      setShowPicker(false);
      setPickerValue(null);
      return;
    }
    setAssignees([...assignees, { ...assignable, isLoading: true }]);
    router.post(
      `${basePath}${currentQueryString}`,
      { allocated_to: assignable },
      {
        reset: ["assignees"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
      },
    );
    setShowPicker(false);
    setPickerValue(null);
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
        assignees.map(({ id, type, name, isLoading }) => (
          <li key={id}>
            <div
              className={cn(
                "w-full flex h-6 min-w-0 -translate-x-px items-center gap-2 rounded-md px-2 text-sidebar-foreground outline-none [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
                "text-base",
              )}
            >
              <div className="flex items-center flex-1 overflow-hidden gap-x-2">
                <p className="text-sm truncate">
                  {type} : {name}
                </p>
              </div>
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
            </div>
          </li>
        ))}
    </ul>
  );

  return (
    <ClickAwayListener onClickAway={() => setShowPicker(false)}>
      <div>
        <div className="flex w-full items-center gap-2 overflow-hidden rounded-md py-2 text-left outline-none [&>svg]:size-4 [&>svg]:shrink-0 h-8 text-base ">
          <UserCheck />
          <span className="flex-1">{t("core.form.assigned_to")}</span>
          <Button
            variant="ghost"
            className="rounded-full p-0! "
            size="icon"
            type="button"
            onClick={() => setShowPicker(!showPicker)}
          >
            {showPicker ? <X /> : <Plus />}
          </Button>
        </div>
        {showPicker && (
          <div className={cn("px-8 mb-2")}>
            <AssignableLinkModel
              value={pickerValue}
              onValueChange={(assignable) => {
                setPickerValue(assignable);
                addAssignee(assignable);
              }}
              placeholder={t("core.form.model.placeholder")}
            />
          </div>
        )}
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
    </ClickAwayListener>
  );
}

export default AssignedTo;
