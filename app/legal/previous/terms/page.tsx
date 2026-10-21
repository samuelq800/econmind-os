import { PreviousPolicy } from "@/components/legal/previous-policy";
export const metadata = {
  title: "Prior Terms of Use v1.2",
  robots: { index: false, follow: true },
};
export default function PreviousTermsPage() {
  return <PreviousPolicy document="terms" />;
}
