"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

type ApiRequestOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

const REQUEST_TIMEOUT_MS = 40_000;

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

      const requestHeaders: Record<string, string> = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      };
      if (!(options.body instanceof FormData)) {
        requestHeaders["Content-Type"] = "application/json";
      }

      const callerSignal = options.signal;
      if (callerSignal?.aborted) {
        throw new ApiRequestError(
          499,
          "request_cancelled",
          "Request was cancelled.",
        );
      }

      const requestController = new AbortController();
      let didTimeout = false;
      const abortRequest = () => requestController.abort();
      const timeoutId = window.setTimeout(() => {
        didTimeout = true;
        requestController.abort();
      }, REQUEST_TIMEOUT_MS);

      callerSignal?.addEventListener("abort", abortRequest);

      let response: Response;
      try {
        response = await fetch(`${apiBaseUrl}${path}`, {
          ...options,
          headers: requestHeaders,
          signal: requestController.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          if (didTimeout) {
            throw new ApiRequestError(
              408,
              "request_timeout",
              "This request timed out. Try again.",
            );
          }

          throw new ApiRequestError(
            499,
            "request_cancelled",
            "Request was cancelled.",
          );
        }

        throw error;
      } finally {
        window.clearTimeout(timeoutId);
        callerSignal?.removeEventListener("abort", abortRequest);
      }

      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => ({}))) as ApiErrorBody;
        throw new ApiRequestError(
          response.status,
          errorBody.error?.code ?? "request_failed",
          errorBody.error?.message ?? "Request failed.",
        );
      }

      if (response.status === 204) {
        return undefined as ResponseBody;
      }

      return (await response.json()) as ResponseBody;
    },
    [getToken],
  );
}
