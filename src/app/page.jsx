import { redirect } from "next/navigation";

// Middleware handles the actual auth check and redirect to /login when
// there's no valid token. If this page is reached with a valid session,
// send the user straight to their dashboard.
export default function RootPage() {
  redirect("/dashboard");
}
