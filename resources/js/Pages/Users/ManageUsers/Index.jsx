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

function Index({ lang }) {
  const [openNewUser, setOpenNewUser] = useState(false);
  const tableRef = useRef();
  const columns = useMemo(
    () => [
      {
        name: "name",
        title: "Name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            // eslint-disable-next-line no-undef
            href={route("users.edit", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        name: "email",
        title: "Email",
        searchType: "text",
        sortable: true,
        resizeable: true,
      },
      {
        name: "status",
        width: "fit",
        title: "Status",
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
      },
      {
        name: "created_at",
        title: "Created at",
        searchType: "date",
        width: "fit",
        sortable: true,
        cell: ({ dataRow }) => {
          return (
            <span>
              {format(new TZDate(dataRow.created_at, "UTC"), "PPPp", {
                locale: getLocaleDate(lang),
              })}
            </span>
          );
        },
      },
    ],
    [lang],
  );
  return (
    <Dialog open={openNewUser} onOpenChange={setOpenNewUser}>
      <DataTable
        ref={tableRef}
        title="Manage Users"
        buttonAdd={{
          title: "Add User",
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
