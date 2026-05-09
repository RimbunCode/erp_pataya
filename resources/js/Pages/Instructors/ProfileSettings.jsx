import { useEffect, useMemo, useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import MainLayout from "@/Layouts/MainLayout";
import UploadDialog from "../Core/Components/UploadDialog";
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

export default function ProfileSettings({ user, profile }) {
  const [preview, setPreview] = useState(null);
  const uploadDialogRef = useRef();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    professional_title: profile?.professional_title ?? "",
    expertise: profile?.expertise ?? "",
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
      professional_title: profile?.professional_title ?? "",
      expertise: profile?.expertise ?? "",
      socials: profile?.socials ?? [],
      bio: profile?.bio ?? "",
    });
  };
  const handleSubmit = () => {
    router.put(route("instructor.profile.update"), form);
  };
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
                        href={route("instructor.image.delete")}
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
            <h2 className="text-2xl pl-4 font-black text-gray-600 uppercase tracking-tight">
              {user?.name}
            </h2>
            <p className="text-xs pl-4 font-extrabold tracking-widest text-blue-500 uppercase mt-1">
              {user?.roles.map((r) => r.name)?.join(", ")} Account
            </p>
            <div className="flex items-center gap-4 mt-3">
              <button
                onClick={() => uploadDialogRef.current?.open()}
                className="text-xs font-extrabold ..."
              >
                Update Photo
              </button>
              <button className="text-xs font-extrabold tracking-widest text-red-400 uppercase hover:text-red-500 transition-colors">
                Remove
              </button>
            </div>
          </div>
        </div>

        {/* ── Form Card ── */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 flex flex-col gap-6">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 shadow-md transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 shadow-md transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
                Academic / Professional Title
              </label>
              <input
                type="text"
                name="professional_title"
                value={form.professional_title}
                onChange={handleChange}
                placeholder="Senior Structural Engineer"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 shadow-md transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
                Expertise
              </label>
              <input
                type="text"
                name="expertise"
                value={form.expertise}
                onChange={handleChange}
                placeholder="Structural Engineer"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 shadow-md transition-all"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                  Social Media
                </label>
                <button
                  type="button"
                  onClick={addSocial}
                  className="flex items-center gap-1 text-[10px] font-extrabold tracking-widest text-blue-600 hover:text-blue-700 uppercase transition-colors"
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
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
                >
                  <svg
                    className="w-4 h-4 text-gray-300"
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
                  <span className="text-xs text-gray-300 font-semibold">
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
                        className="w-36 flex-shrink-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
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
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
                      />

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeSocial(index)}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl border border-gray-200 text-gray-300 hover:text-red-400 hover:border-red-200 hover:bg-red-50 transition-all duration-200"
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
              <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+62 812 XXXX XXXX"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 shadow-md transition-all"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
              Professional Bio
            </label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={5}
              placeholder="Tell us about your engineering background..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-400 transition-all resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            onClick={handleDiscard}
            className="px-6 py-3 text-xs font-extrabold tracking-widest text-black uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Discard Changes
          </button>
          <button
            onClick={handleSubmit}
            className="px-8 py-3 text-xs font-extrabold tracking-widest text-white uppercase bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200"
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
          route: route("instructor.avatar.update"),
        }}
      />
    </MainLayout>
  );
}
