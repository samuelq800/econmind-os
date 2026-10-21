import { PreviousPolicy } from "@/components/legal/previous-policy";
export const metadata = {
  title: "Prior Privacy Notice v1.1",
  robots: { index: false, follow: true },
};
export default function PreviousPrivacyPage() {
  return <PreviousPolicy document="privacy" />;
}
