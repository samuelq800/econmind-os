import type { Metadata } from "next";
import { TiaoRunner } from "@/components/games/tiao-runner";

export const metadata: Metadata = {
  title: "Yale Run",
  description: "A 60 FPS offline-style runner featuring Tiao the tiger.",
  robots: { index: false, follow: false },
};

export default function TiaoRunPage() {
  return <TiaoRunner />;
}
