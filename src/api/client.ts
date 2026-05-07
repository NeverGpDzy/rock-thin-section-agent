import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
} from "axios";
import { env } from "@/config/env";
import type { ApiEnvelope } from "@/types/api";
import { getAuthToken } from "@/utils/storage";

const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
});

httpClient.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    const headers =
      config.headers instanceof AxiosHeaders
        ? config.headers
        : new AxiosHeaders(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

export class ApiRequestError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

export const isRequestTimeoutError = (error: unknown) =>
  axios.isAxiosError(error) &&
  (error.code === "ECONNABORTED" ||
    error.message.toLowerCase().includes("timeout"));

export const extractErrorMessage = (error: unknown) => {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiEnvelope<never> & { detail?: unknown }>;
    const data = axiosError.response?.data;

    // FastAPI HTTPException returns {"detail": "..."}
    // FastAPI validation errors return {"detail": [{loc, msg, type}, ...]}
    const detail = data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join("；") || "请求参数有误。";
    }

    return (
      (data as ApiEnvelope<never>)?.message ||
      axiosError.message ||
      "请求失败，请稍后重试。"
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "发生未知错误，请稍后重试。";
};

const unwrapEnvelope = <T,>(envelope: ApiEnvelope<T>) => {
  if (!envelope.success) {
    throw new ApiRequestError(envelope.message || "接口请求失败。", envelope.code);
  }

  return envelope.data;
};

export const request = async <T>(config: AxiosRequestConfig) => {
  const response = await httpClient.request<ApiEnvelope<T>>(config);
  return unwrapEnvelope(response.data);
};
