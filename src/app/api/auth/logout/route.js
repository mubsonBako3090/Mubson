import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({
    message: "Logged out.",
  });

  /*
   * Explicitly destroy the authentication cookie.
   *
   * maxAge: 0 tells the browser to remove it immediately.
   *
   * expires: new Date(0) provides an additional explicit expiration.
   */
  response.cookies.set("token", "", {
    httpOnly: true,

    secure:
      process.env.NODE_ENV === "production",

    sameSite: "lax",

    expires: new Date(0),

    maxAge: 0,

    path: "/",
  });

  return response;
}
