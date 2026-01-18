import { Button } from "@/Components/ui/button";
import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import Link from "@/Components/Link";
import { Trash2Icon } from "lucide-react";
import useDeleteModal from "@/Hooks/useDeleteModal";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Index() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { deleteItem } = useDeleteModal();
  return (
    <DataTable2
      templateItem={({ dataRow }) => (
        <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
          <Link
            as="button"
            href={route("categories.show", dataRow.id)}
            className=""
          >
            <p className="text-base font-medium text-left text-muted-foreground">
              {t(`inventory.category.types.${dataRow.type}`)}
            </p>
            <p className="text-base font-medium text-left">{dataRow.name}</p>
          </Link>

          <Button
            variant="destructive"
            size="icon"
            className="size-8"
            onClick={() => deleteItem("categories.destroy", dataRow.id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
      classNameDialog="max-w-xl!"
      form={<Form />}
    />
  );
}
