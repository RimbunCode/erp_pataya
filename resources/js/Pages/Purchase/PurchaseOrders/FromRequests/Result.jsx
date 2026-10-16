import React from "react";
import { Head, Link } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import AppLayout from "@/Layouts/AppLayout";
import { Card, CardContent } from "@/Components/ui/card";

const translationPrefix = "purchase.purchaseOrder.from_requests.";

export default function Result({ purchaseOrders = [] }) {
  const { t } = useLaravelReactI18n();
  return (
    <AppLayout className="px-4 md:px-8">
      <Head title={t(`${translationPrefix}result_title`)} />
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">
            {t(`${translationPrefix}result_title`)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(`${translationPrefix}result_description`)}
          </p>
        </header>
        {purchaseOrders.map((order) => (
          <Card key={order.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link
                  href={order.url}
                  className="font-medium text-primary hover:underline"
                >
                  {order.code}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {order.supplier}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`${translationPrefix}item_count`)}: {order.items_count}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {t(`${translationPrefix}draft_status`)}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
