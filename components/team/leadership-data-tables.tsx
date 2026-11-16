"use client";

import { AdminPageDataTables } from "@/components/admin/page-data-tables";
import { leadershipTables, type DirectorySection, type DirectoryRegion } from "@/lib/admin/leadership-tables";

const tables = leadershipTables();
export function LeadershipDataTables({ sections, network }: { sections?: readonly DirectorySection[]; network?: readonly DirectoryRegion[] }) {
  return (
    <AdminPageDataTables title="Leadership & departments" tables={sections && network ? leadershipTables({ sections, network }) : tables} />
  );
}
