import type { PaginatedResponse } from "@/types/api";

export type UserRole = "admin" | "user";

export interface UserProfile {
  id: number;
  username: string;
  nickname: string | null;
  role: UserRole;
  email: string | null;
  is_active: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  nickname: string;
  email: string;
}

export interface UpdateProfilePayload {
  nickname?: string;
  email?: string;
  password?: string;
}

export interface AdminUpdateUserPayload extends UpdateProfilePayload {
  role?: UserRole;
  is_active?: boolean;
}

export interface UserListItem extends UserProfile {
  created_at: string;
  updated_at: string;
}

export interface UserListResponse extends PaginatedResponse<UserListItem> {}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface MockStoredUser extends UserListItem {
  password: string;
}
