import { Head, useForm } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
import { CardContent } from "@/Components/ui/card";
import GuestLayout from "@/Layouts/GuestLayout";
import InputError from "@/Components/InputError";
import { Skeleton } from "@/Components/ui/skeleton";
import TextInput from "@/Components/TextInput";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function ForgotPassword({ status }) {
  const { t, loading } = useLaravelReactI18n();
  const route = window.route;
  const { data, setData, post, processing, errors } = useForm({
    email: "",
  });

  const submit = (e) => {
    e.preventDefault();

    post(route("password.email"));
  };

  return (
    <GuestLayout>
      <Head title="Forgot Password" />
      <CardContent>
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {loading ? (
            <Skeleton className="w-full h-16" />
          ) : (
            t("auth.forgotPassword.description")
          )}
        </div>

        {status && (
          <div className="mb-4 text-sm font-medium text-green-600 dark:text-green-400">
            {status}
          </div>
        )}

        <form onSubmit={submit}>
          <TextInput
            id="email"
            type="email"
            name="email"
            value={data.email}
            className="block w-full mt-1"
            isFocused={true}
            onChange={(e) => setData("email", e.target.value)}
          />

          <InputError message={errors.email} className="mt-2" />

          <div className="flex items-center justify-end mt-4">
            {loading ? (
              <Skeleton className="w-64 h-6" />
            ) : (
              <Button className="ms-4" disabled={processing}>
                {t("auth.forgotPassword.button")}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </GuestLayout>
  );
}
