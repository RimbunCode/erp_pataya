import { Edit2Icon, PrinterIcon } from "lucide-react";
import { Input, InputAddon, InputGroup } from "@/Components/ui/input";
import { Kbd, KbdGroup } from "@/Components/ui/kbd";
import React, { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectValue } from "@/Components/ui/select";
import { SelectItem, SelectTrigger } from "@radix-ui/react-select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import AppLayout from "@/Layouts/AppLayout";
import { Button } from "@/Components/ui/button";
import FormInput from "@/Components/FormInput";
import Handlebars from "handlebars";
import Link from "@/Components/Link";
import { convertTemplateLink } from "@/Components/LinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

function Print({ data, dataTableColumns, template }) {
  const route = window.route;
  const { t, loading } = useLaravelReactI18n();
  const { html, css } = useMemo(() => {
    const css =
      (template.css?.replace("body", "main") ?? "") +
      ".resize-divider{display:none;}";
    Handlebars.registerHelper("relation", function (payload) {
      return convertTemplateLink(payload);
    });
    Handlebars.registerHelper("trans", function (payload) {
      return t(payload.titleTrans);
    });
    Handlebars.registerHelper("each", function (context, options) {
      var ret = "";

      for (var i = 0, j = context.length; i < j; i++) {
        context[i].idx = i + 1;
        ret = ret + options.fn(context[i]);
      }

      return ret;
    });
    Handlebars.registerHelper("infoColumns", function (context, options) {
      const oriKey = options.hash.key;
      const splitKey = oriKey.split(".");

      let data = context;

      for (let key of splitKey) {
        const temp = data?.filter((x) => x.name == key)[0]?.columns;
        if (temp) {
          data = temp;
        }
      }
      data = data.reduce(
        (a, b) => ({
          ...a,
          [b.name]: options.hash.extract ? b[options.hash.extract] : b,
        }),
        {},
      );
      return options.fn(data);
    });

    return {
      html: Handlebars.compile(
        "{{#with data}}" + (template?.html ?? "") + "{{/with}}",
      )({
        dataTableColumns,
        data,
      }),
      css,
    };
  }, [template, data, t]);

  // useEffect(() => {
  //   if (loading) return;
  //   const timer = setTimeout(() => {
  //     window.print();
  //   }, 500);

  //   return () => {
  //     clearTimeout(timer);
  //   };
  // }, [loading]);

  // const getInstalledFonts = async () => {
  //   if ("queryLocalFonts" in window) {
  //     try {
  //       const availableFonts = await window.queryLocalFonts();
  //       for (const fontData of availableFonts) {
  //         console.log(fontData);
  //       }
  //     } catch (err) {
  //       console.error(err.name, err.message);
  //     }
  //   }
  // };
  // useEffect(() => {
  //   getInstalledFonts();
  // }, []);

  return (
    <AppLayout className="print:p-0!">
      <div className="flex items-center border-b justify-between py-2 mb-4">
        <h3 className="text-lg font-bold">{t("core.form.print_preview")}</h3>
        <div className="flex items-center gap-x-4">
          <Button variant="outline" asChild>
            <Link href={route("printTemplates.editor", template.id)}>
              <Edit2Icon />
              {t("core.form.edit_template")}
            </Link>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                className="p-2! size-fit h-8"
                onClick={() => window.print()}
              >
                <PrinterIcon />
                {t("core.form.print")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-2">
                Print Document
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <span>+</span>
                  <Kbd>P</Kbd>
                </KbdGroup>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="h-full flex">
        <div className="border-r mr-4 grid gap-4 px-4 ">
          <FormInput required>
            <InputGroup>
              <Input placeholder="Search" />
            </InputGroup>
          </FormInput>
        </div>
        <div className="flex-1 max-w-3xl mx-auto **:cursor-default border rounded-lg bg-white! h-full text-black! p-8 print:p-0! w-full print:bg-white">
          <style
            dangerouslySetInnerHTML={{
              __html: css,
            }}
          />
          <header />
          <main
            className="print:visible! print:absolute print:top-0 print:left-0 main w-full"
            dangerouslySetInnerHTML={{
              __html: html,
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default Print;
