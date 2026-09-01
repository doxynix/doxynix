import { createFileRoute } from "@tanstack/react-router";

import { AuthForm } from "@/features/auth/auth-form";

export const Route = createFileRoute("/auth")({
  component: Auth,
});

function Auth() {
  return (
    <div className="grid h-full place-items-center">
      <AuthForm />
    </div>
  );
}

export default Auth;
