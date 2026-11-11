"use strict";

/**
 * Adds a nullable `verify_token` column to bank_account_verifications.
 *
 * Previously the raw verification token lived only in the Redis/BullMQ drip job
 * payload. The drip system is now DB-driven (a cron scans drip_email_schedule),
 * so the raw token must be persisted to build the verification link at send time.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bank_account_verifications", "verify_token", {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bank_account_verifications", "verify_token");
  },
};
