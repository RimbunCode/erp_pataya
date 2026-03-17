import InputBarcode from "@/Components/InputBarcode";
import { forwardRef } from "react";

export default forwardRef(function ItemBarcode(
  { placeholder, onSuccess, ...props },
  ref,
) {
  return (
    <InputBarcode
      placeholder={placeholder}
      onSuccess={onSuccess}
      keywords={["barcode"]}
      model="App\Models\Inventory\ItemBarcode"
      {...props}
      ref={ref}
    />
  );
});
