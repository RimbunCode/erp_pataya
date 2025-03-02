import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { useMemo, useRef, useState } from "react";

import DataTable from "@/Pages/Core/DataTable";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import Link from "@/Components/Link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { getLocaleDate } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

// eslint-disable-next-line jsdoc/require-jsdoc
function Index({ lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const [openNewUser, setOpenNewUser] = useState(false);
  const tableRef = useRef();
  /**
   * @typedef {import('@/Pages/Core/DataTable').ColumnProps} ColumnProps
   * @type {ColumnProps[]}
   */
  const columns = useMemo(
    () => [
      {
        name: "name",
        titleTrans: "user.user.columns.name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("users.show", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        name: "email",
        titleTrans: "user.user.columns.email",
        searchType: "text",
        sortable: true,
        resizeable: true,
      },
      {
        name: "status",
        titleTrans: "user.user.columns.status",
        width: "fit",
        searchType: ["invited", "active", "inactive"],
        parse: {
          invited: "Invitedd",
          active: "Actived",
          inactive: "Inactived",
        },
        cell: ({ dataRow }) => (
          <button
            className="capitalize badge success w-fit"
            type="button"
            onClick={() => {
              tableRef.current.addFilter("status", "eq", dataRow.status);
            }}
          >
            {dataRow.status.replace(/(\-|\_)/g, " ")}
          </button>
        ),
      }
    ],
    [lang],
  );
  return (
    <Dialog open={openNewUser} onOpenChange={setOpenNewUser}>
      <DataTable
        ref={tableRef}
        title={t("user.user.title")}
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
                      route("files.show", user.image) +
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
        addButton={{
          title: t("user.user.addButton"),
          onClick: () => {
            setOpenNewUser(true);
          },
        }}
        columns={columns}
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New User</DialogTitle>
          <DialogDescription className="sr-only">
            Invite new user using email
          </DialogDescription>
        </DialogHeader>
        <FormInput label="Fullname">
          <Input required name="fullname" type="text" placeholder="John Doe" />
        </FormInput>
        <FormInput label="Email">
          <Input required name="email" type="email" placeholder="John Doe" />
        </FormInput>
        <FormInput label="Role">
          <Input required placeholder="John Doe" />
        </FormInput>
      </DialogContent>
    </Dialog>
  );
}

export default Index;
