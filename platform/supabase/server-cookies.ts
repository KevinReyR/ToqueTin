import type { CookieOptions } from "@supabase/ssr";

type ServerCookieStore = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options: CookieOptions): void;
};

function isReadOnlyCookieStoreError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Cookies can only be modified")
  );
}

export function createServerCookieAdapter(cookieStore: ServerCookieStore) {
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(
      cookiesToSet: {
        name: string;
        value: string;
        options: CookieOptions;
      }[],
    ) {
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch (error) {
        if (!isReadOnlyCookieStoreError(error)) {
          throw error;
        }
      }
    },
  };
}
