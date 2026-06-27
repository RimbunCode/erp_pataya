import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";

import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";

function Index() {
  const route = window.route;
  return (
    <DataTable2
      usePasswordConfirmationForDelete
      templateItem={({ dataRow: user }) => {
        const alias = user.name
          .split(" ")
          .slice(0, 2)
          .map((n) => n.charAt(0))
          .join("");
        return (
          <Link
            as="button"
            href={route("users.show", user.id)}
            className="flex justify-start gap-1 p-4 border-b gap-x-4 border-muted-foreground/25"
          >
            <Avatar className="rounded-lg size-12">
              {user.image && (
                <AvatarImage
                  src={
                    route("files.preview", user.image) +
                    `?v=${new Date(user.updated_at).getTime()}`
                  }
                  alt={user.name}
                />
              )}
              <AvatarFallback className="text-xl font-semibold rounded-full">
                {alias}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-left">{user.name}</p>
              <p className="text-sm text-left">{user.email}</p>
            </div>
          </Link>
        );
      }}
      classNameDialog="max-w-4xl!"
      form={<Form />}
    />
  );
}

export default Index;
