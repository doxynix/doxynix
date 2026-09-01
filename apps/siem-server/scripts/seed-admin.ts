import { auth } from "@/core/auth/auth";
import { env } from "@/core/env";

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
        name: "Kramarich",
        password: env.INITIAL_ADMIN_PASSWORD,
        role: "admin",
      },
    });

    console.log("✅ Admin created successfully:", admin.user.email);
  } catch (error) {
    console.error("❌ Failed to create admin (maybe user already exists):", error);
  }

  process.exit(0);
}

void seedAdmin();
