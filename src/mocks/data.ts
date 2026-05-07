import type {
  ClassificationResult,
  ImageRecord,
  SegmentationResult,
} from "@/types/image";
import type { MockStoredUser } from "@/types/user";

const svgToDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const createRockSvg = (
  title: string,
  subtitle: string,
  accent: string,
  withContours = false,
) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f3ead8" />
        <stop offset="100%" stop-color="#d4c1a4" />
      </linearGradient>
    </defs>
    <rect width="960" height="720" fill="url(#bg)" />
    <circle cx="220" cy="240" r="100" fill="${accent}" fill-opacity="0.48" />
    <circle cx="470" cy="180" r="130" fill="#2d7968" fill-opacity="0.34" />
    <circle cx="630" cy="410" r="120" fill="#cb8e4b" fill-opacity="0.42" />
    <circle cx="350" cy="430" r="90" fill="#8b6c42" fill-opacity="0.35" />
    ${
      withContours
        ? `
          <ellipse cx="220" cy="240" rx="120" ry="92" fill="none" stroke="#f9fcf8" stroke-width="8" />
          <ellipse cx="470" cy="180" rx="150" ry="120" fill="none" stroke="#f9fcf8" stroke-width="8" />
          <ellipse cx="630" cy="410" rx="138" ry="108" fill="none" stroke="#f9fcf8" stroke-width="8" />
          <ellipse cx="350" cy="430" rx="106" ry="82" fill="none" stroke="#f9fcf8" stroke-width="8" />
        `
        : ""
    }
    <rect x="48" y="48" width="864" height="624" rx="26" fill="none" stroke="#3f4337" stroke-opacity="0.18" stroke-width="6" />
    <text x="72" y="108" font-size="42" font-family="Source Han Sans SC, Microsoft YaHei" fill="#21423f" font-weight="700">${title}</text>
    <text x="72" y="154" font-size="24" font-family="Source Han Sans SC, Microsoft YaHei" fill="#21423f" fill-opacity="0.8">${subtitle}</text>
  </svg>
`;

export const mineralNames = [
  "橄榄石",
  "辉石",
  "角闪石",
  "黑云母",
  "斜长石",
  "红柱石",
  "十字石",
  "石榴石",
  "阳起石",
  "鲕粒灰岩",
];

export const mockUsers: MockStoredUser[] = [
  {
    id: 1,
    username: "admin",
    password: "admin123456",
    nickname: "管理员",
    role: "admin",
    email: "admin@example.com",
    is_active: true,
    created_at: "2026-04-07T09:00:00",
    updated_at: "2026-04-07T09:00:00",
  },
  {
    id: 2,
    username: "demo_user",
    password: "demo_pass_123",
    nickname: "演示用户",
    role: "user",
    email: "demo@example.com",
    is_active: true,
    created_at: "2026-04-07T09:15:00",
    updated_at: "2026-04-07T09:15:00",
  },
];

export const mockImages: ImageRecord[] = [
  {
    id: 1,
    file_name: "sample_olivine.jpg",
    origin_url: svgToDataUrl(createRockSvg("岩石薄片样例 A", "偏光下矿物纹理", "#d97b47")),
    thumb_url: svgToDataUrl(createRockSvg("样例 A", "缩略图", "#d97b47")),
    width: 960,
    height: 720,
    file_size: 165000,
    upload_time: "2026-04-07T12:00:00",
    uploader: {
      id: 2,
      username: "demo_user",
      nickname: "演示用户",
      role: "user",
    },
  },
  {
    id: 2,
    file_name: "sample_ooid.jpg",
    origin_url: svgToDataUrl(createRockSvg("岩石薄片样例 B", "鲕粒轮廓更明显", "#907a45")),
    thumb_url: svgToDataUrl(createRockSvg("样例 B", "缩略图", "#907a45")),
    width: 960,
    height: 720,
    file_size: 188000,
    upload_time: "2026-04-07T12:30:00",
    uploader: {
      id: 2,
      username: "demo_user",
      nickname: "演示用户",
      role: "user",
    },
  },
];

export const initialClassification: Record<number, ClassificationResult> = {
  1: {
    id: 101,
    status: "success",
    predicted_class: "橄榄石",
    confidence: 0.82,
    model_version: "placeholder-classifier-v1",
    error_message: null,
  },
};

export const initialSegmentation: Record<number, SegmentationResult> = {
  1: {
    id: 201,
    status: "success",
    mask_url: svgToDataUrl(createRockSvg("掩膜预览", "二值掩膜", "#f2f6f3", true)),
    overlay_url: svgToDataUrl(
      createRockSvg("分割叠加预览", "鲕粒轮廓叠加图", "#d97b47", true),
    ),
    grain_count: 4,
    area_ratio: 0.31,
    model_version: "placeholder-segmenter-v1",
    error_message: null,
  },
};
