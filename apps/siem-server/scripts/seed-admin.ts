import { auth } from "@server/core/auth/auth";
import { env } from "@server/core/env";

async function seedAdmin() {
  console.log("🌱 Creating initial admin user from Doppler/ENV...");

  if (env.INITIAL_ADMIN_EMAIL == null || env.INITIAL_ADMIN_PASSWORD == null) {
    console.error("❌ Missing INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD in Doppler/ENV!");
    process.exit(1);
  }

  try {
    const admin = await auth.api.signUpEmail({
      body: {
        email: env.INITIAL_ADMIN_EMAIL,
        password: env.INITIAL_ADMIN_PASSWORD,
        name: "Kramarich",
        role: "admin",
      },
    });

    console.log("✅ Admin created successfully:", admin.user.email);
  } catch (e) {
    console.error("❌ Failed to create admin (maybe user already exists):", e);
  }

  process.exit(0);
}

seedAdmin();
