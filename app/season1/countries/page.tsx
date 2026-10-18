import { Season1CountryPage } from "@/components/season1/season1-country-page";
import "../season1-game-lobby.css";

export const metadata = {
  title: "Country Selection · Season 1",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Season1CountryPage />;
}
