import type { PaginatedResponse, TaskStatus } from "@/types/api";

export interface UploaderInfo {
  id: number;
  username: string;
  nickname: string | null;
  role: string;
}

export interface ImageRecord {
  id: number;
  file_name: string;
  origin_url: string;
  thumb_url: string;
  width: number;
  height: number;
  file_size: number;
  upload_time: string;
  uploader: UploaderInfo;
}

export interface ClassificationResult {
  id: number;
  status: TaskStatus;
  predicted_class: string | null;
  confidence: number | null;
  model_version: string | null;
  error_message: string | null;
}

export interface ImageListItem extends ImageRecord {
  classification_status: TaskStatus | null;
  segmentation_status: TaskStatus | null;
  classification: ClassificationResult | null;
  segmentation: SegmentationResult | null;
}

export interface SegmentationResult {
  id: number;
  status: TaskStatus;
  mask_url: string | null;
  overlay_url: string | null;
  grain_count: number | null;
  area_ratio: number | null;
  model_version: string | null;
  error_message: string | null;
}

export interface ImageDetailResponse {
  image: ImageRecord;
  classification: ClassificationResult | null;
  segmentation: SegmentationResult | null;
}

export interface UploadImageResponse extends ImageDetailResponse {}

export interface ImageListResponse extends PaginatedResponse<ImageListItem> {}

export interface ProfileSummaryCard {
  label: string;
  value: string;
}
