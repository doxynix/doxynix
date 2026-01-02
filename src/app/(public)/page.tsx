import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Главная",
};

export default async function Landing() {
  return (
    <div>
      <div>Здесь будет landing</div>
    </div>
  );
}
