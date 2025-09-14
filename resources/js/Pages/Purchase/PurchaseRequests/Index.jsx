import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import React from "react";

function Index() {
  return (
    <DataTable2 classNameDialog="max-w-(--breakpoint-2xl)!" form={<Form />} />
  );
}

export default Index;
