import { Head } from "@inertiajs/react";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import AuthLayout from "@/Layouts/AuthLayout";
import Link from "@/Components/Link";

export default function OrganizationCompleteSuccess() {
  return (
    <AuthLayout>
      <Head title="Profile Submitted" />
      <CardHeader>
        <CardTitle className="text-xl">Profile Submitted!</CardTitle>
        <CardDescription>
          Thank you for completing your organization profile. Your submission is
          now pending review by our admin team. You will receive an email
          notification once your account has been approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-7 h-7 text-emerald-600 dark:text-emerald-400"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              What happens next?
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Our admin team will review your submission and create your
              organization account. You will receive a confirmation email with
              your login credentials.
            </p>
          </div>
          <Link
            href={route("login")}
            className="text-sm text-primary underline underline-offset-4"
          >
            Go to Login
          </Link>
        </div>
      </CardContent>
    </AuthLayout>
  );
}
