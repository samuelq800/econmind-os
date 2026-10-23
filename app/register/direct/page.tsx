import type { Metadata } from "next";
import { DirectRegistrationPage } from "@/components/auth/direct-registration-page";
export const metadata: Metadata = {
  title: "Direct registration",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <DirectRegistrationPage />;
}
