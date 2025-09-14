import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { LogOut, UserCog2 } from "lucide-react";

import Link from "../Link";
import { memo } from "react";
import { usePage } from "@inertiajs/react";

export default memo(function UserInfo() {
  const route = window.route;
  const user = usePage().props.auth.user;
  const alias = user.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center border-gray-200 rounded-md lg:mx-2 gap-x-2 dark:border-gray-700">
        <Avatar className="rounded-lg size-9">
          {user.image && (
            <AvatarImage
              src={
                route("files.show", user.image) +
                `?v=${new Date(user.updated_at).getTime()}`
              }
              alt={user.name}
            />
          )}
          <AvatarFallback className="text-base font-semibold rounded-full">
            {alias}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="rounded-lg w-fit min-w-56"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-1 py-1.5 text-left text-sm">
            <Avatar className="rounded-lg size-12">
              {user.image && (
                <AvatarImage
                  src={
                    route("files.show", user.image) +
                    `?v=${new Date(user.updated_at).getTime()}`
                  }
                  alt={user.name}
                />
              )}
              <AvatarFallback className="text-xl font-semibold rounded-lg">
                {alias}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-base leading-tight text-left">
              <span className="font-semibold truncate">{user.name}</span>
              <span className="text-sm truncate text-foreground/80">
                {user.username}
              </span>
              <div className="flex p-0.5  rounded-full gap-x-1 items-center text-foreground/80  bg-muted">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="size-4"
                >
                  <path
                    fill="currentColor"
                    d="M12.72 2.03A9.99 9.99 0 0 0 2.03 12.72C2.39 18.01 7.01 22 12.31 22H16c.55 0 1-.45 1-1s-.45-1-1-1h-3.67c-3.73 0-7.15-2.42-8.08-6.03c-1.49-5.8 3.91-11.21 9.71-9.71C17.58 5.18 20 8.6 20 12.33v1.1c0 .79-.71 1.57-1.5 1.57s-1.5-.78-1.5-1.57v-1.25c0-2.51-1.78-4.77-4.26-5.12a5.008 5.008 0 0 0-5.66 5.87a5 5 0 0 0 3.72 3.94c1.84.43 3.59-.16 4.74-1.33c.89 1.22 2.67 1.86 4.3 1.21c1.34-.53 2.16-1.9 2.16-3.34v-1.09c0-5.31-3.99-9.93-9.28-10.29M12 15c-1.66 0-3-1.34-3-3s1.34-3 3-3s3 1.34 3 3s-1.34 3-3 3"
                  />
                </svg>
                <span className="text-sm truncate">{user.email}</span>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link
              href={route("users.show", user.id)}
              as="button"
              className="w-full"
            >
              <UserCog2 />
              Manage Account
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link
            href={route("logout")}
            method="post"
            as="button"
            className="w-full text-red-500 hover:text-red-500!"
          >
            <LogOut />
            Log out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
