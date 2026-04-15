import AppLayout from "@/Layouts/AppLayout";
import { Head } from "@inertiajs/react";

const statuses = {
  403: {
    title: "403: Forbidden",
    description: "You are not allowed to access this page.",
  },
  404: {
    title: "404: Page Not Found",
    description: "The page you are looking for could not be found.",
  },
  500: {
    title: "500: Server Error",
    description: "Something went wrong on our side.",
  },
  503: {
    title: "503: Service Unavailable",
    description: "The service is temporarily unavailable.",
  },
};

export default function Error({ status, useAppLayout = false }) {
  const page = statuses[status] ?? statuses[500];

  const content = (
    <>
      <Head title={page.title} />
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-4xl font-semibold text-foreground">{page.title}</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          {page.description}
        </p>
      </div>
    </>
  );

  if (!useAppLayout) {
    return content;
  }

  return <AppLayout className="justify-center">{content}</AppLayout>;
}
