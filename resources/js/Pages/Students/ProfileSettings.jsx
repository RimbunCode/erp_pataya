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
import { Trash2Icon, UploadIcon, CalendarIcon } from "lucide-react";
import { Button } from "@/Components/ui/button";
import Link from "@/Components/Link";
import { FormPageDialog } from "../Core/FormPage";
import FormChangePassword from "../Users/ManageUsers/FormChangePassword";
import { format, setMonth, setYear } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import { Calendar } from "@/Components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - 5 - i);

function BirthdateCalendar({ value, onChange }) {
  const [calendarMonth, setCalendarMonth] = useState(
    value ?? new Date(2000, 0, 1),
  );
  return (
    <Calendar
      mode="single"
      selected={value}
      onSelect={onChange}
      month={calendarMonth}
      onMonthChange={setCalendarMonth}
      initialFocus
      components={{
        Caption: () => (
          <div className="flex items-center gap-2 px-1 pt-1 pb-2">
            <Select
              value={String(calendarMonth.getMonth())}
              onValueChange={(v) =>
                setCalendarMonth(setMonth(calendarMonth, Number(v)))
              }
            >
              <SelectTrigger className="h-8 flex-1 text-sm font-semibold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(calendarMonth.getFullYear())}
              onValueChange={(v) =>
                setCalendarMonth(setYear(calendarMonth, Number(v)))
              }
            >
              <SelectTrigger className="h-8 w-24 text-sm font-semibold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ),
      }}
    />
  );
}

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
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const inputClass =
  "w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-md transition-all";

export default function ProfileSettings({
  user,
  profile,
  latestInstructorRequest,
}) {
  const { errors } = usePage().props;
  const [preview, setPreview] = useState(null);
  const uploadDialogRef = useRef();
  const changePasswordDialogRef = useRef();
  const instructorRequestUploadDialogRef = useRef();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const parsedBirthdate = user?.birthdate ? new Date(user.birthdate) : null;
  const rawPhone = (user?.phone ?? "").replace(/^\+62/, "").replace(/^0/, "");

  const [form, setForm] = useState({
    // — from users table —
    name: user?.name ?? "",
    username: user?.username ?? "",
    email: user?.email ?? "",
    phone: rawPhone,
    gender: user?.gender ?? "",
    birthdate: parsedBirthdate,
    // — from student_profiles table —
    institution: profile?.institution ?? "",
    student_id_number: profile?.student_id_number ?? "",
    socials: profile?.socials ?? [],
    bio: profile?.bio ?? "",
  });

  const addSocial = () =>
    setForm((prev) => ({
      ...prev,
      socials: [...prev.socials, { platform: "", url: "" }],
    }));
  const removeSocial = (index) =>
    setForm((prev) => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index),
    }));
  const updateSocial = (index, field, value) =>
    setForm((prev) => ({
      ...prev,
      socials: prev.socials.map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      ),
    }));
  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleDiscard = () =>
    setForm({
      name: user?.name ?? "",
      username: user?.username ?? "",
      email: user?.email ?? "",
      phone: rawPhone,
      gender: user?.gender ?? "",
      birthdate: parsedBirthdate,
      institution: profile?.institution ?? "",
      student_id_number: profile?.student_id_number ?? "",
      socials: profile?.socials ?? [],
      bio: profile?.bio ?? "",
    });

  const handleSubmit = () => {
    router.put(route("student.profile.update"), {
      ...form,
      phone: form.phone ? `+62${form.phone}` : null,
      birthdate: form.birthdate ? format(form.birthdate, "yyyy-MM-dd") : null,
    });
  };

  const roleNames = (user?.roles ?? [])
    .map((r) => (typeof r === "string" ? r : r?.name))
    .filter(Boolean)
    .map((n) => n.toLowerCase());
  const accountRoleLabel =
    roleNames.length > 0 ? roleNames.join(", ") : "Student";
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
    <>
      <MainLayout title="Profile Settings" breadcrumb="Profile">
        <div className="p-8 flex flex-col gap-8">
          {/* Avatar + Name */}
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
                {accountRoleLabel} Account
              </p>
              <Button
                type="button"
                variant="primary"
                onClick={() => changePasswordDialogRef.current?.open()}
                className="mt-2 ml-4"
              >
                Change Password
              </Button>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-card rounded-3xl border border-border shadow-sm p-8 flex flex-col gap-6">
            {/* Section: Account Info */}
            <div>
              <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-4 pb-2 border-b border-border">
                Account Info
              </p>
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
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      placeholder="yourusername"
                      className={`${inputClass}`}
                    />
                  </div>
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
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                    Phone Number
                  </label>
                  <div className="flex rounded-xl overflow-hidden border border-border focus-within:ring-2 focus-within:ring-ring shadow-md transition-all">
                    <span className="flex items-center px-4 bg-muted border-r border-border text-base font-semibold text-foreground select-none shrink-0">
                      +62
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/^\+62/, "")
                          .replace(/^0/, "")
                          .replace(/\D/g, "")
                          .slice(0, 12);
                        setForm((prev) => ({ ...prev, phone: val }));
                      }}
                      placeholder="812 3456 7890"
                      maxLength={12}
                      inputMode="numeric"
                      className="flex-1 border-none bg-muted px-4 py-3 text-base text-foreground placeholder-muted-foreground focus:outline-none"
                    />
                    {form.phone.length > 0 && (
                      <span className="flex items-center pr-4 text-xs font-semibold tabular-nums text-muted-foreground/60 shrink-0 select-none">
                        {form.phone.length}/12
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card shadow-md transition-all"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                    Date of Birth
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal rounded-xl border border-border bg-muted px-4 py-3 h-auto text-base hover:bg-card shadow-md",
                          !form.birthdate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {form.birthdate
                          ? format(form.birthdate, "dd MMM yyyy")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <BirthdateCalendar
                        value={form.birthdate}
                        onChange={(d) =>
                          setForm((prev) => ({ ...prev, birthdate: d ?? null }))
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Section: Student Profile */}
            <div>
              <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-4 pb-2 border-b border-border">
                Student Profile
              </p>
              <div className="grid grid-cols-2 gap-6">
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
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                    Student ID Number
                  </label>
                  <input
                    type="text"
                    name="student_id_number"
                    value={form.student_id_number}
                    onChange={handleChange}
                    placeholder="123456789xx"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Social Media */}
              <div className="mt-6">
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
                        <select
                          value={social.platform}
                          onChange={(e) =>
                            updateSocial(index, "platform", e.target.value)
                          }
                          className="w-36 flex-shrink-0 bg-muted border border-border rounded-xl px-3 py-3 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card shadow-sm transition-all"
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
                        <input
                          type="url"
                          value={social.url}
                          onChange={(e) =>
                            updateSocial(index, "url", e.target.value)
                          }
                          placeholder="https://..."
                          className="flex-1 bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card shadow-sm transition-all"
                        />
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

              {/* Bio */}
              <div className="mt-6">
                <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                  Student Bio
                </label>
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Tell us about your background..."
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-muted-foreground shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border transition-all resize-none"
                />
              </div>
            </div>

            {/* Instructor Request */}
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
                    Upload one supporting document and explain why you should
                    get instructor access.
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
                        {latestInstructorRequest.proofFileName ??
                          "Open proof file"}
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
                  onClick={() =>
                    instructorRequestUploadDialogRef.current?.open()
                  }
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
          options={{ route: route("student.avatar.update") }}
        />
        <UploadDialog2
          ref={instructorRequestUploadDialogRef}
          single
          allowNotes
          notesRequired
          notesPlaceholder="Jelaskan alasan Anda ingin menjadi instructor."
          options={{ route: route("student.instructor-requests.store") }}
        />
      </MainLayout>
      <FormPageDialog
        ref={changePasswordDialogRef}
        name="change_password"
        ignoreDraft
        method="put"
        routeName="password.update"
        title="Change Password"
      >
        <FormChangePassword />
      </FormPageDialog>
    </>
  );
}
