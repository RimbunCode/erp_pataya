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

// ─── TiketResponseList ───────────────────────────────────────────
function TiketResponseList({ responses }) {
    const { t } = useLaravelReactI18n();

    if (!responses?.length) {
        return (
            <p className="text-muted-foreground text-sm">
                {t("helpdesk.tiket.responses.empty")}
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {responses.map((res) => (
                <div key={res.id} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                                {res.user?.name}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {new Date(res.created_at).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="bg-secondary rounded px-2 py-0.5 text-xs">
                                {t(
                                    `helpdesk.tiket.status.options.${res.status}`,
                                )}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {res.progress}%
                            </span>
                        </div>
                    </div>
                    {res.assign_to && (
                        <p className="text-muted-foreground mb-2 text-xs">
                            {t("helpdesk.tiket.fields.assign_to")}:{" "}
                            {res.assign_to.name}
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
export default function Show({ tiket, defaultData }) {
    const { t } = useLaravelReactI18n();
    const { auth } = usePage().props;
    const route = window.route;

    const [markDoneOpen, setMarkDoneOpen] = useState(false);
    const [updateOpen, setUpdateOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [updateForm, setUpdateForm] = useState({
        assign_to: tiket?.assign_to ?? null,
        status: tiket?.status ?? "new",
        progress: tiket?.progress ?? 0,
        content: null,
        end_date: null,
    });

    const isCreator = tiket?.created_by_id === auth?.user?.id;
    const isDone = tiket?.status === "done";
    const imageUploadUrl = tiket
        ? route("tikets.addFile", tiket.id)
        : null;

    const handleMarkDone = () => {
        setLoading(true);
        router.put(
            route("tikets.markDone", tiket.id),
            {},
            {
                onFinish: () => {
                    setLoading(false);
                    setMarkDoneOpen(false);
                },
            },
        );
    };

    const handleUpdateTiket = () => {
        setLoading(true);
        router.put(
            route("tikets.updateTiket", tiket.id),
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
                isCreate={!tiket}
                ignoreDraft={defaultData}
                name="tiket"
                title={tiket ? tiket.subject : t("helpdesk.tiket.new")}
                disabled={isDone}
                defaultValues={defaultData}
                controls={() => {
                    if (!tiket || isDone) return null;
                    return (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setUpdateOpen(true)}
                            >
                                {t("helpdesk.tiket.actions.update_tiket")}
                            </Button>
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => setMarkDoneOpen(true)}
                            >
                                {t("helpdesk.tiket.actions.mark_done")}
                            </Button>
                        </>
                    );
                }}
            >
                <Form />

                {tiket && (
                    <div className="px-4 pb-6 pt-2">
                        <h3 className="mb-3 text-sm font-semibold">
                            {t("helpdesk.tiket.responses.title")}
                        </h3>
                        <TiketResponseList responses={tiket.responses} />
                    </div>
                )}
            </FormPage>

            {/* Dialog: Mark Done */}
            <AlertDialog open={markDoneOpen} onOpenChange={setMarkDoneOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("helpdesk.tiket.mark_done_dialog.title")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("helpdesk.tiket.mark_done_dialog.description")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>
                            {t("core.form.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleMarkDone}
                            disabled={loading}
                        >
                            {loading
                                ? "..."
                                : t(
                                      "helpdesk.tiket.mark_done_dialog.confirm",
                                  )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dialog: Update Tiket */}
            <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t("helpdesk.tiket.update_dialog.title")}
                        </DialogTitle>
                        <DialogDescription>
                            {t("helpdesk.tiket.update_dialog.description")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <FormInput
                            label={t("helpdesk.tiket.fields.assign_to")}
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
                                {!isCreator && tiket?.created_by && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setUpdateForm((f) => ({
                                                ...f,
                                                assign_to: tiket.created_by,
                                            }))
                                        }
                                    >
                                        {t(
                                            "helpdesk.tiket.actions.assign_to_creator",
                                        )}
                                    </Button>
                                )}
                            </div>
                        </FormInput>

                        <FormInput
                            label={t("helpdesk.tiket.fields.status")}
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
                                optionTrans="helpdesk.tiket.status.options"
                            />
                        </FormInput>

                        <FormInput
                            label={`${t("helpdesk.tiket.fields.progress")} (${updateForm.progress}%)`}
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
                            label={t("helpdesk.tiket.fields.end_date")}
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
                            label={t("helpdesk.tiket.fields.content")}
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
                            onClick={handleUpdateTiket}
                            disabled={loading}
                        >
                            {loading
                                ? "..."
                                : t("helpdesk.tiket.update_dialog.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
