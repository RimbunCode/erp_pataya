import { Avatar, AvatarImage } from "@/Components/ui/avatar";

import { Card } from "@/Components/ui/card";
import MasterLayout from "./MasterLayout";
import React from "react";
import { cn } from "@/lib/utils";
import { usePage } from "@inertiajs/react";

export default function GuestLayout({ className, children }) {
  const lastReferenceUpdateAt = usePage().props.preferences.updated_at;
  return (
    <MasterLayout>
      <div className="flex flex-col gap-y-2 items-center min-h-screen pt-6 bg-gray-100 sm:justify-center sm:pt-0 dark:bg-gray-900">
        <div>
          <Avatar className="relative h-auto w-64 group">
            <AvatarImage
              src={
                route("company-logo") +
                `?v=${new Date(lastReferenceUpdateAt).getTime()}`
              }
              className="object-contain aspect-auto"
            />
          </Avatar>
        </div>
        <Card className={cn("w-full max-w-md mt-4", className)}>
          {children}
        </Card>
      </div>
    </MasterLayout>
  );
}
