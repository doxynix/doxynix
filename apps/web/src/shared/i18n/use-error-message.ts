"use client";

import { MessageCode, type MessageParams } from "@doxynix/shared";
import { useTranslations } from "next-intl";

import { IS_PROD } from "@/shared/config/env.flags";

type ErrorMessageKey = keyof IntlMessages["Errors"];

export const ERROR_MESSAGE_KEYS = {
  ACCOUNT_BANNED: "account_banned",
  ACCOUNT_NOT_FOUND: "account_not_found",
  ADMIN_2FA_CODE_FORMAT: "admin_2fa_code_format",
  ADMIN_2FA_CODE_INVALID: "admin_2fa_code_invalid",
  ADMIN_2FA_CODE_REQUIRED: "admin_2fa_code_required",
  ADMIN_2FA_ENROLL_REQUIRED: "admin_2fa_enroll_required",
  ADMIN_2FA_NOT_ENROLLED: "admin_2fa_not_enrolled",
  ADMIN_2FA_REQUIRED: "admin_2fa_required",
  ADMIN_BAN_EXPIRY_INVALID: "admin_ban_expiry_invalid",
  ADMIN_LAST_ADMIN: "admin_last_admin",
  ADMIN_RIGHTS_REQUIRED: "admin_rights_required",
  ADMIN_SELF_ACTION_FORBIDDEN: "admin_self_action_forbidden",
  AGENT_SIGN_IN_REQUIRED: "agent_sign_in_required",
  AGENT_TOO_MANY_QUESTIONS: "agent_too_many_questions",
  AGENT_UNAVAILABLE: "agent_unavailable",
  AI_LIMIT_EXCEEDED: "ai_limit_exceeded",
  ANALYSIS_ABORTED: "analysis_aborted",
  ANALYSIS_FAILED: "analysis_failed",
  ANALYSIS_NOT_COMPLETED: "analysis_not_completed",
  ANALYSIS_NOT_FOUND: "analysis_not_found",
  ANALYSIS_VERSION_NOT_FOUND: "analysis_version_not_found",
  API_KEY_INTEGRITY_FAILED: "api_key_integrity_failed",
  API_KEY_INVALID: "api_key_invalid",
  API_KEY_NOT_FOUND: "api_key_not_found",
  API_KEY_NOT_FOUND_OR_DENIED: "api_key_not_found_or_denied",
  API_KEY_SCOPE_MISSING: "api_key_scope_missing",
  AUDIT_RESULT_EXPIRED: "audit_result_expired",
  AUTH_LAST_METHOD: "auth_last_method",
  AUTH_NOT_LOGGED_IN: "auth_not_logged_in",
  DOCUMENT_NOT_FOUND: "document_not_found",
  FEATURE_NOT_IN_PLAN: "feature_not_in_plan",
  FIELD_REQUIRED: "field_required",
  FIX_NO_STAGED_FILES: "fix_no_staged_files",
  FIX_NOT_FOUND: "fix_not_found",
  FIX_NOT_READY: "fix_not_ready",
  FIX_REPO_MISMATCH: "fix_repo_mismatch",
  GITHUB_APP_NOT_INSTALLED: "github_app_not_installed",
  GITHUB_APP_NOT_INSTALLED_OWNER: "github_app_not_installed_owner",
  GITHUB_AUTH_EXPIRED: "github_auth_expired",
  GITHUB_CONNECTION_REQUIRED: "github_connection_required",
  GITHUB_CONNECTION_SEARCH_REQUIRED: "github_connection_search_required",
  GITHUB_FILE_FETCH_FAILED: "github_file_fetch_failed",
  GITHUB_FILES_FETCH_FAILED: "github_files_fetch_failed",
  GITHUB_INSTALL_ALREADY_LINKED: "github_install_already_linked",
  GITHUB_INSTALL_CLAIM_FAILED: "github_install_claim_failed",
  GITHUB_INSTALL_CLAIM_FORBIDDEN: "github_install_claim_forbidden",
  GITHUB_INSTALL_VERIFY_FAILED: "github_install_verify_failed",
  GITHUB_LINK_REQUIRED: "github_link_required",
  GITHUB_STATE_INVALID: "github_state_invalid",
  GITHUB_STATE_USED: "github_state_used",
  MEMBER_ADD_FAILED: "member_add_failed",
  MEMBER_ALREADY_EXISTS: "member_already_exists",
  MEMBER_LAST_OWNER: "member_last_owner",
  MEMBER_NOT_FOUND: "member_not_found",
  MEMBER_RATE_LIMITED: "member_rate_limited",
  NOT_FOUND: "not_found",
  PAYMENT_REQUIRED: "payment_required",
  PR_ANALYSIS_NOT_FOUND: "pr_analysis_not_found",
  PROXY_MISSING_PARAMS: "proxy_missing_params",
  PROXY_UNSAFE_TARGET: "proxy_unsafe_target",
  PROXY_URL_INVALID: "proxy_url_invalid",
  REPO_FORMAT_INVALID: "repo_format_invalid",
  REPO_MUST_BE_OWNER_NAME: "repo_must_be_owner_name",
  REPO_NOT_FOUND: "repo_not_found",
  REPO_NOT_FOUND_OR_DENIED: "repo_not_found_or_denied",
  REPO_NOT_REGISTERED: "repo_not_registered",
  REPO_URL_INVALID: "repo_url_invalid",
  REQUEST_BODY_INVALID: "request_body_invalid",
  REQUEST_INVALID: "request_invalid",
  REVIEW_NOT_FOUND: "review_not_found",
  SESSION_ID_TAKEN: "session_id_taken",
  SESSION_NOT_FOUND: "session_not_found",
  TARGET_NOT_A_FILE: "target_not_a_file",
  UNAUTHORIZED: "unauthorized",
  USER_NOT_FOUND: "user_not_found",
  VERIFY_FAILED: "verify_failed",
  WORKSPACE_ACCESS_DENIED: "workspace_access_denied",
  WORKSPACE_DB_CLIENT_MISSING: "workspace_db_client_missing",
  WORKSPACE_OWNER_REQUIRED: "workspace_owner_required",
} as const satisfies Record<MessageCode, ErrorMessageKey>;

const KNOWN_CODES = new Set<string>(Object.values(MessageCode));

export function messageKeyFor(code: MessageCode): ErrorMessageKey {
  return ERROR_MESSAGE_KEYS[code];
}

type ErrorPayload = {
  message?: string;
  messageCode?: MessageCode;
  params?: MessageParams;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readErrorPayload(error: unknown): ErrorPayload {
  if (!isRecord(error)) {
    return {};
  }

  const payload: ErrorPayload = {};

  if (typeof error.message === "string" && error.message.length > 0) {
    payload.message = error.message;
  }

  if (isRecord(error.data)) {
    if (typeof error.data.messageCode === "string" && KNOWN_CODES.has(error.data.messageCode)) {
      payload.messageCode = error.data.messageCode as MessageCode;
    }

    if (isRecord(error.data.params)) {
      const params: MessageParams = {};

      for (const [key, value] of Object.entries(error.data.params)) {
        if (typeof value === "string") {
          params[key] = value;
        }
      }

      payload.params = params;
    }
  }

  return payload;
}

export function useErrorMessage() {
  const t = useTranslations("Errors");

  return (error: unknown): string => {
    const { message, messageCode, params } = readErrorPayload(error);

    if (messageCode != null) {
      return t(messageKeyFor(messageCode), params);
    }

    if (!IS_PROD && message != null) {
      return message;
    }

    return t("generic");
  };
}
