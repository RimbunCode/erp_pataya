import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";

function Index() {
  return (
    <DataTable2 form={<Form />} classNameDialog="max-w-(--breakpoint-lg)!" />
  );
}
export default Index;
