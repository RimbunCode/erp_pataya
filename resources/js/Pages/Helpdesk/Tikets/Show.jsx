import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/Components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import FormInput from "@/Components/FormInput";
import Select from "@/Components/Select";
import TiptapEditor from "@/Components/TiptapEditor";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import { Slider } from "@/Components/ui/slider";
import { router, usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useState } from "react";

const STATUS_OPTIONS = ["new", "in_progress", "on_hold", "resolved", "done"];

// ─── TicketResponseList ───────────────────────────────────────────
function TicketResponseList({ responses }) {
  const { t } = useLaravelReactI18n();

  if (!responses?.length) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("helpdesk.ticket.responses.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {responses.map((res) => (
        <div key={res.id} className="rounded-lg border p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{res.user?.name}</span>
              <span className="text-muted-foreground text-xs">
                {new Date(res.created_at).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-secondary rounded px-2 py-0.5 text-xs">
                {t(`helpdesk.ticket.status.options.${res.status}`)}
              </span>
              <span className="text-muted-foreground text-xs">
                {res.progress}%
              </span>
            </div>
          </div>
          {res.assign_to && (
            <p className="text-muted-foreground mb-2 text-xs">
              {t("helpdesk.ticket.columns.assign_to")}: {res.assign_to.name}
            </p>
          )}
          {res.content && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: res.content }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Show ───────────────────────────────────────────────────
export default function Show({ ticket, defaultData }) {
  const { t } = useLaravelReactI18n();
  const { auth } = usePage().props;
  const route = window.route;

  const [markDoneOpen, setMarkDoneOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [updateForm, setUpdateForm] = useState({
    assign_to: ticket?.assign_to ?? null,
    status: ticket?.status ?? "new",
    progress: ticket?.progress ?? 0,
    content: null,
    end_date: null,
  });

  const isCreator = ticket?.created_by_id === auth?.user?.id;
  const isDone = ticket?.status === "done";
  const imageUploadUrl = ticket ? route("tickets.addFile", ticket.id) : null;

  const handleMarkDone = () => {
    setLoading(true);
    router.put(
      route("tickets.markDone", ticket.id),
      {},
      {
        onFinish: () => {
          setLoading(false);
          setMarkDoneOpen(false);
        },
      },
    );
  };

  const handleUpdateTicket = () => {
    setLoading(true);
    router.put(
      route("tickets.updateTicket", ticket.id),
      {
        assign_to: updateForm.assign_to,
        status: updateForm.status,
        progress: updateForm.progress,
        content: updateForm.content,
        end_date: updateForm.end_date,
      },
      {
        onFinish: () => {
          setLoading(false);
          setUpdateOpen(false);
        },
      },
    );
  };

  return (
    <>
      <FormPage
        isCreate={!ticket}
        ignoreDraft={defaultData}
        name="ticket"
        title={ticket ? ticket.subject : t("helpdesk.ticket.new")}
        disabled={isDone}
        defaultValues={defaultData}
        controls={() => {
          if (!ticket || isDone) return null;
          return (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUpdateOpen(true)}
              >
                {t("helpdesk.ticket.actions.update_ticket")}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setMarkDoneOpen(true)}
              >
                {t("helpdesk.ticket.actions.mark_done")}
              </Button>
            </>
          );
        }}
      >
        <Form />

        {ticket && (
          <div className="px-4 pb-6 pt-2">
            <h3 className="mb-3 text-sm font-semibold">
              {t("helpdesk.ticket.responses.title")}
            </h3>
            <TicketResponseList responses={ticket.responses} />
          </div>
        )}
      </FormPage>

      {/* Dialog: Mark Done */}
      <AlertDialog open={markDoneOpen} onOpenChange={setMarkDoneOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("helpdesk.ticket.mark_done_dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("helpdesk.ticket.mark_done_dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              {t("core.form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkDone} disabled={loading}>
              {loading ? "..." : t("helpdesk.ticket.mark_done_dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Update Ticket */}
      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("helpdesk.ticket.update_dialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("helpdesk.ticket.update_dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormInput
              label={t("helpdesk.ticket.columns.assign_to")}
              name="assign_to"
              ignoreDisabled
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <UserLinkModel
                    value={updateForm.assign_to}
                    onValueChange={(v) =>
                      setUpdateForm((f) => ({
                        ...f,
                        assign_to: v,
                      }))
                    }
                  />
                </div>
                {!isCreator && ticket?.created_by && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setUpdateForm((f) => ({
                        ...f,
                        assign_to: ticket.created_by,
                      }))
                    }
                  >
                    {t("helpdesk.ticket.actions.assign_to_creator")}
                  </Button>
                )}
              </div>
            </FormInput>

            <FormInput
              label={t("helpdesk.ticket.columns.status")}
              name="status"
              ignoreDisabled
            >
              <Select
                value={updateForm.status}
                onValueChange={(v) =>
                  setUpdateForm((f) => ({
                    ...f,
                    status: v,
                  }))
                }
                options={STATUS_OPTIONS}
                optionTrans="helpdesk.ticket.status.options"
              />
            </FormInput>

            <FormInput
              label={`${t("helpdesk.ticket.columns.progress")} (${updateForm.progress}%)`}
              name="progress"
              ignoreDisabled
            >
              <Slider
                value={[updateForm.progress]}
                onValueChange={([v]) =>
                  setUpdateForm((f) => ({
                    ...f,
                    progress: v,
                  }))
                }
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
            </FormInput>

            <FormInput
              label={t("helpdesk.ticket.columns.end_date")}
              name="end_date"
              ignoreDisabled
            >
              <DatetimePicker
                type="datetime"
                value={updateForm.end_date}
                onValueChange={(v) =>
                  setUpdateForm((f) => ({
                    ...f,
                    end_date: v,
                  }))
                }
              />
            </FormInput>

            <FormInput
              label={t("helpdesk.ticket.columns.content")}
              name="content"
              ignoreDisabled
            >
              <TiptapEditor
                value={updateForm.content}
                onValueChange={(json, html) =>
                  setUpdateForm((f) => ({
                    ...f,
                    content: html,
                  }))
                }
                imageUploadUrl={imageUploadUrl}
                className="min-h-[150px]"
              />
            </FormInput>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setUpdateOpen(false)}
              disabled={loading}
            >
              {t("core.form.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleUpdateTicket}
              disabled={loading}
            >
              {loading ? "..." : t("helpdesk.ticket.update_dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
