export const SUPERME_PLATFORM_ADMIN_IDS = new Set([
  "ffc87a95-f535-4781-9c2d-c2fac962ea9e",
  "1396ed21-aef3-4827-a2b9-dd25d4be21a7",
]);

export function isProtectedSupermePlatformAdmin(userId: string) {
  return SUPERME_PLATFORM_ADMIN_IDS.has(userId);
}
