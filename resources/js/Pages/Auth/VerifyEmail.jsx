import { Head, useForm } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
import { CardContent } from "@/Components/ui/card";
import AuthLayout from "@/Layouts/AuthLayout";
import Link from "@/Components/Link";

export default function VerifyEmail({ status }) {
  const route = window.route;
  const { post, processing } = useForm({});

  const submit = (e) => {
    e.preventDefault();

    post(route("verification.send"));
  };

  return (
    <AuthLayout>
      <Head title="Email Verification" />

      <CardContent>
        <div className="mb-4 text-sm text-foreground dark:text-muted-foreground">
          Thanks for signing up! Before getting started, could you verify your
          email address by clicking on the link we just emailed to you? If you
          {"didn't"} receive the email, we will gladly send you another.
        </div>

        {status === "verification-link-sent" && (
          <div className="mb-4 text-sm font-medium text-green-600 dark:text-green-400">
            A new verification link has been sent to the email address you
            provided during registration.
          </div>
        )}

        <form onSubmit={submit}>
          <div className="flex items-center justify-between mt-4">
            <Button disabled={processing}>Resend Verification Email</Button>

            <Link
              href={route("logout")}
              method="post"
              as="button"
              className="text-sm text-foreground underline rounded-md hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 dark:text-muted-foreground dark:hover:text-foreground dark:focus:ring-offset-background"
            >
              Log Out
            </Link>
          </div>
        </form>
      </CardContent>
    </AuthLayout>
  );
}
