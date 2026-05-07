import { request } from "@/api/client";
import { env } from "@/config/env";
import {
  mockGetCurrentUser,
  mockLogin,
  mockRegister,
} from "@/mocks/server";
import type { UserProfile, LoginPayload, RegisterPayload, AuthToken } from "@/types/user";

export const loginUser = (payload: LoginPayload) =>
  env.useMock
    ? mockLogin(payload)
    : request<AuthToken>({ method: "POST", url: "/auth/login", data: payload });

export const registerUser = (payload: RegisterPayload) =>
  env.useMock
    ? mockRegister(payload)
    : request<UserProfile>({ method: "POST", url: "/auth/register", data: payload });

export const getCurrentUser = () =>
  env.useMock
    ? mockGetCurrentUser()
    : request<UserProfile>({ method: "GET", url: "/users/me" });
