"use client";

import { withBasePath } from "@/lib/base-path";
import { AUCTION_PRESET_IMAGE_PATHS, YALES_EGG_PRESET_ID } from "@/lib/live-auction/presets";
import styles from "./yale-egg-hatch.module.css";

const eggPhoto = withBasePath(AUCTION_PRESET_IMAGE_PATHS[YALES_EGG_PRESET_ID]);
const tigerSheet = withBasePath("/games/tiao/spritesheet.webp");

export function YaleEggHatch() {
  return <div className={styles.stage} role="img" aria-label="Yale's Egg cracks open and reveals the Yale Run tiger">
    <div className={styles.glow} aria-hidden="true" />
    <div className={styles.tiger} style={{ backgroundImage: `url("${tigerSheet}")` }} aria-hidden="true" />
    <div className={`${styles.shell} ${styles.left}`} style={{ backgroundImage: `url("${eggPhoto}")` }} aria-hidden="true" />
    <div className={`${styles.shell} ${styles.right}`} style={{ backgroundImage: `url("${eggPhoto}")` }} aria-hidden="true" />
    <div className={styles.spark} aria-hidden="true">✦</div>
  </div>;
}

export function YaleTigerPortrait() {
  return <div className={styles.portrait} role="img" aria-label="Yale Run tiger hatched from Yale's Egg" style={{ backgroundImage: `url("${tigerSheet}")` }} />;
}
