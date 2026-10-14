"use client";

import { AdminPageDataTables } from "@/components/admin/page-data-tables";
import { leadershipTables } from "@/lib/admin/leadership-tables";

const tables = leadershipTables();
export function LeadershipDataTables() {
  return (
    <AdminPageDataTables title="Leadership & departments" tables={tables} />
  );
}
