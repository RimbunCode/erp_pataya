import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { WhenVisible, usePage } from "@inertiajs/react";
import { memo, useMemo } from "react";

import { FormPageContent } from "@/Pages/Core/FormPage";
import Link from "@/Components/Link";
import LoadingIcon from "@/Components/LoadingIcon";
import { cn } from "@/lib/utils";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function FormStockLevels() {
  const route = window.route;
  const stocks = usePage().props.stocks;
  const { t } = useLaravelReactI18n();

  const maxStocks = useMemo(() => {
    return (
      stocks?.reduce((acc, stock) => {
        const rightQty =
          stock.actual_quantity +
          stock.incoming_quantity +
          stock.rented_quantity;
        const leftQty = stock.reserved_quantity;

        return Math.max(acc, rightQty, leftQty);
      }, 0) ?? 0
    );
  }, [stocks]);

  return (
    <>
      {stocks && (
        <FormPageContent
          title={t("inventory.item.menu.stock_levels")}
          value="stock_levels"
        >
          <WhenVisible
            data={["stocks"]}
            fallback={() => (
              <div className="flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4">
                <LoadingIcon className="size-4" />
                <span>{t("core.form.loading")} ...</span>
              </div>
            )}
          >
            <div className="grid text-sm  *:px-4 ">
              <div className="[&_p]:text-sm [&_p]:font-normal [&_p]:text-foreground pb-2 mb-2 border-b border-muted-foreground/25 col-span-full flex flex-wrap justify-between gap-4">
                <p>
                  <span className="inline-block size-2 mr-2 rounded-full bg-blue-500 dark:bg-blue-600" />
                  {t("inventory.stock.columns.actual_quantity")}
                </p>
                <p>
                  <span className="inline-block size-2 mr-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                  {t("inventory.stock.columns.incoming_quantity")}
                </p>
                <p>
                  <span className="inline-block size-2 mr-2 rounded-full bg-green-500 dark:bg-green-600" />
                  {t("inventory.stock.columns.rented_quantity")}
                </p>
                <p>
                  <span className="inline-block size-2 mr-2 rounded-full bg-yellow-500 dark:bg-yellow-700" />
                  {t("inventory.stock.columns.reserved_quantity")}
                </p>
              </div>
              {stocks?.map((stock) => {
                const maxStock =
                  stock.actual_quantity +
                  stock.incoming_quantity +
                  stock.rented_quantity;
                return (
                  <div
                    key={stock.id}
                    className="grid items-center py-2 border-b border-muted-foreground/25 grid-cols-2 gap-x-4 col-span-full"
                  >
                    <Link
                      className="mr-6 hover:underline"
                      href={route("warehouses.show", {
                        warehouse: stock.id,
                      })}
                    >
                      {convertTemplateLink(stock)}
                    </Link>
                    <Tooltip>
                      <TooltipTrigger className="grid grid-cols-2">
                        <div className="pr-0.5 flex flex-col items-end justify-center relative border-r border-muted-foreground/25 ">
                          <span className="px-1 text-xs">
                            {stock.reserved_quantity}
                          </span>
                          <span
                            className={cn(
                              "relative h-2 rounded-l-full bg-muted w-full",
                            )}
                          />
                          <span
                            className={cn(
                              "absolute bottom-0 rounded-l-full h-2 bg-yellow-500 dark:bg-yellow-700",
                            )}
                            style={{
                              width: `${(stock.reserved_quantity / (maxStocks || 1)) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="pl-0.5 flex flex-col items-start justify-center relative">
                          <span className="px-1 text-xs">{maxStock}</span>
                          <span
                            className={cn(
                              "relative h-2 rounded-r-full bg-muted w-full",
                            )}
                          />
                          <span
                            className={cn(
                              "absolute bottom-0 h-2 rounded-r-full bg-gray-400 dark:bg-gray-500",
                            )}
                            style={{
                              width: `${(maxStock / (maxStocks || 1)) * 100}%`,
                            }}
                          />
                          <span
                            className={cn(
                              "absolute bottom-0 h-2 bg-green-500 dark:bg-green-600",
                              stock.incoming_quantity === 0 && "rounded-r-full",
                            )}
                            style={{
                              width: `${((stock.actual_quantity + stock.rented_quantity) / (maxStocks || 1)) * 100}%`,
                            }}
                          />
                          <span
                            className={cn(
                              "absolute bottom-0 h-2 bg-blue-500 dark:bg-blue-600",
                              stock.actual_quantity >= maxStock &&
                                "rounded-r-full",
                            )}
                            style={{
                              width: `${(stock.actual_quantity / (maxStocks || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        align="center"
                        className="grid grid-cols-[auto_1fr] gap-x-2 [&_p]:text-sm [&_p]:font-normal [&_p]:text-foreground"
                      >
                        <p>
                          <span className="inline-block size-2 mr-2 rounded-full bg-blue-500 dark:bg-blue-600" />
                          {t("inventory.stock.columns.actual_quantity")}
                        </p>
                        <p>: {stock.actual_quantity}</p>
                        <p>
                          <span className="inline-block size-2 mr-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                          {t("inventory.stock.columns.incoming_quantity")}
                        </p>
                        <p>: {stock.incoming_quantity}</p>
                        <p>
                          <span className="inline-block size-2 mr-2 rounded-full bg-green-500 dark:bg-green-600" />
                          {t("inventory.stock.columns.rented_quantity")}
                        </p>
                        <p>: {stock.rented_quantity}</p>
                        <p>
                          <span className="inline-block size-2 mr-2 rounded-full bg-yellow-500 dark:bg-yellow-700" />
                          {t("inventory.stock.columns.reserved_quantity")}
                        </p>
                        <p>: {stock.reserved_quantity}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </WhenVisible>
        </FormPageContent>
      )}
    </>
  );
});
