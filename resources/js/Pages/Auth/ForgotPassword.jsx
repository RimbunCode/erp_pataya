import { Head, useForm } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
import { CardContent } from "@/Components/ui/card";
import AuthLayout from "@/Layouts/AuthLayout";
import InputError from "@/Components/InputError";
import TextInput from "@/Components/TextInput";

export default function ForgotPassword({ status }) {
  const route = window.route;
  const { data, setData, post, processing, errors } = useForm({
    email: "",
  });

  const submit = (event) => {
    event.preventDefault();
    post(route("password.email"));
  };

  return (
    <AuthLayout>
      <Head title="Forgot Password" />
      <CardContent>
        <div className="mb-4 text-sm text-foreground dark:text-muted-foreground">
          Forgot your password? No problem. Enter your email address and we will
          send you a password reset link.
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
            onChange={(event) => setData("email", event.target.value)}
          />

          <InputError message={errors.email} className="mt-2" />

          <div className="flex items-center justify-end mt-4">
            <Button className="ms-4" disabled={processing}>
              Send Password Reset Link
            </Button>
          </div>
        </form>
      </CardContent>
    </AuthLayout>
  );
}
