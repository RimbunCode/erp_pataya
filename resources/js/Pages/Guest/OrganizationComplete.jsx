import { useState } from "react";
import { Head, useForm } from "@inertiajs/react";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import AuthLayout from "@/Layouts/AuthLayout";
import { Input } from "@/Components/ui/input";
import InputError from "@/Components/InputError";
import { Label } from "@/Components/ui/label";
import PasswordInput from "@/Components/PasswordInput";

const EMPLOYEE_OPTIONS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
];

export default function OrganizationComplete({
  invitation,
  expired = false,
  alreadyDone = false,
}) {
  const [isVisible, setIsVisible] = useState(false);

  const { data, setData, post, processing, errors, reset } = useForm({
    organization_name: invitation.organizationName ?? "",
    email: invitation.email ?? "",
    contact_person: invitation.contactPerson ?? "",
    address: "",
    phone: "",
    website: "",
    industry: "",
    employee_count: "",
    logo: null,
    password: "",
    password_confirmation: "",
  });

  const submit = (e) => {
    e.preventDefault();
    post(route("organization.complete.store", { token: window.location.pathname.split("/").pop() }), {
      onFinish: () => reset("password", "password_confirmation"),
    });
  };

  if (expired) {
    return (
      <AuthLayout>
        <Head title="Invitation Expired" />
        <CardHeader>
          <CardTitle className="text-xl text-destructive">
            Invitation Expired
          </CardTitle>
          <CardDescription>
            This invitation link for{" "}
            <span className="font-semibold text-foreground">
              {invitation.organizationName}
            </span>{" "}
            has expired. Please contact the admin to request a new invitation.
          </CardDescription>
        </CardHeader>
      </AuthLayout>
    );
  }

  if (alreadyDone) {
    return (
      <AuthLayout>
        <Head title="Already Completed" />
        <CardHeader>
          <CardTitle className="text-xl">Already Processed</CardTitle>
          <CardDescription>
            This invitation for{" "}
            <span className="font-semibold text-foreground">
              {invitation.organizationName}
            </span>{" "}
            has already been {invitation.status}. No further action is needed.
          </CardDescription>
        </CardHeader>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Head title="Complete Organization Profile" />
      <CardHeader>
        <CardTitle className="text-xl">Complete Your Profile</CardTitle>
        <CardDescription>
          Fill in the remaining details for{" "}
          <span className="font-semibold text-foreground">
            {invitation.organizationName}
          </span>{" "}
          and set your account password.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0!">
        <form onSubmit={submit}>
          <div className="grid gap-4">
            {/* Editable basic info */}
            <div className="grid gap-2">
              <Label htmlFor="organization_name">Organization Name</Label>
              <Input
                id="organization_name"
                value={data.organization_name}
                onChange={(e) => setData("organization_name", e.target.value)}
                required
              />
              <InputError message={errors.organization_name} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => setData("email", e.target.value)}
                required
              />
              <InputError message={errors.email} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={data.contact_person}
                onChange={(e) => setData("contact_person", e.target.value)}
                required
              />
              <InputError message={errors.contact_person} />
            </div>

            <hr className="border-border" />

            {/* Profile fields */}
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={data.address}
                onChange={(e) => setData("address", e.target.value)}
              />
              <InputError message={errors.address} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={data.phone}
                  onChange={(e) => setData("phone", e.target.value)}
                />
                <InputError message={errors.phone} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={data.website}
                  onChange={(e) => setData("website", e.target.value)}
                  placeholder="https://"
                />
                <InputError message={errors.website} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={data.industry}
                  onChange={(e) => setData("industry", e.target.value)}
                />
                <InputError message={errors.industry} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="employee_count">Employees</Label>
                <select
                  id="employee_count"
                  value={data.employee_count}
                  onChange={(e) => setData("employee_count", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select range</option>
                  {EMPLOYEE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <InputError message={errors.employee_count} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="logo">Logo</Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={(e) => setData("logo", e.target.files[0])}
              />
              <InputError message={errors.logo} />
            </div>

            <hr className="border-border" />

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                type={isVisible ? "text" : "password"}
                value={data.password}
                onChange={(e) => setData("password", e.target.value)}
                required
                visible={isVisible}
                onVisibleChange={setIsVisible}
              />
              <InputError message={errors.password} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password_confirmation">Confirm Password</Label>
              <PasswordInput
                id="password_confirmation"
                type="password"
                value={data.password_confirmation}
                onChange={(e) =>
                  setData("password_confirmation", e.target.value)
                }
                required
                visible={isVisible}
                onVisibleChange={setIsVisible}
              />
              <InputError message={errors.password_confirmation} />
            </div>

            <Button type="submit" className="w-full" disabled={processing}>
              {processing ? "Submitting..." : "Submit Profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </AuthLayout>
  );
}
