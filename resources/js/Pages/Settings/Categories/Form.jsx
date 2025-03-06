/* eslint-disable jsdoc/require-jsdoc */
import {
  FormPageContent,
  FormPageContentDescription,
  FormPageContentTitle,
} from "@/Pages/Core/FormPage";
import React, { useCallback, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

import { ArrowLeftRightIcon } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import Combobox from "@/Components/Combobox";
import { CommandItem } from "@/Components/ui/command";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import QueryString from "qs";
import axios from "axios";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Form({ data, setData }) {
  const { t } = useLaravelReactI18n();
  const types = usePage().props.types;

  return (
    <>
      <FormPageContent title={null} value="detail">
        <FormPageContentTitle></FormPageContentTitle>
        <div className="grid gap-x-3 gap-y-4">
          <FormInput required={true} label={t("core.category.columns.name")}>
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput required={true} label={t("core.category.columns.type")}>
            <Select value={data.type} onValueChange={(v) => setData("type", v)}>
              <SelectTrigger>
                <SelectValue
                  placeholder={t("core.category.columns.type.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {types &&
                  Object.entries(types).map(([key, type]) => (
                    <SelectItem key={key} value={key}>
                      {type}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
