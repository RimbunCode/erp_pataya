import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";

function Index() {
  return (
    <DataTable2 classNameDialog="max-w-(--breakpoint-lg)!" form={<Form />} />
  );
}
export default Index;
