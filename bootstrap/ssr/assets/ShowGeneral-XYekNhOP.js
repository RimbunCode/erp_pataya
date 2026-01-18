import { jsx, jsxs } from "react/jsx-runtime";
import React__default, { useMemo, Suspense } from "react";
import { h as FormPage } from "./checkbox-C_BEU5E4.js";
import { L as LoadingIcon } from "./LoadingIcon-CRleOEtX.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-checkbox";
import "lucide-react";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "./use-mobile-BsFue-bT.js";
import "@inertiajs/react";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "./input-wk3Ou7wI.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "axios";
import "pluralize";
import "react-detect-click-outside";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./Select-DB9toH_t.js";
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@date-fns/tz";
import "date-fns";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
function ShowGeneral({ name, title, formPathname, settings }) {
  const { t } = useLaravelReactI18n();
  const FormComponent = useMemo(() => {
    let modules = /* @__PURE__ */ Object.assign({ "./Auth/ConfirmPassword.jsx": () => import("./ConfirmPassword-eOiFVLEM.js"), "./Auth/ForgotPassword.jsx": () => import("./ForgotPassword-Cijrosci.js"), "./Auth/Login.jsx": () => import("./Login-CntkkxTi.js"), "./Auth/Register.jsx": () => import("./Register-CJDI3Cis.js"), "./Auth/ResetPassword.jsx": () => import("./ResetPassword-w-Wyc0ar.js"), "./Auth/VerifyEmail.jsx": () => import("./VerifyEmail-DTBpPTd_.js"), "./Core/ApprovalInstanceIndex.jsx": () => import("./ApprovalInstanceIndex-nze_LDyS.js"), "./Core/Components/ApproverDecision.jsx": () => import("./checkbox-C_BEU5E4.js").then((n) => n.m), "./Core/Components/Attachments.jsx": () => import("./checkbox-C_BEU5E4.js").then((n) => n.s), "./Core/Components/Comments.jsx": () => import("./Comments-Bvo3255G.js"), "./Core/Components/FileItem.jsx": () => import("./checkbox-C_BEU5E4.js").then((n) => n.n), "./Core/Components/Library/FileItems.jsx": () => import("./checkbox-C_BEU5E4.js").then((n) => n.o), "./Core/Components/Library/FolderItem.jsx": () => import("./checkbox-C_BEU5E4.js").then((n) => n.p), "./Core/Components/Library/Library.jsx": () => import("./checkbox-C_BEU5E4.js").then((n) => n.q), "./Core/Components/PrintPreview.jsx": () => import("./PrintPreview-CrLWtfMZ.js"), "./Core/Components/Tags.jsx": () => import("./Tags-D6pM3ZUY.js"), "./Core/Components/UploadDialog.jsx": () => import("./checkbox-C_BEU5E4.js").then((n) => n.r), "./Core/CountryLinkModel.jsx": () => import("./CountryLinkModel-sHdBSxco.js"), "./Core/CurrencyLinkModel.jsx": () => import("./CurrencyLinkModel-u95oYPuj.js"), "./Core/DataTable.jsx": () => import("./DataTable-CVa4LVcS.js"), "./Core/DataTable2.jsx": () => import("./DataTable2-sz-ATj9o.js"), "./Core/FormPage.jsx": () => import("./checkbox-C_BEU5E4.js").then((n) => n.t), "./Core/Language/Index.jsx": () => import("./Index-ERDktazT.js"), "./Core/PermissionLinkModel.jsx": () => import("./PermissionLinkModel-Cy7R6yf4.js"), "./Core/Print.jsx": () => import("./Print-DqpdgELw.js"), "./Core/PrintTemplate/Components/CustomBlockManager.jsx": () => import("./CustomBlockManager-3I5p96C9.js"), "./Core/PrintTemplate/Components/CustomLayerManager.jsx": () => import("./CustomLayerManager-Dizp7WF_.js"), "./Core/PrintTemplate/Components/CustomSelectorManager.jsx": () => import("./CustomSelectorManager-BAFKZpmP.js"), "./Core/PrintTemplate/Components/CustomStyleManager.jsx": () => import("./CustomStyleManager-BKIr7GqM.js"), "./Core/PrintTemplate/Components/Inspector/RelationsInspector.jsx": () => import("./RelationsInspector-lmhuIleU.js"), "./Core/PrintTemplate/Components/LayerItem.jsx": () => import("./LayerItem-D8wdUPwX.js"), "./Core/PrintTemplate/Components/Sidebar.jsx": () => import("./Sidebar-BUGFY30J.js"), "./Core/PrintTemplate/Components/StylePropertyField.jsx": () => import("./StylePropertyField-D6MlQOpI.js"), "./Core/PrintTemplate/Components/TopBar.jsx": () => import("./TopBar-Bgl8cg6L.js"), "./Core/PrintTemplate/Components/TraitPropertyField.jsx": () => import("./TraitPropertyField-COelML5t.js"), "./Core/PrintTemplate/Editor.jsx": () => import("./Editor-DJr8WC1h.js"), "./Core/PrintTemplate/Form.jsx": () => import("./Form-iKX2FHPC.js"), "./Core/PrintTemplate/Index.jsx": () => import("./Index-DPJlV_uX.js"), "./Core/PrintTemplate/Show.jsx": () => import("./Show-qDg7Fzab.js"), "./Core/ShowLog.jsx": () => import("./ShowLog-Cneu6xAV.js"), "./Dashboard.jsx": () => import("./Dashboard-7OKdzrB4.js"), "./Finances/Accounts/AccountLinkModel.jsx": () => import("./AccountLinkModel-DI4EpSiA.js").then((n) => n.b), "./Finances/Accounts/Form.jsx": () => import("./AccountLinkModel-DI4EpSiA.js").then((n) => n.a), "./Finances/Accounts/Index.jsx": () => import("./Index-CU2-Rm93.js"), "./Finances/Accounts/Show.jsx": () => import("./Show-BDY6P0_D.js"), "./Finances/Components/PaymentSchedule.jsx": () => import("./PaymentSchedule-Bj4FhgiV.js"), "./Finances/GeneralLedger.jsx": () => import("./GeneralLedger-DleiDj7Z.js"), "./Finances/PaymentEntries/Form.jsx": () => import("./Form-TRZzA-uq.js"), "./Finances/PaymentEntries/Index.jsx": () => import("./Index-UxHG7cpO.js"), "./Finances/PaymentEntries/Show.jsx": () => import("./Show-DBQjdmBF.js"), "./Finances/PaymentMethods/Form.jsx": () => import("./Form-DLossNJm.js"), "./Finances/PaymentMethods/Index.jsx": () => import("./Index-i7juCwpZ.js"), "./Finances/PaymentMethods/PaymentMethodLinkModel.jsx": () => import("./PaymentMethodLinkModel-kqgzg9-Y.js"), "./Finances/PaymentTerms/Form.jsx": () => import("./Form-DVznZ4Aa.js"), "./Finances/PaymentTerms/Index.jsx": () => import("./Index-uu9VmjWr.js"), "./Finances/PaymentTerms/PaymentTermLinkModel.jsx": () => import("./PaymentTermLinkModel-DeW-CCNL.js"), "./Finances/PurchaseInvoice/Form.jsx": () => import("./Form-DwcvKu1_.js"), "./Finances/PurchaseInvoice/Index.jsx": () => import("./Index-BguAwTXk.js"), "./Finances/PurchaseInvoice/Show.jsx": () => import("./Show-CQ8jF6t7.js"), "./Finances/SalesInvoice/Form.jsx": () => import("./Form-C1sMfj0M.js"), "./Finances/SalesInvoice/Index.jsx": () => import("./Index-Dqt4PzIu.js"), "./Finances/SalesInvoice/Show.jsx": () => import("./Show-fkn50nLU.js"), "./Finances/Taxes/Form.jsx": () => import("./Form-DIGwfk9N.js"), "./Finances/Taxes/Index.jsx": () => import("./Index-7QkNt6zH.js"), "./Finances/Taxes/TaxLinkModel.jsx": () => import("./TaxLinkModel-DN-T_7Az.js"), "./Inventory/Attributes/AttributeLinkModel.jsx": () => import("./AttributeLinkModel-ED6Z3erq.js"), "./Inventory/Attributes/Form.jsx": () => import("./Form-Cvx0UpcU.js"), "./Inventory/Attributes/Index.jsx": () => import("./Index-DEA-CC7c.js"), "./Inventory/Categories/CategoryLinkModel.jsx": () => import("./CategoryLinkModel-BHkXUdr5.js"), "./Inventory/Categories/Form.jsx": () => import("./Form-CjyI6LgW.js"), "./Inventory/Categories/Index.jsx": () => import("./Index-D9CRSNK8.js"), "./Inventory/DeliveryNotes/DeliveryNoteLinkModel.jsx": () => import("./DeliveryNoteLinkModel-De2hL7n7.js"), "./Inventory/DeliveryNotes/Form.jsx": () => import("./Form-Cs7GUWkn.js"), "./Inventory/DeliveryNotes/Index.jsx": () => import("./Index-Cmdka3Te.js"), "./Inventory/DeliveryNotes/Show.jsx": () => import("./Show-Di1dgW13.js"), "./Inventory/ItemAlternatives/Form.jsx": () => import("./Form-Dqr6B9s9.js"), "./Inventory/ItemAlternatives/Index.jsx": () => import("./Index-th8ukQzv.js"), "./Inventory/Items/Form.jsx": () => import("./Form-a_UJAbx0.js"), "./Inventory/Items/FormBarcodes.jsx": () => import("./FormBarcodes-BWe8Q1fd.js"), "./Inventory/Items/FormDetail.jsx": () => import("./FormDetail-Qe3HBKif.js"), "./Inventory/Items/FormStockLevels.jsx": () => import("./FormStockLevels-Dn2rbyo9.js"), "./Inventory/Items/FormVariant.jsx": () => import("./FormVariant-CIDe_heX.js"), "./Inventory/Items/Index.jsx": () => import("./Index-FUW1Il05.js"), "./Inventory/Items/ItemLinkModel.jsx": () => import("./ItemLinkModel-D57ec-3q.js"), "./Inventory/Items/ItemVariantLinkModel.jsx": () => import("./ItemVariantLinkModel-bx0YsOm5.js"), "./Inventory/Items/Show.jsx": () => import("./Show-B4ucTLaH.js"), "./Inventory/Items/ShowVariant.jsx": () => import("./ShowVariant-PWOTkUfu.js"), "./Inventory/StockEntries/CategoryLinkModel.jsx": () => import("./CategoryLinkModel-D_8p07H-.js"), "./Inventory/StockEntries/Form.jsx": () => import("./Form-H-O7EOc8.js"), "./Inventory/StockEntries/Index.jsx": () => import("./Index-oNbE1EX0.js"), "./Inventory/StockEntries/Show.jsx": () => import("./Show-C0iJYtf8.js"), "./Inventory/Units/Form.jsx": () => import("./Form-C_ygZCFM.js"), "./Inventory/Units/Index.jsx": () => import("./Index-EIHJN6y_.js"), "./Inventory/Units/UnitLinkModel.jsx": () => import("./UnitLinkModel-2m6CkvAO.js"), "./Inventory/Warehouses/Form.jsx": () => import("./Form-BsjjUTga.js"), "./Inventory/Warehouses/Index.jsx": () => import("./Index-ChZQ4PIl.js"), "./Inventory/Warehouses/WarehouseLinkModel.jsx": () => import("./WarehouseLinkModel-CvfxArBc.js"), "./Profile/Edit.jsx": () => import("./Edit-DuHF6n6J.js"), "./Profile/Partials/DeleteUserForm.jsx": () => import("./DeleteUserForm-C2xz5y5d.js"), "./Profile/Partials/UpdatePasswordForm.jsx": () => import("./UpdatePasswordForm-CCkdWPty.js"), "./Profile/Partials/UpdateProfileInformationForm.jsx": () => import("./UpdateProfileInformationForm-DKEBov81.js"), "./Purchase/PurchaseOrders/Form.jsx": () => import("./Form-V5XwpDQA.js"), "./Purchase/PurchaseOrders/Index.jsx": () => import("./Index-DCVbslIu.js"), "./Purchase/PurchaseOrders/ItemForm.jsx": () => import("./ItemForm-DY08yeJA.js"), "./Purchase/PurchaseOrders/PurchaseOrderLinkModel.jsx": () => import("./PurchaseOrderLinkModel-O-uRbF1B.js"), "./Purchase/PurchaseOrders/Show.jsx": () => import("./Show-Ct7ldFgJ.js"), "./Purchase/PurchaseReceipts/Form.jsx": () => import("./Form-CBsvsMDW.js"), "./Purchase/PurchaseReceipts/Index.jsx": () => import("./Index-CdCV1VuX.js"), "./Purchase/PurchaseReceipts/ItemForm.jsx": () => import("./ItemForm-e6Hygw4w.js"), "./Purchase/PurchaseReceipts/Show.jsx": () => import("./Show-BOszkKg5.js"), "./Purchase/PurchaseRequests/Form.jsx": () => import("./Form-C7OKxHlW.js"), "./Purchase/PurchaseRequests/Index.jsx": () => import("./Index-BSJiWfsX.js"), "./Purchase/PurchaseRequests/ItemForm.jsx": () => import("./ItemForm-DsSy_Yev.js"), "./Purchase/PurchaseRequests/Show.jsx": () => import("./Show-hzeDDT3U.js"), "./Purchase/Suppliers/Form.jsx": () => import("./SupplierLinkModel-BxebTbNh.js").then((n) => n.a), "./Purchase/Suppliers/Index.jsx": () => import("./Index-CpuOAkdw.js"), "./Purchase/Suppliers/SupplierLinkModel.jsx": () => import("./SupplierLinkModel-BxebTbNh.js").then((n) => n.b), "./Sales/Customers/CustomerLinkModel.jsx": () => import("./CustomerLinkModel-CDws3QaJ.js"), "./Sales/Customers/Form.jsx": () => import("./Form-CMMc7Y6H.js"), "./Sales/Customers/Index.jsx": () => import("./Index-CFQyB6zh.js"), "./Sales/InternalOrders/Form.jsx": () => import("./Form-BtnPoOPO.js"), "./Sales/InternalOrders/Index.jsx": () => import("./Index-FrnTlcKR.js"), "./Sales/InternalOrders/Show.jsx": () => import("./Show-CuKxRkHV.js"), "./Sales/SalesOrders/Form.jsx": () => import("./Form-C0npCoOp.js"), "./Sales/SalesOrders/Index.jsx": () => import("./Index-C0MknSUr.js"), "./Sales/SalesOrders/SalesOrderLinkModel.jsx": () => import("./SalesOrderLinkModel-DiJXrAI9.js"), "./Sales/SalesOrders/Show.jsx": () => import("./Show-CPAQbdgF.js"), "./Sales/SalesReturns/Form.jsx": () => import("./Form-BwLVRVeq.js"), "./Sales/SalesReturns/Index.jsx": () => import("./Index-CQSyXJFL.js"), "./Sales/SalesReturns/Show.jsx": () => import("./Show-BqXKFlDg.js"), "./Services/WorkOrders/Form.jsx": () => import("./Form-6eA6Z1By.js"), "./Services/WorkOrders/Index.jsx": () => import("./Index-BvhvGzgi.js"), "./Services/WorkOrders/ItemForm.jsx": () => import("./ItemForm-6udTT4rB.js"), "./Services/WorkOrders/Show.jsx": () => import("./Show-BeqnyLvt.js"), "./Settings/ApprovalScheme/Form.jsx": () => import("./Form-BQq1yUQD.js"), "./Settings/ApprovalScheme/Index.jsx": () => import("./Index-YX4eJjhW.js"), "./Settings/ApprovalScheme/Show.jsx": () => import("./Show-Cc1wcwQ_.js"), "./Settings/Branches/BranchLinkModel.jsx": () => import("./BranchLinkModel-C7QCrxBS.js"), "./Settings/Branches/Form.jsx": () => import("./Form-B00usptC.js"), "./Settings/Branches/Index.jsx": () => import("./Index-DXov9UEJ.js"), "./Settings/Branches/Show.jsx": () => import("./Show-BahcKd2e.js"), "./Settings/Company.jsx": () => import("./Company-CD9hiaOD.js"), "./Settings/FormatingSeries/Index.jsx": () => import("./Index-hl7AaXCk.js"), "./Settings/FormatingSeries/Show.jsx": () => import("./Show-C8bXdgPY.js"), "./Test.jsx": () => import("./Test-BWZ1EAIR.js"), "./Users/ManageUsers/Index.jsx": () => import("./Index-o25asU-U.js"), "./Users/ManageUsers/Show.jsx": () => import("./Show-CTDHbMiY.js"), "./Users/ManageUsers/UserLinkModel.jsx": () => import("./UserLinkModel-Dt8-ovm1.js"), "./Users/Roles/Form.jsx": () => import("./Form-DmplMLRT.js"), "./Users/Roles/Index.jsx": () => import("./Index-B4x2JYNE.js"), "./Users/Roles/Show.jsx": () => import("./Show-DpW2jMVW.js"), "./Welcome.jsx": () => import("./Welcome-BvUVlPRL.js") });
    if (Object.keys(modules).length <= 0) return null;
    const module = modules[`./${formPathname}.jsx`];
    if (typeof module === "undefined") {
      return null;
    }
    return React__default.lazy(module);
  }, [formPathname]);
  return /* @__PURE__ */ jsx(FormPage, { name, title, ...settings, children: FormComponent ? /* @__PURE__ */ jsx(
    Suspense,
    {
      fallback: /* @__PURE__ */ jsxs("div", { className: "flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4", children: [
        /* @__PURE__ */ jsx(LoadingIcon, { className: "size-4" }),
        /* @__PURE__ */ jsxs("span", { children: [
          t("core.form.loading"),
          " ..."
        ] })
      ] }),
      children: /* @__PURE__ */ jsx(FormComponent, {})
    }
  ) : /* @__PURE__ */ jsx("div", { children: "Form tidak ditemukan" }) });
}
export {
  ShowGeneral as default
};
