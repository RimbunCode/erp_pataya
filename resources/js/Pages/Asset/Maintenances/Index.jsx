import DataTable2 from "@/Pages/Core/DataTable2";
import Link from "@/Components/Link";

export default function Index() {
  const route = window.route;
  return (
    <DataTable2
      templateItem={({ dataRow }) => (
        <div className="flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25">
          <Link
            as="button"
            href={route("assetMaintenances.show", dataRow.id)}
            className=""
          >
            <p className="text-base font-medium text-left">
              {dataRow.asset?.asset_name}
            </p>
            <p className="text-sm text-left text-muted-foreground">
              {dataRow.maintenanceTeam?.team_name}
            </p>
          </Link>
        </div>
      )}
    />
  );
}
