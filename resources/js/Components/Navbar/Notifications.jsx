import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";

import { Button } from "../ui/button";
import { router, usePage } from "@inertiajs/react";
import { cn } from "@/lib/utils";

const notifIcons = {
  payout_requested: (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  course_approval_requested: (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  submission_received: (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  new_course_note: (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  new_course_content: (
    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
};

const defaultIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

function Notifications() {
  const { notifications } = usePage().props;
  const unreadCount = notifications?.unread_count ?? 0;
  const items = notifications?.items ?? [];

  const handleMarkAllRead = () => {
    router.post(
      "/notifications/read-all",
      {},
      { preserveScroll: true, preserveState: false },
    );
  };

  const handleClickItem = (notif) => {
    router.post(
      `/notifications/${notif.id}/read`,
      {},
      {
        preserveScroll: true,
        preserveState: false,
        onSuccess: () => router.visit(notif.action_url),
      },
    );
  };

  return (
    <Popover>
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
            <span className="absolute left-1/2 top-0.5 rounded-full bg-role-dot px-1 text-xs font-medium leading-4 text-primary-foreground">
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
        <div className="sticky top-0 flex items-center justify-between px-4 py-2 bg-card border-b border-border shadow-sm z-10">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold">Notifikasi</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-role-dot px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground leading-none">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-auto py-1"
              onClick={handleMarkAllRead}
            >
              Tandai semua dibaca
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col h-full text-center justify-center items-center gap-2 text-muted-foreground px-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-sm font-medium">Tidak ada notifikasi baru</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((notif) => (
                <li key={notif.id}>
                  <button
                    type="button"
                    onClick={() => handleClickItem(notif)}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <span className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-primary-soft text-primary flex items-center justify-center">
                      {notifIcons[notif.type] ?? defaultIcon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notif.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {notif.created_at}
                      </p>
                    </div>
                    <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-role-dot" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default Notifications;
