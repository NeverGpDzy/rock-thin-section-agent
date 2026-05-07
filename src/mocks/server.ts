import {
  initialClassification,
  initialSegmentation,
  mineralNames,
  mockImages,
  mockUsers,
} from "@/mocks/data";
import type {
  ClassificationResult,
  ImageDetailResponse,
  ImageListItem,
  ImageListResponse,
  ImageRecord,
  SegmentationResult,
  UploadImageResponse,
} from "@/types/image";
import type {
  AdminUpdateUserPayload,
  AuthToken,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  UserListItem,
  UserListResponse,
  UserProfile,
} from "@/types/user";
import { sleep } from "@/utils/promise";
import { getAuthToken } from "@/utils/storage";

const users = [...mockUsers];
const images: Array<ImageRecord & { deleted?: boolean }> = [...mockImages];
const classificationMap = new Map<number, ClassificationResult>(
  Object.entries(initialClassification).map(([key, value]) => [Number(key), value]),
);
const segmentationMap = new Map<number, SegmentationResult>(
  Object.entries(initialSegmentation).map(([key, value]) => [Number(key), value]),
);

let nextUserId = users.length + 1;
let nextImageId = images.length + 1;
let nextClassificationId = 500;
let nextSegmentationId = 800;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });

const getImageDimensions = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || 0,
        height: image.naturalHeight || 0,
      });
    image.onerror = () => reject(new Error("无法解析图片尺寸"));
    image.src = src;
  });

const createToken = (userId: number) => `mock-token-${userId}`;

const buildPublicUser = (user: (typeof users)[number]): UserProfile => {
  const { password, ...result } = user;
  void password;
  return result;
};

const buildUserListItem = (user: (typeof users)[number]): UserListItem => {
  const { password, ...result } = user;
  void password;
  return result;
};

const getUserFromToken = () => {
  const token = getAuthToken();

  if (!token) {
    return null;
  }

  const userId = Number(token.replace("mock-token-", ""));
  if (Number.isNaN(userId)) {
    return null;
  }

  return users.find((item) => item.id === userId) ?? null;
};

const requireUser = () => {
  const user = getUserFromToken();
  if (!user) {
    throw new Error("请先登录后再访问该接口。");
  }
  return user;
};

const requireAdmin = () => {
  const user = requireUser();
  if (user.role !== "admin") {
    throw new Error("仅管理员可访问该接口。");
  }
  return user;
};

const getVisibleImages = (user: (typeof users)[number]) =>
  images.filter(
    (item) =>
      !item.deleted && (user.role === "admin" || item.uploader.id === user.id),
  );

const buildListItem = (image: ImageRecord): ImageListItem => ({
  ...image,
  classification_status: classificationMap.get(image.id)?.status ?? null,
  segmentation_status: segmentationMap.get(image.id)?.status ?? null,
  classification: classificationMap.get(image.id) ?? null,
  segmentation: segmentationMap.get(image.id) ?? null,
});

const hashSeed = (value: string) =>
  Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);

const buildClassificationSuccess = (imageId: number): ClassificationResult => {
  const image = images.find((item) => item.id === imageId);
  const seed = hashSeed(`${imageId}-${image?.file_name ?? ""}`);
  const mineral = mineralNames[seed % mineralNames.length];

  return {
    id: nextClassificationId++,
    status: "success",
    predicted_class: mineral,
    confidence: 0.71 + ((seed % 22) / 100),
    model_version: "placeholder-classifier-v1",
    error_message: null,
  };
};

const buildSegmentationSuccess = (imageId: number): SegmentationResult => {
  const seed = hashSeed(`segment-${imageId}`);
  const grainCount = 4 + (seed % 7);
  const areaRatio = 0.18 + ((seed % 25) / 100);

  const overlay = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
      <rect width="960" height="720" fill="#e7e0d2" />
      <ellipse cx="220" cy="240" rx="120" ry="96" fill="none" stroke="#ffffff" stroke-width="8" />
      <ellipse cx="470" cy="180" rx="150" ry="118" fill="none" stroke="#ffffff" stroke-width="8" />
      <ellipse cx="630" cy="410" rx="138" ry="108" fill="none" stroke="#ffffff" stroke-width="8" />
      <ellipse cx="350" cy="430" rx="106" ry="82" fill="none" stroke="#ffffff" stroke-width="8" />
      <text x="72" y="108" font-size="42" font-family="Source Han Sans SC, Microsoft YaHei" fill="#21423f" font-weight="700">鲕粒轮廓叠加</text>
      <text x="72" y="154" font-size="24" font-family="Source Han Sans SC, Microsoft YaHei" fill="#21423f">${grainCount} 个候选颗粒</text>
    </svg>
  `)}`;

  const mask = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
      <rect width="960" height="720" fill="#111111" />
      <ellipse cx="220" cy="240" rx="120" ry="96" fill="#ffffff" />
      <ellipse cx="470" cy="180" rx="150" ry="118" fill="#ffffff" />
      <ellipse cx="630" cy="410" rx="138" ry="108" fill="#ffffff" />
      <ellipse cx="350" cy="430" rx="106" ry="82" fill="#ffffff" />
      <text x="72" y="108" font-size="42" font-family="Source Han Sans SC, Microsoft YaHei" fill="#ffffff" font-weight="700">分割掩膜</text>
    </svg>
  `)}`;

  return {
    id: nextSegmentationId++,
    status: "success",
    mask_url: mask,
    overlay_url: overlay,
    grain_count: grainCount,
    area_ratio: Number(areaRatio.toFixed(2)),
    model_version: "placeholder-segmenter-v1",
    error_message: null,
  };
};

const startClassificationJob = (imageId: number) => {
  const running: ClassificationResult = {
    id: nextClassificationId++,
    status: "running",
    predicted_class: null,
    confidence: null,
    model_version: "placeholder-classifier-v1",
    error_message: null,
  };
  classificationMap.set(imageId, running);

  window.setTimeout(() => {
    classificationMap.set(imageId, buildClassificationSuccess(imageId));
  }, 1100);

  return running;
};

const startSegmentationJob = (imageId: number) => {
  const running: SegmentationResult = {
    id: nextSegmentationId++,
    status: "running",
    mask_url: null,
    overlay_url: null,
    grain_count: null,
    area_ratio: null,
    model_version: "placeholder-segmenter-v1",
    error_message: null,
  };
  segmentationMap.set(imageId, running);

  window.setTimeout(() => {
    segmentationMap.set(imageId, buildSegmentationSuccess(imageId));
  }, 1400);

  return running;
};

export const mockRegister = async (payload: RegisterPayload) => {
  await sleep(400);

  if (users.some((item) => item.username === payload.username)) {
    throw new Error("用户名已存在，请更换后重试。");
  }

  const now = new Date().toISOString();
  const user = {
    id: nextUserId++,
    username: payload.username,
    password: payload.password,
    nickname: payload.nickname,
    role: "user" as const,
    email: payload.email,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  users.push(user);
  return buildPublicUser(user);
};

export const mockLogin = async (payload: LoginPayload): Promise<AuthToken> => {
  await sleep(400);
  const user = users.find(
    (item) =>
      item.username === payload.username && item.password === payload.password,
  );

  if (!user) {
    throw new Error("用户名或密码错误。");
  }

  if (!user.is_active) {
    throw new Error("当前用户已被禁用。");
  }

  return {
    access_token: createToken(user.id),
    token_type: "bearer",
  };
};

export const mockGetCurrentUser = async (): Promise<UserProfile> => {
  await sleep(250);
  return buildPublicUser(requireUser());
};

export const mockUpdateCurrentUser = async (
  payload: UpdateProfilePayload,
): Promise<UserProfile> => {
  await sleep(350);
  const user = requireUser();

  user.nickname = payload.nickname ?? user.nickname;
  user.email = payload.email ?? user.email;
  user.password = payload.password ?? user.password;
  user.updated_at = new Date().toISOString();

  return buildPublicUser(user);
};

export const mockListUsers = async (
  page: number,
  pageSize: number,
): Promise<UserListResponse> => {
  await sleep(260);
  requireAdmin();

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = users
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(start, end)
    .map(buildUserListItem);

  return {
    items,
    total: users.length,
    page,
    page_size: pageSize,
  };
};

export const mockAdminUpdateUser = async (
  userId: number,
  payload: AdminUpdateUserPayload,
): Promise<UserListItem> => {
  await sleep(300);
  const admin = requireAdmin();
  const user = users.find((item) => item.id === userId);

  if (!user) {
    throw new Error("用户不存在。");
  }

  if (user.id === admin.id) {
    if (payload.is_active === false) {
      throw new Error("不能禁用当前管理员账号。");
    }
    if (payload.role === "user") {
      throw new Error("不能取消当前管理员权限。");
    }
  }

  user.nickname = payload.nickname ?? user.nickname;
  user.email = payload.email ?? user.email;
  user.password = payload.password ?? user.password;
  user.role = payload.role ?? user.role;
  user.is_active = payload.is_active ?? user.is_active;
  user.updated_at = new Date().toISOString();

  return buildUserListItem(user);
};

export const mockUploadImage = async (file: File): Promise<UploadImageResponse> => {
  await sleep(450);
  const user = requireUser();
  const originUrl = await readFileAsDataUrl(file);
  const { width, height } = await getImageDimensions(originUrl);

  const image: ImageRecord = {
    id: nextImageId++,
    file_name: file.name,
    origin_url: originUrl,
    thumb_url: originUrl,
    width,
    height,
    file_size: file.size,
    upload_time: new Date().toISOString(),
    uploader: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
    },
  };

  images.unshift(image);

  return {
    image,
    classification: null,
    segmentation: null,
  };
};

export const mockListImages = async (
  page: number,
  pageSize: number,
): Promise<ImageListResponse> => {
  await sleep(260);
  const user = requireUser();

  const visibleImages = getVisibleImages(user);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: visibleImages.slice(start, end).map(buildListItem),
    total: visibleImages.length,
    page,
    page_size: pageSize,
  };
};

export const mockGetImageDetail = async (
  imageId: number,
): Promise<ImageDetailResponse> => {
  await sleep(220);
  const user = requireUser();

  const image = getVisibleImages(user).find((item) => item.id === imageId);
  if (!image) {
    throw new Error("未找到对应图片。");
  }

  return {
    image,
    classification: classificationMap.get(imageId) ?? null,
    segmentation: segmentationMap.get(imageId) ?? null,
  };
};

export const mockDeleteImage = async (imageId: number): Promise<null> => {
  await sleep(250);
  const user = requireUser();

  const image = getVisibleImages(user).find((item) => item.id === imageId);
  if (!image) {
    throw new Error("图片不存在或已删除。");
  }

  const target = images.find((item) => item.id === imageId);
  if (target) {
    target.deleted = true;
  }
  return null;
};

export const mockTriggerClassification = async (
  imageId: number,
): Promise<ClassificationResult> => {
  await sleep(200);
  const user = requireUser();
  const image = getVisibleImages(user).find((item) => item.id === imageId);

  if (!image) {
    throw new Error("未找到需要分类的图片。");
  }

  return startClassificationJob(imageId);
};

export const mockGetClassification = async (
  imageId: number,
): Promise<ClassificationResult | null> => {
  await sleep(160);
  requireUser();
  return classificationMap.get(imageId) ?? null;
};

export const mockTriggerSegmentation = async (
  imageId: number,
): Promise<SegmentationResult> => {
  await sleep(220);
  const user = requireUser();
  const image = getVisibleImages(user).find((item) => item.id === imageId);

  if (!image) {
    throw new Error("未找到需要分割的图片。");
  }

  return startSegmentationJob(imageId);
};

export const mockGetSegmentation = async (
  imageId: number,
): Promise<SegmentationResult | null> => {
  await sleep(180);
  requireUser();
  return segmentationMap.get(imageId) ?? null;
};
