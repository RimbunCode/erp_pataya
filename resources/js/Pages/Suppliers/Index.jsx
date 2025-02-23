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
import { useLaravelReactI18n } from "laravel-react-i18n";
import { cn, getLocaleDate } from "@/lib/utils";
import { router } from "@inertiajs/react";

function Index({ lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const [openNewSupplier, setOpenNewSupplier] = useState(false);
  const tableRef = useRef();
  const columns = useMemo(
    () => [
      {
        name: "name",
        titleTrans: "purchase.supplier.columns.name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
        cell: ({ dataRow }) => (
          <Link
            className="hover:underline"
            href={route("suppliers.show", dataRow.id)}
          >
            {dataRow.name}
          </Link>
        ),
      },
      {
        name: "email",
        titleTrans: "purchase.supplier.columns.email",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
      },
      {
        name: "phone",
        titleTrans: "purchase.supplier.columns.phone",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
      },
      {
        name: "street",
        titleTrans: "purchase.supplier.columns.street",
        searchType: "text",
        sortable: true,
        resizeable: true,
        show: true,
      },
      {
        name: "is_disabled",
        titleTrans: "purchase.supplier.columns.is_disabled",
        width: "fit",
        sortable: true,
        show: true,
        searchType: "boolean",
        parse: {
          true: "Active",
          false: "Inactive",
        },
        cell: ({ dataRow, valueCell }) => {
          return (
            <button
              className={cn(
                dataRow.is_disabled ? "error" : "primary",
                "capitalize badge w-fit",
              )}
              type="button"
              onClick={() => {
                tableRef.current.addFilter(
                  "is_disabled",
                  "eq",
                  dataRow.is_disabled,
                );
              }}
            >
              {valueCell}
            </button>
          );
        },
      },
    ],
    [lang],
  );
  return (
    <Dialog open={openNewSupplier} onOpenChange={setOpenNewSupplier}>
      <DataTable
        ref={tableRef}
        title={t("purchase.supplier.title")}
        addButton={{
          title: t("purchase.supplier.addButton"),
          onClick: () => {
            router.visit(route("supplier.create"));
          },
        }}
        columns={columns}
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Supplier</DialogTitle>
        </DialogHeader>
        <FormInput label="Fullname">
          <Input
            required
            name="name"
            type="text"
            placeholder="PT Pataya Sarana Niaga"
          />
        </FormInput>
        <FormInput label="Email">
          <Input
            required
            name="email"
            type="email"
            placeholder="ptpsn@gmail.com"
          />
        </FormInput>
        <FormInput label="Phone">
          <Input required name="phone" type="text" placeholder="081xxxxxxxx" />
        </FormInput>
        <FormInput label="Bank">
          <Input
            required
            name="bank"
            type="text"
            placeholder="BCAa/n712xxxxxx"
          />
        </FormInput>
        <FormInput label="Street">
          <Input required name="street" type="text" placeholder="Taman Raya" />
        </FormInput>
        <FormInput label="City">
          <Input
            required
            name="city"
            type="text"
            placeholder="Jakarta Selatan"
          />
        </FormInput>
        <FormInput label="Province">
          <Input
            required
            name="province"
            type="text"
            placeholder="DKI Jakarta"
          />
        </FormInput>
        <FormInput label="Post Code">
          <Input required name="zip_code" type="text" placeholder="61xxx" />
        </FormInput>
        <FormInput label="Country">
          <Input required name="country" type="text" placeholder="Indonesia" />
        </FormInput>
        <FormInput label="Status">
          <Input required placeholder="Active" />
        </FormInput>
      </DialogContent>
    </Dialog>
  );
}
export default Index;
