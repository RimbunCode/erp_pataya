import { useEffect, useMemo, useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";
import UploadDialog from "../Core/Components/UploadDialog";
import UploadDialog2 from "../Core/Components/UploadDialog2";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@/Components/ui/button";
import Link from "@/Components/Link";

const REQUEST_STATUS_CFG = {
  pending: {
    label: "Pending Review",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  approved: {
    label: "Approved",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    pill: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ProfileSettings({ user, profile, latestInstructorRequest }) {
  const { errors } = usePage().props;
  const [preview, setPreview] = useState(null);
  const uploadDialogRef = useRef();
  const instructorRequestUploadDialogRef = useRef();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    institution: profile?.institution ?? "",
    student_id_number: profile?.student_id_number ?? "",
    email: user?.email ?? "",
    socials: profile?.socials ?? [],
    bio: profile?.bio ?? "",
  });

  const addSocial = () => {
    setForm((prev) => ({
      ...prev,
      socials: [...prev.socials, { platform: "", url: "" }],
    }));
  };

  const removeSocial = (index) => {
    setForm((prev) => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index),
    }));
  };

  const updateSocial = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      socials: prev.socials.map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      ),
    }));
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDiscard = () => {
    setForm({
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
      institution: profile?.institution ?? "",
      student_id_number: profile?.student_id_number ?? "",
      socials: profile?.socials ?? [],
      bio: profile?.bio ?? "",
    });
  };
  const handleSubmit = () => {
    router.put(route("student.profile.update"), form);
  };

  const roleNames = (user?.roles ?? [])
    .map((roleItem) =>
      typeof roleItem === "string" ? roleItem : roleItem?.name,
    )
    .filter(Boolean)
    .map((roleName) => roleName.toLowerCase());

  const hasInstructorRole = roleNames.includes("instructor");
  const currentRequestStatus = latestInstructorRequest?.status ?? null;
  const requestStatusConfig =
    REQUEST_STATUS_CFG[currentRequestStatus] ?? REQUEST_STATUS_CFG.pending;

  const isRequestLocked =
    hasInstructorRole ||
    currentRequestStatus === "pending" ||
    currentRequestStatus === "approved";

  const alias = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");

  const avatar = useMemo(() => {
    if (!user.image) return null;
    return (
      <AvatarImage
        src={
          route("files.preview", user.image) +
          `?v=${new Date(user.updated_at).getTime()}`
        }
        alt={user.name}
        className={cn("transition-[filter] group-hover:blur-sm")}
      />
    );
  }, [user.image]);

  return (
    <MainLayout title="Profile Settings" breadcrumb="Profile">
      <div className="p-8 flex flex-col gap-8">
        {/* ── Avatar + Name ── */}
        <div className="flex items-center gap-6">
          <Avatar className="relative w-full h-auto border rounded-xl aspect-square max-w-32 group">
            {avatar}
            <AvatarFallback className="rounded-lg">
              <p className="w-full font-semibold text-center text-muted-foreground text-6xl transition-[filter]">
                {alias}
              </p>
            </AvatarFallback>
            <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    onClick={() => uploadDialogRef.current?.open()}
                  >
                    <UploadIcon className="size-5!" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent align="center">Upload</TooltipContent>
              </Tooltip>
              {user.image && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="destructive" size="icon" asChild>
                      <Link
                        href={route("student.image.delete")}
                        method="delete"
                      >
                        <Trash2Icon className="size-5!" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent align="center">Remove</TooltipContent>
                </Tooltip>
              )}
            </div>
          </Avatar>
          <div>
            <h2 className="text-2xl pl-4 font-black text-foreground uppercase tracking-tight">
              {user?.name}
            </h2>
            <p className="text-sm pl-4 font-extrabold tracking-widest text-primary uppercase mt-1">
              Student Account
            </p>
          </div>
        </div>

        {/* ── Form Card ── */}
        <div className="bg-card rounded-3xl border border-border shadow-sm p-8 flex flex-col gap-6">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-gray-300 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-md transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-gray-300 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-md transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                Institution / University
              </label>
              <input
                type="text"
                name="institution"
                value={form.institution}
                onChange={handleChange}
                placeholder="XYZ University"
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-gray-300 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-md transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                Student Id Number
              </label>
              <input
                type="text"
                name="student_id_number"
                value={form.student_id_number}
                onChange={handleChange}
                placeholder="123456789xx"
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-gray-300 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-md transition-all"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase">
                  Social Media
                </label>
                <button
                  type="button"
                  onClick={addSocial}
                  className="flex items-center gap-1 text-xs font-extrabold tracking-widest text-primary hover:text-primary uppercase transition-colors"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add
                </button>
              </div>

              {form.socials.length === 0 ? (
                <div
                  onClick={addSocial}
                  className="flex items-center gap-3 px-4 py-3 bg-muted border border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary-soft transition-all duration-200"
                >
                  <svg
                    className="w-4 h-4 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <span className="text-sm text-muted-foreground font-semibold">
                    Add your social media links
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {form.socials.map((social, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {/* Platform selector */}
                      <select
                        value={social.platform}
                        onChange={(e) =>
                          updateSocial(index, "platform", e.target.value)
                        }
                        className="w-36 flex-shrink-0 bg-muted border border-border rounded-xl px-3 py-3 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-sm transition-all"
                      >
                        <option value="">Platform</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="instagram">Instagram</option>
                        <option value="twitter">Twitter / X</option>
                        <option value="github">GitHub</option>
                        <option value="youtube">YouTube</option>
                        <option value="website">Website</option>
                        <option value="other">Other</option>
                      </select>

                      {/* URL input */}
                      <input
                        type="url"
                        value={social.url}
                        onChange={(e) =>
                          updateSocial(index, "url", e.target.value)
                        }
                        placeholder="https://..."
                        className="flex-1 bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-gray-300 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-sm transition-all"
                      />

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeSocial(index)}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-all duration-200"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+62 812 XXXX XXXX"
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-gray-300 dark:placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-md transition-all"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Student Bio
            </label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={5}
              placeholder="Tell us about your engineering background..."
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-gray-300 dark:placeholder-gray-300 shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border transition-all resize-none"
            />
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[2px] text-muted-foreground uppercase">
                  Instructor Role Request
                </p>
                <h3 className="mt-1 text-base font-extrabold text-foreground uppercase tracking-wide">
                  Become an Instructor
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload one supporting document and explain why you should get
                  instructor access.
                </p>
              </div>
              {latestInstructorRequest && (
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${requestStatusConfig.pill}`}
                >
                  {requestStatusConfig.label}
                </span>
              )}
            </div>

            {latestInstructorRequest && (
              <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    Latest Reason
                  </p>
                  <p className="mt-1 text-sm text-foreground leading-relaxed">
                    {latestInstructorRequest.reason}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                      Submitted At
                    </p>
                    <p className="mt-1 text-xs text-foreground">
                      {formatDateTime(latestInstructorRequest.submittedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                      Reviewed At
                    </p>
                    <p className="mt-1 text-xs text-foreground">
                      {formatDateTime(latestInstructorRequest.reviewedAt)}
                    </p>
                  </div>
                </div>

                {latestInstructorRequest.proofUrl && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                      Proof File
                    </p>
                    <a
                      href={latestInstructorRequest.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-primary hover:text-primary-hover underline"
                    >
                      {latestInstructorRequest.proofFileName ?? "Open proof file"}
                    </a>
                  </div>
                )}

                {latestInstructorRequest.status === "rejected" &&
                  latestInstructorRequest.rejectReason && (
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                        Rejection Note
                      </p>
                      <p className="mt-1 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
                        {latestInstructorRequest.rejectReason}
                      </p>
                    </div>
                  )}
              </div>
            )}

            {errors?.notes && (
              <p className="mt-3 text-sm font-semibold text-destructive">
                {errors.notes}
              </p>
            )}
            {errors?.files && (
              <p className="mt-2 text-sm font-semibold text-destructive">
                {errors.files}
              </p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => instructorRequestUploadDialogRef.current?.open()}
                disabled={isRequestLocked}
                className={`px-5 py-2.5 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200 ${
                  isRequestLocked
                    ? "bg-muted text-muted-foreground/70 cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-primary-hover"
                }`}
              >
                Submit Instructor Request
              </button>
              {hasInstructorRole && (
                <p className="text-xs text-emerald-600 dark:text-emerald-300 font-semibold">
                  Instructor role already active on your account.
                </p>
              )}
              {!hasInstructorRole && currentRequestStatus === "pending" && (
                <p className="text-xs text-amber-600 dark:text-amber-300 font-semibold">
                  Your request is currently under review.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            onClick={handleDiscard}
            className="px-6 py-3 text-sm font-extrabold tracking-widest text-foreground uppercase border border-border rounded-xl hover:bg-muted transition-colors"
          >
            Discard Changes
          </button>
          <button
            onClick={handleSubmit}
            className="px-8 py-3 text-sm font-extrabold tracking-widest text-primary-foreground uppercase bg-primary hover:bg-primary-hover rounded-xl shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all duration-200"
          >
            Save Profile Settings
          </button>
        </div>
      </div>
      <UploadDialog
        ref={uploadDialogRef}
        single
        imageOnly
        options={{
          route: route("student.avatar.update"),
        }}
      />
      <UploadDialog2
        ref={instructorRequestUploadDialogRef}
        single
        allowNotes
        notesRequired
        notesPlaceholder="Jelaskan alasan Anda ingin menjadi instructor."
        options={{
          route: route("student.instructor-requests.store"),
        }}
      />
    </MainLayout>
  );
}
