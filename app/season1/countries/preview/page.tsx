import { notFound } from "next/navigation";
import { CountryPreferencePreview } from "./preview";
import "../../season1-game-lobby.css";

export const metadata = {
  title: "LOCAL PREVIEW · Season 1 Country Selection",
  robots: { index: false, follow: false },
};
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CountryPreferencePreview />;
}
