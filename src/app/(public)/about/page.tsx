import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "О нас",
};

export default function AboutPage() {
  return (
    <div className="flex items-center justify-center">
      <div>Здесь будет about</div>
    </div>
  );
}
