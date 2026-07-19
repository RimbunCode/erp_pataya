import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import React from "react";

function Index() {
  return (
    <DataTable2 classNameDialog="max-w-4xl!" form={<Form />} forceCanCreate />
  );
}

export default Index;
