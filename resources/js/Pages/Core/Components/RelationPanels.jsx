import { Deferred, usePage } from "@inertiajs/react";

import RelationPanel from "./RelationPanel";
import { Skeleton } from "@/Components/ui/skeleton";
import { FormPageContent } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

function RelationPanelsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * Tab "Relasi" di halaman dokumen. Panel dimuat lewat deferred prop
 * `relationPanels`, jadi halaman tampil dulu dan skeleton tampil sementara.
 * @returns {JSX.Element}
 */
export default function RelationPanels() {
  const { t } = useLaravelReactI18n();
  const relationPanels = usePage().props.relationPanels ?? [];

  return (
    <FormPageContent value="relations" title={t("core.form.relations")}>
      <Deferred data={["relationPanels"]} fallback={<RelationPanelsSkeleton />}>
        <div className="space-y-4">
          {relationPanels.map((panel) => (
            <RelationPanel key={panel.reference_type} panel={panel} />
          ))}
        </div>
      </Deferred>
    </FormPageContent>
  );
}
