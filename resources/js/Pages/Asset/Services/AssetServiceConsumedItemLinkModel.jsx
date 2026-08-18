import LinkModel from "@/Components/LinkModel";
import { forwardRef } from "react";

export default forwardRef(function AssetServiceConsumedItemLinkModel(
  { value, onValueChange, placeholder, ...props },
  ref,
) {
  return (
    <LinkModel
      placeholder={placeholder}
      value={value}
      onValueChange={onValueChange}
      model="App\Models\Asset\AssetServiceConsumedItem"
      as="item:item.item_id"
      canNavigation="App\Models\Inventory\Item"
      disabledAddButton={true}
      filters={{ "assetService.status": { jsonContains: ["approved"] } }}
      {...props}
      ref={ref}
    />
  );
});
