import { Season1Entrance } from "@/components/season1/season1-entrance";
import "./season1-game-lobby.css";
import { Season1PolicyLinks } from "@/components/legal/season1-policy-links";

export const metadata = {
  title: "Season 1 Pre-Season Lobby",
  robots: { index: false, follow: false },
};

export default function Season1Page() {
  return <><Season1Entrance /><div className="mx-auto max-w-6xl px-5 pb-6"><Season1PolicyLinks /></div></>;
}
