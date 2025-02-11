import ApplicationLogo from "@/Components/ApplicationLogo";
import { Card } from "@/Components/ui/card";
import { Link } from "@inertiajs/react";
import MasterLayout from "./MasterLayout";
import { cn } from "@/lib/utils";

export default function GuestLayout({ className, children }) {
  return (
    <MasterLayout>
      <div className="flex flex-col items-center min-h-screen pt-6 bg-gray-100 sm:justify-center sm:pt-0 dark:bg-gray-900">
        <div>
          <Link href="/">
            <ApplicationLogo className="w-20 h-20 text-gray-500 fill-current" />
          </Link>
        </div>
        <Card className={cn("w-full max-w-md mt-4", className)}>
          {children}
        </Card>
      </div>
    </MasterLayout>
  );
}
