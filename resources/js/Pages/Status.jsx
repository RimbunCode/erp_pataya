import AppLayout from "@/Layouts/AppLayout";
import BadgeStatus from "../Components/BadgeStatus";
import React from "react";

function Status({ statuses }) {
  return (
    <AppLayout>
      <div className="grid grid-cols-3 items-center justify-center flex-wrap gap-4">
        {statuses.map((status, idx) => (
          <BadgeStatus
            className="text-xs py-0.5 px-2"
            key={idx}
            status={status.value}
          />
        ))}
      </div>
    </AppLayout>
  );
}

export default Status;
