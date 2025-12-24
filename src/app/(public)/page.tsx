import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Главная",
};

export default async function Landing() {
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return (
    <div className="flex items-center justify-center">
      <div>Здесь будет landing</div>
    </div>
  );
}
