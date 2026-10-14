import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";
import { convertTemplateLink } from "@/lib/linkModelUtils";

function Index() {
  const route = window.route;
  return (
    <DataTable2
      form={<Form />}
      classNameDialog="max-w-(--breakpoint-lg)!"
      templateItem={({ dataRow }) => (
        <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
          <Link
            as="button"
            href={route("opportunities.show", dataRow.id)}
            className="min-w-0 text-left"
          >
            {/* templateLink() model (`:title`, bisa berisi tag <title>+konten
                lain ke depan) -- BUKAN cuma `dataRow.title` mentah, biar 1
                sumber kebenaran dgn tampilan link relasi lain (Table2.jsx
                desktop). `asObject=true` (bukan mode simple) supaya konten DI
                LUAR <title> ikut tampil, bukan cuma potongan title-nya. */}
            <p
              className="text-base font-medium truncate"
              dangerouslySetInnerHTML={{
                __html: convertTemplateLink(dataRow, "", true),
              }}
            />
            <p className="text-sm text-muted-foreground truncate">
              {dataRow.customer?.name}
            </p>
            <p className="text-sm text-muted-foreground capitalize">
              {dataRow.stage}
            </p>
          </Link>
        </div>
      )}
    />
  );
}
export default Index;
