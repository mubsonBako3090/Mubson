import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/register-admin",
  "/forgot-password",
  "/reset-password",
];

const AUTH_REDIRECT_PATHS = [
  "/login",
  "/register",
  "/register-admin",
];

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  const isAuthRedirectPath = AUTH_REDIRECT_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  const isApiAuth = pathname.startsWith("/api/auth");

  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images");

  // Authentication API routes and static assets must remain accessible.
  if (isApiAuth || isStaticAsset) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  /*
   * If a user is already authenticated and visits /login or a registration
   * page, don't allow them to start another account session in the same
   * browser. Send them back to the dashboard.
   */
  if (isPublic && isAuthRedirectPath && token) {
    try {
      await jwtVerify(token, JWT_SECRET);

      return NextResponse.redirect(
        new URL("/dashboard", request.url)
      );
    } catch {
      // Token is invalid or expired.
      // Allow the user to access the public page.
    }
  }

  // Allow normal public pages.
  if (isPublic) {
    return NextResponse.next();
  }

  // Protected route with no authentication token.
  if (!token) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  try {
    // Verify JWT signature and expiration.
    await jwtVerify(token, JWT_SECRET);

    return NextResponse.next();
  } catch {
    // Invalid or expired JWT.
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
