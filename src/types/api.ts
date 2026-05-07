export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  code?: number;
}

export type TaskStatus = "pending" | "running" | "success" | "failed";

export interface PaginationParams {
  page: number;
  page_size: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
