import "grapesjs/dist/css/grapes.min.css";

import GjsEditor, { Canvas, WithEditor } from "@grapesjs/react";
import React, { useCallback, useEffect, useState } from "react";

import AppLayout from "@/Layouts/AppLayout";
import { Head } from "@inertiajs/react";
import Sidebar from "./Components/Sidebar";
import TopBar from "./Components/TopBar";
import { generateRandom } from "@/lib/utils";
import gjsBlockBasic from "grapesjs-blocks-basic";
import gjsDocHeader from "@/lib/gjsDocHeader";
import gjsRelationsTable from "@/lib/gjsRelationsTable";
import gjsTable from "@/lib/gjsTable";
import grapesjs from "grapesjs";

function PrintTemplate({ printTemplate, csrfToken, dataTableColumns }) {
  const [editor, setEditor] = useState();
  const onEditor = useCallback((editor) => {
    setEditor(editor);
    // editor?.Modal.open({
    //   title: "My title", // string | HTMLElement
    //   content: "My content", // string | HTMLElement
    // });
    console.log(editor);
  }, []);

  useEffect(() => {
    console.log(dataTableColumns);
  }, [editor, dataTableColumns]);

  return (
    <AppLayout>
      <Head title={`${printTemplate.title} - Print Template`} />
      <GjsEditor
        // Pass the core GrapesJS library to the wrapper (required).
        // You can also pass the CDN url (eg. "https://unpkg.com/grapesjs")
        grapesjs={grapesjs}
        options={{
          telemetry: false,
          undoManager: { trackSelection: false },
          deviceManager: {
            devices: [
              {
                id: "a4",
                name: "A4",
                width: "770px",
              },
              {
                id: "f4",
                name: "F4",
                width: "770px",
              },
            ],
          },
          storageManager: {
            type: "remote",
            // ...
            stepsBeforeSave: 1,
            autosave: true,
            options: {
              remote: {
                headers: {
                  "X-CSRF-TOKEN": csrfToken,
                  "X-Requested-With": "XMLHttpRequest",
                  Accept: "application/json",
                  "Content-Type": "application/json",
                }, // Custom headers for the remote storage request
                urlStore: `https://erp.test/settings/printTemplates/`, // Endpoint URL where to store data project
                urlLoad: `https://erp.test/settings/printTemplates/${printTemplate.id}`, // Endpoint URL where to load data project
              },
            },
            onStore: (data, editor) => {
              const pagesHtml = editor.Pages.getAll().map((page) => {
                const component = page.getMainComponent();
                return {
                  html: editor.getHtml({ component }),
                  css: editor.getCss({ component }),
                };
              });
              return {
                id: printTemplate.id,
                idSaved: generateRandom(8),
                data,
                pagesHtml,
              };
            },
          },
        }}
        plugins={[
          gjsTable,
          gjsDocHeader,
          (editor) =>
            gjsBlockBasic(editor, {
              blocks: [
                "column1",
                "column2",
                "column3",
                "column3-7",
                "text",
                "link",
                "image",
                "map",
              ],
            }),
          (editor) => gjsRelationsTable(editor),
        ]}
        onEditor={onEditor}
      >
        <div className="grid grid-cols-[1fr_minmax(max-content,256px)] h-full w-full">
          <div className="flex flex-col h-full w-full flex-grow gap-y-2">
            <WithEditor>
              <TopBar />
            </WithEditor>
            <div className="border border-dotted flex-grow flex overflow-auto w-full">
              <Canvas className="flex-grow h-full w-full max-w-full" />
            </div>
          </div>
          <div className="h-full">
            <WithEditor>
              <Sidebar />
            </WithEditor>
          </div>
        </div>
      </GjsEditor>
    </AppLayout>
  );
}

export default PrintTemplate;
