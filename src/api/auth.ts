import { env } from "@/config/env";
import {
  mockGetCurrentUser,
  mockLogin,
  mockRegister,
} from "@/mocks/server";
import type { UserProfile, LoginPayload, RegisterPayload, AuthToken } from "@/types/user";

const realLogin = async (payload: LoginPayload): Promise<AuthToken> => {
  const response = await fetch(`${env.apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "登录失败");
  }

  return response.json();
};

const realRegister = async (payload: RegisterPayload): Promise<UserProfile> => {
  const response = await fetch(`${env.apiBaseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "注册失败");
  }

  return response.json();
};

const realGetCurrentUser = async (): Promise<UserProfile> => {
  const token = localStorage.getItem("rock-agent-auth");
  const parsed = token ? JSON.parse(token) : null;

  const response = await fetch(`${env.apiBaseUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${parsed?.token ?? ""}`,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "获取用户信息失败");
  }

  return response.json();
};

export const loginUser = (payload: LoginPayload) =>
  env.useMock ? mockLogin(payload) : realLogin(payload);

export const registerUser = (payload: RegisterPayload) =>
  env.useMock ? mockRegister(payload) : realRegister(payload);

export const getCurrentUser = () =>
  env.useMock ? mockGetCurrentUser() : realGetCurrentUser();
