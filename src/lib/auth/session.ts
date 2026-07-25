import { cookies, headers } from "next/headers";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthSessionUser = {
  id: string;
  email: string | null;
};

function isTestAuthEnabled(): boolean {
  return process.env.ALLOW_TEST_AUTH === "true" && process.env.NODE_ENV !== "production";
}

const resolveAuthUser = cache(
  async (
    testAuthUserId: string | null,
    testEmail: string | null,
  ): Promise<AuthSessionUser | null> => {
    if (isTestAuthEnabled() && testAuthUserId) {
      return {
        id: testAuthUserId,
        email: testEmail ?? `${testAuthUserId}@test.local`,
      };
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      return null;
    }

    await cookies();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  },
);

export async function getAuthUser(): Promise<AuthSessionUser | null> {
  let testAuthUserId: string | null = null;
  let testEmail: string | null = null;
  if (isTestAuthEnabled()) {
    try {
      const h = await headers();
      testAuthUserId = h.get("x-test-auth-user-id");
      testEmail = h.get("x-test-auth-email");
    } catch {
      // outside request
    }
  }
  return resolveAuthUser(testAuthUserId, testEmail);
}
