import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";

export default function Index() {
  return (
    <>
      <DataTable2 form={<Form />} classNameDialog="max-w-(--breakpoint-2xl)!" />
    </>
  );
}
