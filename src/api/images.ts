import { isRequestTimeoutError, request } from "@/api/client";
import { env } from "@/config/env";
import * as mock from "@/mocks/server";
import type { TaskStatus } from "@/types/api";
import type {
  ClassificationResult,
  ImageDetailResponse,
  ImageListResponse,
  SegmentationResult,
  UploadImageResponse,
} from "@/types/image";
import { sleep } from "@/utils/promise";

const CLASSIFICATION_REQUEST_TIMEOUT = 60_000;
const SEGMENTATION_REQUEST_TIMEOUT = 120_000;

const isFinalStatus = (status: TaskStatus | undefined) =>
  status === "success" || status === "failed";

const ensureFinalResult = <T extends { status: TaskStatus } | null>(
  result: T,
  taskName: string,
) => {
  if (!result || !isFinalStatus(result.status)) {
    throw new Error(`${taskName}任务已提交，仍在处理中，请稍后刷新查看结果。`);
  }

  return result;
};

const pollUntilFinal = async <T extends { status: TaskStatus } | null>(
  read: () => Promise<T>,
  attempts = 8,
  delay = 1200,
) => {
  let lastResult = await read();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (lastResult && isFinalStatus(lastResult.status)) {
      return lastResult;
    }

    await sleep(delay);
    lastResult = await read();
  }

  return lastResult;
};

export const uploadImage = async (file: File) => {
  if (env.useMock) {
    return mock.mockUploadImage(file);
  }

  const formData = new FormData();
  formData.append("file", file);

  return request<UploadImageResponse>({
    method: "POST",
    url: "/images/upload",
    data: formData,
  });
};

export const listImages = async (page: number, pageSize: number) => {
  if (env.useMock) {
    return mock.mockListImages(page, pageSize);
  }

  return request<ImageListResponse>({
    method: "GET",
    url: "/images",
    params: {
      page,
      page_size: pageSize,
    },
  });
};

export const getImageDetail = async (imageId: number) => {
  if (env.useMock) {
    return mock.mockGetImageDetail(imageId);
  }

  return request<ImageDetailResponse>({
    method: "GET",
    url: `/images/${imageId}`,
  });
};

export const deleteImage = async (imageId: number) => {
  if (env.useMock) {
    return mock.mockDeleteImage(imageId);
  }

  return request<null>({
    method: "DELETE",
    url: `/images/${imageId}`,
  });
};

export const triggerClassification = async (imageId: number) => {
  if (env.useMock) {
    return mock.mockTriggerClassification(imageId);
  }

  return request<ClassificationResult>({
    method: "POST",
    url: `/images/${imageId}/classification`,
    timeout: CLASSIFICATION_REQUEST_TIMEOUT,
  });
};

export const getClassification = async (imageId: number) => {
  if (env.useMock) {
    return mock.mockGetClassification(imageId);
  }

  return request<ClassificationResult | null>({
    method: "GET",
    url: `/images/${imageId}/classification`,
  });
};

export const ensureClassification = async (imageId: number) => {
  const existing = await getClassification(imageId);

  if (existing?.status === "success") {
    return existing;
  }

  let triggered: ClassificationResult | null = null;
  try {
    triggered = await triggerClassification(imageId);
  } catch (error) {
    if (!isRequestTimeoutError(error)) {
      throw error;
    }
  }

  if (triggered && isFinalStatus(triggered.status)) {
    return triggered;
  }

  return ensureFinalResult(
    await pollUntilFinal(() => getClassification(imageId), 20, 1500),
    "分类",
  );
};

export const triggerSegmentation = async (imageId: number) => {
  if (env.useMock) {
    return mock.mockTriggerSegmentation(imageId);
  }

  return request<SegmentationResult>({
    method: "POST",
    url: `/images/${imageId}/segmentation`,
    timeout: SEGMENTATION_REQUEST_TIMEOUT,
  });
};

export const getSegmentation = async (imageId: number) => {
  if (env.useMock) {
    return mock.mockGetSegmentation(imageId);
  }

  return request<SegmentationResult | null>({
    method: "GET",
    url: `/images/${imageId}/segmentation`,
  });
};

export const ensureSegmentation = async (imageId: number) => {
  const existing = await getSegmentation(imageId);

  if (existing?.status === "success") {
    return existing;
  }

  let triggered: SegmentationResult | null = null;
  try {
    triggered = await triggerSegmentation(imageId);
  } catch (error) {
    if (!isRequestTimeoutError(error)) {
      throw error;
    }
  }

  if (triggered && isFinalStatus(triggered.status)) {
    return triggered;
  }

  return ensureFinalResult(
    await pollUntilFinal(() => getSegmentation(imageId), 24, 1500),
    "分割",
  );
};
