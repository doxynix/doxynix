import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center p-4">
      <div className="animate-in fade-in slide-in-from-bottom-4 relative z-20 w-full max-w-md duration-500">
        {children}
      </div>
    </div>
  );
}
