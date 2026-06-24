import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";

import { Button } from "../ui/button";

function Notifications() {
  //  TODO: Create a notification component that shows the notifications

  return null;
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
          <span className="absolute left-1/2 top-0.5 rounded-full bg-red-600 px-1 text-xs font-medium leading-4 text-white">
            8
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="p-0! overflow-hidden h-[460px] w-96 flex flex-col"
      >
        <div className="sticky top-0 flex items-center justify-between px-4 py-1 bg-white shadow-md dark:bg-gray-800">
          <h3 className="text-base font-bold">Notifications</h3>
          <div className="flex gap-x-1">
            <Button tooltip="Mark all as read" variant="gosht">
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
        <div className=" flex flex-col h-full text-center justify-center items-center">
          <p className="font-bold text-lg">Under Development </p>
          <p>Please wait for the next update, thank you.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default Notifications;
