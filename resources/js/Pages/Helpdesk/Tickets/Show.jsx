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
import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage, FormPageDialog } from "@/Pages/Core/FormPage";
import ResponseForm from "./ResponseForm";
import { sanitizeHTML } from "@/lib/htmlSanitizer";
import { router, usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useRef, useState } from "react";
import { convertTemplateLink } from "@/lib/linkModelUtils";

// ─── TicketResponseDiff ──────────────────────────────────────────
function TicketResponseDiff({ current, previous }) {
  const { t } = useLaravelReactI18n();

  const fields = [
    {
      key: "type",
      label: t("helpdesk.ticket.columns.type"),
      format: (v) => t(`helpdesk.ticket.type.options.${v}`),
    },
    {
      key: "priority",
      label: t("helpdesk.ticket.columns.priority"),
      format: (v) => t(`helpdesk.ticket.priority.options.${v}`),
    },
    {
      key: "status",
      label: t("helpdesk.ticket.columns.status"),
      format: (v) => t(`helpdesk.ticket.status.options.${v}`),
    },
    {
      key: "progress",
      label: t("helpdesk.ticket.columns.progress"),
      format: (v) => `${v}%`,
    },
    {
      key: "subject",
      label: t("helpdesk.ticket.columns.subject"),
      format: (v) => v,
    },
    {
      key: "assign_to_id",
      label: t("helpdesk.ticket.columns.assign_to"),
      format: (_v, res) => res?.assign_to?.name ?? "-",
    },
    {
      key: "start_date",
      label: t("helpdesk.ticket.columns.start_date"),
      format: (v) => (v ? new Date(v).toLocaleDateString() : "-"),
    },
    {
      key: "due_date",
      label: t("helpdesk.ticket.columns.due_date"),
      format: (v) => (v ? new Date(v).toLocaleDateString() : "-"),
    },
  ];

  if (!previous) {
    return (
      <div className="mt-2 space-y-0.5">
        {fields.map((f) => {
          const val = f.format(current[f.key], current);
          if (!val || val === "-") return null;
          return (
            <div key={f.key} className="text-muted-foreground flex gap-1 text-xs">
              <span className="w-24 shrink-0 font-medium">{f.label}</span>
              <span>:</span>
              <span>{val}</span>
            </div>
          );
        })}
      </div>
    );
  }

  const changes = fields.filter((f) => {
    if (f.key === "assign_to_id") return current.assign_to_id !== previous.assign_to_id;
    return current[f.key] !== previous[f.key];
  });

  if (!changes.length) return null;

  return (
    <div className="mt-2 space-y-0.5">
      {changes.map((f) => {
        const fromVal = f.format(previous[f.key], previous);
        const toVal = f.format(current[f.key], current);
        return (
          <div key={f.key} className="text-muted-foreground flex gap-1 text-xs">
            <span className="w-24 shrink-0 font-medium">{f.label}</span>
            <span>:</span>
            <span className="line-through opacity-60">{fromVal}</span>
            <span>→</span>
            <span className="font-medium">{toVal}</span>
          </div>
        );
      })}
    </div>
  );
}

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

  // responses diurutkan DESC (terbaru di index 0)
  // previous dari perspektif response[i] adalah response[i+1]
  return (
    <div className="space-y-4">
      {responses.map((res, i) => {
        const previous = responses[i + 1] ?? null;
        return (
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
            <TicketResponseDiff current={res} previous={previous} />
            {res.content && (
              <div
                className="prose prose-sm mt-2 max-w-none"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHTML(res.content).sanitizedHTML,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Show ───────────────────────────────────────────────────
export default function Show({ ticket, defaultData }) {
  const { t } = useLaravelReactI18n();
  const { auth } = usePage().props;
  const route = window.route;

  const updateDialogRef = useRef();
  const [markDoneOpen, setMarkDoneOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDone = ticket?.status === "done";

  const lastResponse = ticket?.responses?.[0];
  const lastResponseByMe =
    lastResponse?.user_id === auth?.user?.id ? lastResponse : null;

  const responseDefaultValues = ticket
    ? {
        ...ticket,
        content: lastResponseByMe?.content ?? null,
        content_json: lastResponseByMe?.content_json ?? null,
      }
    : {};

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

  return (
    <>
      <FormPage
        isCreate={!ticket}
        ignoreDraft={defaultData}
        name="ticket"
        title={ticket ? convertTemplateLink(ticket) : t("helpdesk.ticket.new")}
        disabled
        deleteable={false}
        defaultValues={defaultData}
        controls={() => {
          if (!ticket || isDone) return null;
          return (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateDialogRef.current?.open()}
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
      {ticket && (
        <FormPageDialog
          ref={updateDialogRef}
          name="ticket_response"
          ignoreDraft
          method="put"
          routeName="tickets.updateTicket"
          routeParams={ticket.id}
          title={t("helpdesk.ticket.update_dialog.title")}
          className="max-w-(--breakpoint-lg)"
          defaultValue={responseDefaultValues}
        >
          <ResponseForm />
        </FormPageDialog>
      )}
    </>
  );
}
