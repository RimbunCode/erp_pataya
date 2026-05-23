import { useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";

export function useUserDirectory() {
  const {
    users: initialUsers = [],
    requests: initialRequests = [],
    orgs: initialOrgs = [],
    admins: initialAdmins = [],
    orgsMeta = null,
  } = usePage().props;

  const [users, setUsers] = useState(initialUsers);
  const [requests, setRequests] = useState(initialRequests);
  const [orgs, setOrgs] = useState(initialOrgs);
  const [admins, setAdmins] = useState(initialAdmins);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  useEffect(() => {
    setOrgs(initialOrgs);
  }, [initialOrgs]);

  useEffect(() => {
    setAdmins(initialAdmins);
  }, [initialAdmins]);

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "pending").length,
    [requests],
  );

  return {
    users,
    setUsers,
    requests,
    setRequests,
    orgs,
    setOrgs,
    admins,
    setAdmins,
    orgsMeta,
    pendingRequests,
  };
}
