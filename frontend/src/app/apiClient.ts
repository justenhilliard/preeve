"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

type ApiRequestOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export function useAuthenticatedApi() {
  const { getToken } = useAuth();

  return useCallback(
    async <ResponseBody,>(
      path: string,
      options: ApiRequestOptions = {},
    ): Promise<ResponseBody> => {
      const token = await getToken();
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

      if (!token) {
        throw new ApiRequestError(
          401,
          "unauthorized",
          "A Clerk session token is required.",
        );
      }

      if (!apiBaseUrl) {
        throw new ApiRequestError(
          500,
          "missing_api_base_url",
          "NEXT_PUBLIC_API_BASE_URL is not configured.",
        );
      }

      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as ApiErrorBody;
        throw new ApiRequestError(
          response.status,
          errorBody.error?.code ?? "request_failed",
          errorBody.error?.message ?? "Request failed.",
        );
      }

      return (await response.json()) as ResponseBody;
    },
    [getToken],
  );
}
