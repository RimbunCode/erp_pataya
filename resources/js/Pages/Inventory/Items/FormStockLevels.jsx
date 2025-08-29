import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { WhenVisible, usePage } from "@inertiajs/react";
import { memo, useEffect, useState } from "react";

import { FormPageContent } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function FormStockLevels() {
  const route = window.route;
  const stocks = usePage().props.stocks;
  const [maxStocksActual, setMaxStocksActual] = useState(0);
  const [maxReservedStock, setMaxReservedStock] = useState(0);
  const { t } = useLaravelReactI18n();
  useEffect(() => {
    setMaxStocksActual(
      stocks?.reduce((acc, stock) => acc + stock.actual_stock, 0) ?? 0,
    );
    setMaxReservedStock(
      stocks?.reduce((acc, stock) => acc + stock.reserved_stock, 0) ?? 0,
    );
  }, [stocks]);
  return (
    <>
      {stocks && (
        <FormPageContent
          title={t("inventory.item.menu.stock_levels")}
          value="stock_levels"
        >
          <WhenVisible data={["stocks"]}>
            <div className="grid text-sm grid-cols-[3fr_1fr_1fr_auto] [&>*]:px-4 ">
              {stocks?.map((stock) => (
                <div
                  key={stock.id}
                  className="grid py-2 border-b border-muted-foreground/25 grid-cols-subgrid col-span-full"
                >
                  <Link
                    className="mr-6 hover:underline"
                    href={route("warehouses.show", {
                      warehouse: stock.id,
                    })}
                  >
                    {stock.name} - {stock.branch?.name}
                  </Link>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="pr-0.5 flex flex-col items-end justify-center border-r border-muted-foreground/25 ">
                        <span className="px-1 text-xs">
                          {stock.reserved_stock}
                        </span>
                        <span
                          className={cn(
                            "rounded-l-full h-1.5 ",
                            stock.reserved_stock == 0
                              ? "bg-muted"
                              : "bg-foreground",
                          )}
                          style={{
                            width:
                              stock.reserved_stock == 0
                                ? "15%"
                                : maxReservedStock === stock.reserved_stock
                                  ? "100%"
                                  : `${(stock.reserved_stock / maxReservedStock) * 100}%`,
                          }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent align="end">
                      Reserved Stock: {stock.reserved_stock}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="pl-0.5 flex flex-col items-start justify-center">
                        <span className="px-1 text-xs">
                          {stock.actual_stock}
                        </span>
                        <span
                          className={cn(
                            "rounded-r-full h-1.5 ",
                            stock.actual_stock == 0
                              ? "bg-muted"
                              : "bg-foreground",
                          )}
                          style={{
                            width:
                              stock.actual_stock == 0
                                ? "15%"
                                : maxStocksActual === stock.actual_stock
                                  ? "100%"
                                  : `${(stock.actual_stock / maxStocksActual) * 100}%`,
                          }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent align="start">
                      Actual Stock: {stock.actual_stock}
                    </TooltipContent>
                  </Tooltip>
                  <span className="px-2 ml-6 text-center">
                    {stock.total_stock}
                  </span>
                </div>
              ))}
            </div>
          </WhenVisible>
        </FormPageContent>
      )}
    </>
  );
});
