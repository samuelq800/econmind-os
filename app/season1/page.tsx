import { Season1TeamLobby } from "@/components/season1/season1-team-lobby";
import "./season1-game-lobby.css";

export const metadata = {
  title: "Season 1 Pre-Season Lobby",
  robots: { index: false, follow: false },
};

export default function Season1Page() {
  return <Season1TeamLobby />;
}
