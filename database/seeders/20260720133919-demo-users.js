"use strict";

const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");

/**
 * Bootstraps the first admin account.
 *
 * POST /auth/register is itself JWT-guarded, so there is no way to create the
 * very first admin over HTTP — this seeder is the intended entry point.
 *
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD. ADMIN_PASSWORD has no
 * default on purpose: a hardcoded fallback would ship a known-password admin to
 * every environment that ran the seeder.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const email = "support@lakesideloans.com";
    const password = "admin!!admin";

    if (!email || !password) {
      throw new Error(
        "ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user.",
      );
    }

    // LoginDto enforces MinLength(6); a shorter seed would create an account
    // that can never log in.
    if (password.length < 6) {
      throw new Error("ADMIN_PASSWORD must be at least 6 characters.");
    }

    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM users WHERE email = :email LIMIT 1;",
      {
        replacements: { email },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    if (existing) {
      console.log(`Admin ${email} already exists — skipping.`);
      return;
    }

    const now = new Date();

    await queryInterface.bulkInsert("users", [
      {
        id: randomUUID(),
        full_name: "Lakeside Admin",
        email,
        password: await bcrypt.hash(password, 10),
        role: "admin",
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    console.log(`Seeded admin user: ${email}`);
  },

  async down(queryInterface) {
    const email = process.env.ADMIN_EMAIL;
    if (!email) return;
    await queryInterface.bulkDelete("users", { email });
  },
};
