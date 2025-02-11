import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import React, { useRef } from "react";

import DataTable from "@/Pages/Core/DataTable";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import { Link } from "@inertiajs/react";
import moment from "moment-timezone";

function Index({ data, sort, show }) {
  const [openNewUser, setOpenNewUser] = React.useState(false);
  const tableRef = useRef();
  const columns = [
    {
      name: "name",
      title: "Name",
      searchType: "text",
      sortable: true,
      resizeable: true,
      cell: ({ row }) => (
        // eslint-disable-next-line no-undef
        <Link className="hover:underline" href={route("users.edit", row.id)}>
          {row.name}
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
      title: "Status",
      searchType: ["invited", "active", "inactive"],
      sortable: false,
      cell: ({ row }) => (
        <button
          className="capitalize badge success w-fit"
          type="button"
          onClick={() => {
            tableRef.current.addFilter("status", "eq", row.status);
          }}
        >
          {row.status.replace(/(\-|\_)/g, " ")}
        </button>
      ),
    },
    {
      name: "created_at",
      title: "Created at",
      searchType: "date",
      sortable: true,
      cell: ({ row }) => (
        <span>{moment.utc(row.created_at).local().format("DD-MM-YYYY")}</span>
      ),
    },
  ];
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
        data={data}
        defaultSort={sort}
        defaultShow={show}
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
