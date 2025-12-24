export default async function Landing() {
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div>Здесь будет landing</div>
    </div>
  );
}
