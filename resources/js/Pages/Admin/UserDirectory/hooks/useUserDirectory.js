import { useState } from "react";
import {
  MOCK_USERS,
  MOCK_ROLE_REQUESTS,
  MOCK_ORGANIZATIONS,
  MOCK_ADMINS,
} from "../data/mockData";

export function useUserDirectory() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [requests, setRequests] = useState(MOCK_ROLE_REQUESTS);
  const [orgs, setOrgs] = useState(MOCK_ORGANIZATIONS);
  const [admins, setAdmins] = useState(MOCK_ADMINS);

  const pendingRequests = requests.filter((r) => r.status === "pending").length;

  return {
    users, setUsers,
    requests, setRequests,
    orgs, setOrgs,
    admins, setAdmins,
    pendingRequests,
  };
}
