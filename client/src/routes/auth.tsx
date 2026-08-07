import { AuthForm } from "@client/features/auth/auth-form";
import { createFileRoute } from "@tanstack/react-router";

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
