import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import React, { useEffect, useState } from "react";

import { Button } from "../ui/button";
import LoadingIcon from "@/Components/LoadingIcon";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import { getLocaleDate } from "@/lib/utils";
import { gooeyToast } from "@/lib/gooeyToast";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

/**
 * Resolusi tautan notifikasi ke halaman dokumen — mapping FQCN backend
 * (documentType) ke nama route plural Ziggy. Model baru yang butuh
 * notifikasi cukup ditambahkan di sini, tidak perlu ubah backend.
 */
const DOCUMENT_TYPE_ROUTE_MAP = {};

function resolveNotificationUrl(documentType, documentId) {
  if (!documentType || !documentId) return null;
  const routeName = DOCUMENT_TYPE_ROUTE_MAP[documentType];
  if (!routeName) return null;
  try {
    return route(`${routeName}.show`, documentId);
  } catch {
    return null;
  }
}

/**
 * @returns {JSX.Element}
 */
function Notifications() {
  const { t } = useLaravelReactI18n();
  const sharedUnreadCount = usePage().props.unread_notifications_count ?? 0;
  const user = usePage().props.auth?.user;
  const locale = usePage().props.lang;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(sharedUnreadCount);

  useEffect(() => {
    setUnreadCount(sharedUnreadCount);
  }, [sharedUnreadCount]);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    axios
      .get(route("notifications.index"))
      .then((res) => {
        setNotifications(res.data?.notifications ?? []);
        setUnreadCount(res.data?.unread_count ?? 0);
      })
      .catch(() => gooeyToast.error(t("core.errors.fetch_failed")))
      .finally(() => setLoading(false));
  }, [open, t]);

  useEffect(() => {
    if (!user?.id || !window.Echo) return;

    const channel = window.Echo.private(`App.Models.User.User.${user.id}`);
    channel.notification((notification) => {
      setNotifications((prev) =>
        [
          { id: notification.id, data: notification, read_at: null },
          ...prev,
        ].slice(0, 20),
      );
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      window.Echo.leave(`App.Models.User.User.${user.id}`);
    };
  }, [user?.id]);

  const handleNotificationClick = (notification) => {
    axios
      .post(route("notifications.read", notification.id))
      .then((res) => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        const url = resolveNotificationUrl(
          res.data?.documentType,
          res.data?.documentId,
        );
        if (url) {
          setOpen(false);
          router.visit(url);
        }
      })
      .catch(() => gooeyToast.error(t("core.errors.fetch_failed")));
  };

  const handleMarkAllAsRead = () => {
    axios
      .post(route("notifications.readAll"))
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            read_at: n.read_at ?? new Date().toISOString(),
          })),
        );
        setUnreadCount(0);
      })
      .catch(() => gooeyToast.error(t("core.errors.fetch_failed")));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-lg p-2.5 text-sm text-gray-500 hover:bg-gray-100 hover:outline-none dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-5"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M21 19v1H3v-1l2-2v-6c0-3.1 2.03-5.83 5-6.71V4a2 2 0 0 1 2-2a2 2 0 0 1 2 2v.29c2.97.88 5 3.61 5 6.71v6zm-7 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2"
            />
          </svg>
          <span className="sr-only">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute left-1/2 top-0.5 rounded-full bg-red-600 px-1 text-xs font-medium leading-4 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="p-0! overflow-hidden h-[460px] w-96 flex flex-col"
      >
        <div className="sticky top-0 flex items-center justify-between px-4 py-1 bg-white shadow-md dark:bg-gray-800">
          <h3 className="text-base font-bold">
            {t("notification.panel.title")}
          </h3>
          <div className="flex gap-x-1">
            <Button
              type="button"
              tooltip={t("notification.panel.mark_all_as_read")}
              variant="gosht"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-5"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M21.003 15.578a7 7 0 0 0-.87-1.57a4.1 4.1 0 0 1-.89-1.88c0-2.89 0-3.87-1.58-5.76a5.8 5.8 0 0 0-1.9-1.47l-.73-.35a.3.3 0 0 1-.1-.1a.23.23 0 0 1-.05-.1a2.77 2.77 0 0 0-2.93-2.34a2.77 2.77 0 0 0-2.84 2.29a.3.3 0 0 1-.07.14a.3.3 0 0 1-.09.08l-.78.38a5.6 5.6 0 0 0-1.91 1.48c-1.57 1.88-1.57 2.86-1.57 5.75a3.84 3.84 0 0 1-.82 1.77a6.6 6.6 0 0 0-.88 1.62a2.79 2.79 0 0 0 .26 2.37a2.24 2.24 0 0 0 1.94.85h2.82q.065.404.22.78c.198.497.498.947.88 1.32c.37.38.816.677 1.31.87c.46.188.953.287 1.45.29h.16a4 4 0 0 0 2.79-1.16a4 4 0 0 0 .87-1.31q.152-.384.23-.79h2.94a2.4 2.4 0 0 0 1-.23a2.4 2.4 0 0 0 .88-.76c.226-.322.364-.698.4-1.09a2.2 2.2 0 0 0-.14-1.08m-6-5.28l-2.81 2.83c-.113.124-.253.22-.41.28a1.2 1.2 0 0 1-.49.1a1.26 1.26 0 0 1-.91-.38l-1.41-1.4a.75.75 0 0 1 0-1.06a.74.74 0 0 1 1.06 0l1.26 1.25l2.68-2.68a.75.75 0 1 1 1.06 1.06z"
                />
              </svg>
            </Button>
          </div>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
            <LoadingIcon className="size-4" />
            {t("core.form.loading")}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col h-full text-center justify-center items-center gap-1 text-muted-foreground">
            <p className="font-bold text-lg">
              {t("notification.panel.empty.title")}
            </p>
            <p>{t("notification.panel.empty.subtitle")}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className="w-full text-left px-4 py-3 border-b border-muted last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {!notification.read_at && (
                    <span className="mt-1.5 size-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {notification.data?.title}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.data?.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: getLocaleDate(locale),
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default Notifications;
