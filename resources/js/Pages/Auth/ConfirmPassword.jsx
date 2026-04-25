import { Head, useForm } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
import { CardContent } from "@/Components/ui/card";
import AuthLayout from "@/Layouts/AuthLayout";
import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import TextInput from "@/Components/TextInput";

export default function ConfirmPassword() {
  const route = window.route;
  const { data, setData, post, processing, errors, reset } = useForm({
    password: "",
  });

  const submit = (e) => {
    e.preventDefault();

    post(route("password.confirm"), {
      onFinish: () => reset("password"),
    });
  };

  return (
    <AuthLayout>
      <Head title="Confirm Password" />

      <CardContent>
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          This is a secure area of the application. Please confirm your password
          before continuing.
        </div>

        <form onSubmit={submit}>
          <div className="mt-4">
            <InputLabel htmlFor="password" value="Password" />

            <TextInput
              id="password"
              type="password"
              name="password"
              value={data.password}
              className="block w-full mt-1"
              isFocused={true}
              onChange={(e) => setData("password", e.target.value)}
            />

            <InputError message={errors.password} className="mt-2" />
          </div>

          <div className="flex items-center justify-end mt-4">
            <Button className="ms-4" disabled={processing}>
              Confirm
            </Button>
          </div>
        </form>
      </CardContent>
    </AuthLayout>
  );
}
