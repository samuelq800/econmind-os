import type { Metadata } from "next";
import { MailTerminal } from "@/components/admin/mail-terminal";

export const metadata: Metadata = { title: "Mail Terminal" };

export default function AdminMailPage() {
  return <MailTerminal />;
}
