import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side middleware for auth protection.
 *
 * Protects dashboard routes from unauthenticated access by checking
 * the Supabase session cookie before rendering. This is defense-in-depth
 * on top of the client-side AuthProvider guards.
 *
 * Public routes (onboarding, auth APIs, health, static assets) are excluded.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  if (
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/v1/api/auth") ||
    pathname.startsWith("/v1/api/health") ||
    pathname.startsWith("/v1/api/clawhub") ||
    pathname.startsWith("/v1/api/wallet/create") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // For API routes, let the route handler's requireAuth deal with it
  if (pathname.startsWith("/v1/api/")) {
    return NextResponse.next();
  }

  // For dashboard pages, check Supabase session
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // No session → redirect to onboarding
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Match dashboard pages but not static files or API routes
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
