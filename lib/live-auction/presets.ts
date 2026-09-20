import { ECONMIND_AUCTION_PRESETS as source } from "./auction-presets-source";

export const AUCTION_PRESET_IMAGE_PATHS: Record<string, string> = {
  porcelain_kangxi_landscape_dish: "/images/live-auction/porcelain_01_kangxi_landscape_dish.jpg",
  porcelain_kangxi_clair_de_lune_hu_vase: "/images/live-auction/porcelain_02_kangxi_clair_de_lune_hu_vase.jpg",
  porcelain_kangxi_aubergine_bowl: "/images/live-auction/porcelain_03_kangxi_aubergine_bowl.jpg",
  porcelain_kangxi_blue_meiping: "/images/live-auction/porcelain_04_kangxi_blue_meiping.jpg",
  porcelain_kangxi_yellow_dragon_cup: "/images/live-auction/porcelain_05_kangxi_yellow_dragon_cup.jpg",
  painting_zhang_daqian_narcissus: "/images/live-auction/painting_01_zhang_daqian_narcissus.jpg",
  painting_qi_baishi_persimmons: "/images/live-auction/painting_02_qi_baishi_persimmons.jpg",
  painting_fu_baoshi_kunlun: "/images/live-auction/painting_03_fu_baoshi_kunlun.jpg",
  painting_xu_beihong_galloping_horse: "/images/live-auction/painting_04_xu_beihong_galloping_horse.jpg",
  painting_wu_guanzhong_riverside_village: "/images/live-auction/painting_05_wu_guanzhong_riverside_village.jpg",
  bronze_late_shang_gui: "/images/live-auction/bronze_01_late_shang_gui.jpg",
  bronze_eastern_zhou_jian: "/images/live-auction/bronze_02_eastern_zhou_jian.jpg",
  bronze_late_shang_pou: "/images/live-auction/bronze_03_late_shang_pou.jpg",
  bronze_eastern_zhou_he: "/images/live-auction/bronze_04_eastern_zhou_he.jpg",
  bronze_late_western_zhou_yi: "/images/live-auction/bronze_05_late_western_zhou_yi.jpg",
  jade_qianlong_gu_vase: "/images/live-auction/jade_01_qianlong_gu_vase.jpg",
  jade_18c_celadon_mountain: "/images/live-auction/jade_02_18c_celadon_mountain.jpg",
  jade_qianlong_prunus_lingzhi_vase: "/images/live-auction/jade_03_qianlong_prunus_lingzhi_vase.jpg",
  jade_qianlong_crab: "/images/live-auction/jade_04_qianlong_crab.jpg",
  jade_qianlong_chilong_disc: "/images/live-auction/jade_05_qianlong_chilong_disc.jpg",
};

export const ECONMIND_AUCTION_PRESETS = source.map((preset) => ({ ...preset, imageUrl: AUCTION_PRESET_IMAGE_PATHS[preset.id] ?? null }));
export type EconMindAuctionPreset = (typeof ECONMIND_AUCTION_PRESETS)[number];
export const PRESET_CATEGORIES = [
  { id: "porcelain", label: "瓷器" },
  { id: "painting", label: "画作" },
  { id: "bronze", label: "青铜器" },
  { id: "jade", label: "玉器" },
] as const;
