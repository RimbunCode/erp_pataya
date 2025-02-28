/* eslint-disable jsdoc/require-jsdoc */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from "@/Components/ui/dialog";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import {
  FormPage,
  FormPageContent,
  FormPageContentTitle,
  FormPageSidebar,
} from "@/Pages/Core/FormPage";
import React, { useCallback, useMemo, useState } from "react";
import { SaveIcon, Trash2, UploadIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/Checkbox";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import UploadDialog from "@/Pages/Core/Components/UploadDialog";
import axios from "axios";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ supplier, suppliers, auth }) {
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, reset, isDirty } =
    useDraftForm("supplier", supplier);
  const route = window.route;
  const [openAttachment, setOpenAttachment] = useState(false);
  const [openDetailSupplier, setOpenDetailSupplier] = useState(false);
  const [detailsSupplier, setDetailsSupplier] = useState();
  const alias = supplier.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");
  const onSubmit = (e) => {
    e.preventDefault();

    put(route("supplier.update", supplier.id));
  };

  const getDetailsSupplier = useCallback((id) => {
    axios
      .get(route("suppliers.show", id))
      .then(({ data }) => {
        setDetailsSupplier(data);
        setOpenDetailSupplier(true);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  return (
    <>
      <FormPage
        disabled={processing}
        title={supplier.name}
        badge={
          isDirty && (
            <span className="text-sm badge warning">
              {t("core.form.not_saved")}
            </span>
          )
        }
        controls={
          <Button
            role="save"
            className="!p-2 size-fit h-8"
            onClick={onSubmit}
            disabled={processing}
          >
            <SaveIcon />
            {t("core.form.save")}
          </Button>
        }
      >
        <FormPageSidebar>
          {(defaultComp) => (
            <>
              <Dialog open={openAttachment} onOpenChange={setOpenAttachment}>
                <div className="absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button variant="default" size="icon">
                          <UploadIcon className="!size-5" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent align="center">Upload</TooltipContent>
                  </Tooltip>
                </div>
                <UploadDialog
                  open={openAttachment}
                  imageOnly
                  options={{
                    route: route(route().current(), route().params) + "/image",
                    reset: ["supplier", "auth"],
                  }}
                  onClose={() => {
                    setOpenAttachment(false);
                  }}
                />
              </Dialog>
              {defaultComp}
            </>
          )}
        </FormPageSidebar>
        <FormPageContent
          title={t("supplier.supplier.basic_info")}
          value="basic_info"
        >
          {/* <FormPageTitle>Test</FormPageTitle>
        <FormPageDescription>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Dolore,
          maiores.
        </FormPageDescription> */}
          <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
            <FormInput
              label={t("supplier.supplier.columns.name")}
              required={true}
            >
              <Input
                value={data.name}
                onChange={(e) => setData("name", e.target.value)}
              />
            </FormInput>
            <FormInput
              label={t("supplier.supplier.columns.email")}
              required={true}
            >
              <Input
                type="email"
                value={data.email}
                onChange={(e) => setData("email", e.target.value)}
              />
            </FormInput>
            <FormInput label={t("supplier.supplier.columns.gender")}>
              <Select
                value={data.gender}
                onValueChange={(val) => setData("gender", val)}
              >
                <SelectTrigger className="">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </FormInput>
            <FormInput label={t("supplier.supplier.columns.phone")}>
              <Input
                type="text"
                value={data.phone}
                onChange={(e) => setData("phone", e.target.value)}
              />
            </FormInput>
            <FormInput label={t("supplier.supplier.columns.birthdate")}>
              <DatetimePicker
                type="date"
                value={data.birthdate}
                onValueChange={(val) => setData("birthdate", val)}
              />
            </FormInput>
          </div>
        </FormPageContent>
        {auth.supplier.id != supplier.id && (
          <FormPageContent title={t("supplier.suppliers")} value="supplier">
            <FormPageContentTitle>
              {t("supplier.suppliers")}
            </FormPageContentTitle>
            <div className="columns-[15rem] gap-x-2 mt-2">
              {suppliers &&
                suppliers.map((supplier) => (
                  <div
                    className="flex items-center space-x-2"
                    key={supplier.id}
                  >
                    <Checkbox
                      id={supplier.id + "_Checkbox"}
                      disabled={supplier.is_disabled}
                      checked={data.suppliers.includes(supplier.id)}
                      onCheckedChange={(val) => {
                        if (val) {
                          setData("suppliers", [
                            ...data.suppliers,
                            supplier.id,
                          ]);
                        } else {
                          setData(
                            "suppliers",
                            data.suppliers.filter((x) => x !== supplier.id),
                          );
                        }
                      }}
                    />
                    <span
                      onClick={() => getDetailsSupplier(supplier.id)}
                      className="text-sm font-medium leading-none cursor-pointer hover:underline peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {supplier.name}
                    </span>
                  </div>
                ))}
            </div>
          </FormPageContent>
        )}
      </FormPage>
      <Dialog open={openDetailSupplier} onOpenChange={setOpenDetailSupplier}>
        <DialogContent className="max-w-screen-lg border-muted-foreground/25">
          <DialogHeader className="pb-2 border-b border-muted-foreground/25">
            <DialogTitle className="font-bold">
              {detailsSupplier && detailsSupplier.name}
            </DialogTitle>
            <DialogDescription className="sr-only"></DialogDescription>
          </DialogHeader>
          <div className="grid [&>div]:px-3 gap-x-1 grid-cols-[minmax(auto,1fr)_max-content_auto_repeat(12,max-content)] text-sm [&>div>*]:px-1h max-w-full w-full overflow-x-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center [&>div>*]:py-2 [&>div>*:not(:last-child)]:border-0">
            <div className="grid grid-cols-subgrid col-span-full items-center rounded-md bg-muted [&>div]:font-bold [&>div]:text-xs lg:[&>div]:text-sm">
              <div className="!pr-2 !pl-2 !justify-start text-left">Model</div>
              <div className="text-center">Level</div>
              <div className="text-center">If Owner</div>
              {[
                "select",
                "read",
                "write",
                "create",
                "delete",
                "submit",
                "cancel",
                "amend",
                "print",
                "import",
                "export",
                "share",
              ].map((x) => (
                <div key={x} className="text-center capitalize">
                  {x}
                </div>
              ))}
            </div>
            {detailsSupplier?.rules &&
              detailsSupplier.rules.map((rule) => (
                <div
                  key={rule.id}
                  className="grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-xs lg:[&>div]:text-sm"
                >
                  <div className="!pr-2 !justify-start text-left">
                    {rule.name}
                  </div>
                  <div className="text-center">{rule.level}</div>
                  <div className="text-center">{rule.if_owner ? "✓" : "-"}</div>
                  {[
                    "select",
                    "read",
                    "write",
                    "create",
                    "delete",
                    "submit",
                    "cancel",
                    "amend",
                    "print",
                    "import",
                    "export",
                    "share",
                  ].map((x) => (
                    <div key={x} className="text-center">
                      {rule.permissions[x] ? "✓" : "-"}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
