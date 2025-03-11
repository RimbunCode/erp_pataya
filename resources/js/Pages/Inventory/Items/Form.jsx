import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
/* eslint-disable jsdoc/require-jsdoc */
import { FormPageContent } from "@/Pages/Core/FormPage";
import { Input } from "@/Components/ui/input";
import React from "react";
import { Textarea } from "@/Components/ui/textarea";
import { Trash2Icon } from "lucide-react";
import { isNullOrWhitespace } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form({ data, setData }) {
  const { t } = useLaravelReactI18n();

  const onUpdateValues = (list) => {
    setData(
      "values",
      [...new Set(list.filter((x) => !isNullOrWhitespace(x)))].sort((a, b) =>
        a > b ? 1 : -1,
      ),
    );
  };
  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4 lg:grid-cols-3">
          <FormInput
            required={true}
            label={t("inventory.attribute.columns.name")}
            className="col-span-full"
          >
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("inventory.attribute.columns.description")}
            className="col-span-full"
          >
            <Textarea
              value={data.description}
              onChange={(e) => setData("description", e.target.value)}
            />
          </FormInput>
          <div className="flex items-center space-x-2 col-span-full">
            <Checkbox
              id={"is_numeric-checkbox"}
              checked={data.is_numeric ?? false}
              onCheckedChange={(val) => {
                setData("is_numeric", val);
              }}
            />
            <label
              htmlFor={name + "-checkbox"}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {t("inventory.attribute.columns.is_numeric")}
            </label>
          </div>
          {!data.is_numeric ? (
            <FormInput
              label={t("inventory.attribute.columns.values")}
              className="col-span-full"
            >
              <div className="grid [&>div]:px-3 gap-x-4 grid-cols-[auto_1fr_auto] text-sm [&>div>*]:px-1h max-w-full w-full overflow-x-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center [&>div>*]:py-2 [&>div>*:not(:last-child)]:border-0">
                <div className="grid grid-cols-subgrid col-span-full items-center rounded-md bg-muted [&>div]:font-bold [&>div]:text-sm lg:[&>div]:text-base">
                  <div className="!pr-2 !pl-2 !justify-start text-left">
                    No.
                  </div>
                  <div className="!justify-start text-left">Value</div>
                  <div className="text-center"></div>
                </div>
                {data?.values &&
                  data?.values.map((item, index) => {
                    return (
                      <div
                        key={item}
                        className="grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base"
                      >
                        <div className="!pr-2 !pl-2 !justify-center text-left">
                          {index + 1}
                        </div>
                        <div className="!justify-start text-left">
                          <Input
                            defaultValue={item}
                            onBlur={(e) => {
                              const index = data.values?.findIndex(
                                (x) => x == item,
                              );
                              const options = data.values;
                              options[index] = e.target.value
                                ? e.target.value
                                : null;
                              onUpdateValues(options);
                            }}
                          />
                        </div>
                        <div className="text-center">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="size-8"
                            onClick={() =>
                              setData(
                                "values",
                                data.values?.filter((x) => x != item),
                              )
                            }
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                <div className="grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-sm lg:[&>div]:text-base">
                  <div className="!pr-2 !pl-2 !justify-center text-left">
                    {(data.values?.length ?? 0) + 1}
                  </div>
                  <div className="!justify-start text-left">
                    <Input
                      onBlur={(e) => {
                        if (!e.target.value) return;
                        onUpdateValues([
                          ...(data.values ?? []),
                          e.target.value,
                        ]);
                        e.target.value = null;
                        e.target.focus();
                      }}
                    />
                  </div>
                  <div className="text-center"></div>
                </div>
              </div>
            </FormInput>
          ) : (
            <>
              <FormInput
                required={true}
                label={t("inventory.attribute.columns.range.from")}
              >
                <Input
                  type="number"
                  value={data.from_range ?? 0}
                  onChange={(e) => setData("from_range", e.target.value)}
                />
              </FormInput>
              <FormInput
                required={true}
                label={t("inventory.attribute.columns.range.to")}
              >
                <Input
                  type="number"
                  value={data.to_range ?? 0}
                  onChange={(e) => setData("to_range", e.target.value)}
                />
              </FormInput>
              <FormInput
                required={true}
                label={t("inventory.attribute.columns.range.increment")}
              >
                <Input
                  type="number"
                  min="0"
                  value={data.increment ?? 0}
                  onChange={(e) => setData("increment", e.target.value)}
                />
              </FormInput>
            </>
          )}
        </div>
      </FormPageContent>
    </>
  );
}
