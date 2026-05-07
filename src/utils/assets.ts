import { env } from "@/config/env";

export const resolveAssetUrl = (url: string | null | undefined) => {
  if (!url) {
    return "";
  }

  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  ) {
    return url;
  }

  return `${env.assetBaseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};
