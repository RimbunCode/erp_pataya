import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Head, router } from "@inertiajs/react";
import AuthLayout from "@/Layouts/AuthLayout";
import RoleSelectionCards from "@/Components/Auth/RoleSelectionCards";
import { pickAuthRoles } from "@/lib/authRoles";
import { useState } from "react";

export default function SelectRole({
  roles = [],
  contact_admin_url = "/contact",
}) {
  const route = window.route;
  const availableRoles = pickAuthRoles(roles);
  const [processing, setProcessing] = useState(false);

  const handleSelectRole = (roleKey) => {
    setProcessing(true);
    router.post(
      route("login.select-role.store"),
      {
        preferred_role: roleKey,
      },
      {
        onFinish: () => {
          setProcessing(false);
        },
      },
    );
  };

  return (
    <AuthLayout className="max-w-xl">
      <Head title="Select Role" />
      <CardHeader>
        <CardTitle className="text-xl">Select Role</CardTitle>
        <CardDescription>
          Choose the role you want to use for this session.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0!">
        {availableRoles.length > 0 ? (
          <RoleSelectionCards
            roles={availableRoles}
            onSelect={(role) => handleSelectRole(role.key)}
            compact={true}
          />
        ) : (
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your account has no active role.{" "}
            <a
              href={contact_admin_url}
              className="font-semibold text-primary hover:text-primary-hover underline"
            >
              Contact Admin
            </a>
            .
          </div>
        )}

        {processing && (
          <p className="mt-4 text-sm text-muted-foreground">Redirecting...</p>
        )}
      </CardContent>
    </AuthLayout>
  );
}
