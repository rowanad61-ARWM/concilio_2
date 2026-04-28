import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
};

type AuthAccountLike = {
  provider?: string | null;
  providerAccountId?: string | null;
  type?: string | null;
};

type AuthProfileLike = Record<string, unknown> | undefined;

function maybeString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function firstForwardedIp(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

async function readAuthRequestContext(): Promise<{
  actorIp: string | null;
  actorUserAgent: string | null;
  requestId: string | null;
}> {
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();

    return {
      actorIp:
        firstForwardedIp(headerList.get("x-forwarded-for")) ??
        headerList.get("x-real-ip") ??
        headerList.get("cf-connecting-ip") ??
        headerList.get("true-client-ip"),
      actorUserAgent: headerList.get("user-agent"),
      requestId: headerList.get("x-request-id"),
    };
  } catch {
    return {
      actorIp: null,
      actorUserAgent: null,
      requestId: null,
    };
  }
}

function profileString(profile: AuthProfileLike, key: string): string | null {
  return maybeString(profile?.[key]);
}

async function resolveActorUserId(
  user: AuthUserLike | null | undefined,
  profile?: AuthProfileLike,
): Promise<string | null> {
  const userId = maybeString(user?.id);
  if (isUuid(userId)) {
    return userId;
  }

  const email =
    maybeString(user?.email) ??
    profileString(profile, "email") ??
    profileString(profile, "preferred_username") ??
    profileString(profile, "upn");
  const authSubject =
    userId ?? profileString(profile, "sub") ?? profileString(profile, "oid");

  const orFilters = [
    ...(email ? [{ email }] : []),
    ...(authSubject ? [{ auth_subject: authSubject }] : []),
  ];

  if (orFilters.length === 0) {
    return null;
  }

  try {
    const { db } = await import("@/lib/db");
    const account = await db.user_account.findFirst({
      where: { OR: orFilters },
      select: { id: true },
    });

    return account?.id ?? null;
  } catch (error) {
    console.error("[Auth Audit] Failed to resolve actor user id:", error);
    return null;
  }
}

function errorRecord(error: Error): Record<string, unknown> {
  return error as unknown as Record<string, unknown>;
}

function readProviderFromError(error: Error): string | null {
  const record = errorRecord(error);
  const cause = record.cause as Record<string, unknown> | undefined;
  const nestedError = cause?.err as Record<string, unknown> | undefined;

  return (
    maybeString(record.provider) ??
    maybeString(cause?.provider) ??
    maybeString(nestedError?.provider)
  );
}

async function writeLoginSuccessAudit(params: {
  user: AuthUserLike;
  account?: AuthAccountLike | null;
  profile?: AuthProfileLike;
}): Promise<void> {
  const actorUserId = await resolveActorUserId(params.user, params.profile);
  const requestContext = await readAuthRequestContext();
  const { writeAuditEvent } = await import("@/lib/audit");

  await writeAuditEvent({
    userId: actorUserId,
    action: "LOGIN_SUCCESS",
    entityType: "auth",
    entityId: actorUserId ?? NIL_UUID,
    channel: "staff_ui",
    actor_ip: requestContext.actorIp,
    actor_user_agent: requestContext.actorUserAgent,
    request_id: requestContext.requestId,
    metadata: {
      provider: params.account?.provider ?? null,
      provider_account_id: params.account?.providerAccountId ?? null,
      auth_user_id: params.user.id ?? null,
      email: params.user.email ?? profileString(params.profile, "email"),
    },
  });
}

async function writeLoginFailAudit(error: Error): Promise<void> {
  const record = errorRecord(error);
  const requestContext = await readAuthRequestContext();
  const { writeAuditEvent } = await import("@/lib/audit");

  await writeAuditEvent({
    userId: null,
    action: "LOGIN_FAIL",
    entityType: "auth",
    entityId: NIL_UUID,
    channel: "system",
    actor_ip: requestContext.actorIp,
    actor_user_agent: requestContext.actorUserAgent,
    request_id: requestContext.requestId,
    metadata: {
      provider: readProviderFromError(error),
      error_name: error.name,
      error_message: error.message,
      error_type: maybeString(record.type),
      error_code: maybeString(record.code),
      error_kind: maybeString(record.kind),
    },
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        await writeLoginSuccessAudit({ user, account, profile });
      } catch (error) {
        console.error("[Auth Audit] Failed to write LOGIN_SUCCESS:", error);
      }

      return true;
    },
  },
  logger: {
    error(error) {
      void writeLoginFailAudit(error).catch((auditError) => {
        console.error("[Auth Audit] Failed to write LOGIN_FAIL:", auditError);
      });

      console.error("[NextAuth]", error);
    },
  },
});
