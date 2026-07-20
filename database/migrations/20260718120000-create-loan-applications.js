"use strict";

const TABLE = "loan_applications";
const STATUS_ENUM = "enum_loan_applications_status";

/**
 * Intake table for Step 1 of the application.
 *
 * Deliberately holds NO bank credentials. Routing and account numbers are not
 * needed to underwrite a file, only to disburse an approved one — so they do
 * not belong in the intake record. When funding is built, account data should
 * be tokenized through a provider (Plaid or equivalent) and referenced here by
 * token, so a dump of this table never yields a debitable account.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    );

    await queryInterface.createTable(TABLE, {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // Human-quotable handle for support calls. Not an approval of any kind.
      reference: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },

      // Loan request
      amount_requested: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      purpose: { type: Sequelize.STRING(64), allowNull: false },
      term_months: { type: Sequelize.INTEGER, allowNull: false },

      // Applicant
      first_name: { type: Sequelize.STRING(100), allowNull: false },
      last_name: { type: Sequelize.STRING(100), allowNull: false },
      email: { type: Sequelize.STRING(255), allowNull: false },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      street: { type: Sequelize.STRING(255), allowNull: false },
      city: { type: Sequelize.STRING(100), allowNull: false },
      state: { type: Sequelize.CHAR(2), allowNull: false },
      postal_code: { type: Sequelize.STRING(10), allowNull: false },

      bank_name: { type: Sequelize.STRING(100), allowNull: false },
      routing_number: { type: Sequelize.STRING(100), allowNull: false },
      account_number: { type: Sequelize.STRING(100), allowNull: false },
      bank_account_age: { type: Sequelize.STRING(100), allowNull: false },
      account_status: { type: Sequelize.STRING(100), allowNull: false },

      // TCPA record-keeping. Proving "prior express written consent" means
      // retaining the exact disclosure shown, when it was agreed to, and from
      // where — a boolean alone is not defensible evidence.
      sms_consent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sms_consent_at: { type: Sequelize.DATE, allowNull: true },
      sms_consent_text: { type: Sequelize.TEXT, allowNull: true },
      sms_opted_out_at: { type: Sequelize.DATE, allowNull: true },
      consent_ip: { type: Sequelize.INET, allowNull: true },
      consent_user_agent: { type: Sequelize.TEXT, allowNull: true },

      // Underwriting state. Starts at `received` — nothing is approved by the
      // act of submitting a form.
      status: {
        type: Sequelize.ENUM(
          "received",
          "in_review",
          "approved",
          "declined",
          "withdrawn",
        ),
        allowNull: false,
        defaultValue: "received",
      },
      decided_at: { type: Sequelize.DATE, allowNull: true },
      decision_notes: { type: Sequelize.TEXT, allowNull: true },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex(TABLE, ["email"]);
    await queryInterface.addIndex(TABLE, ["status", "created_at"]);
    await queryInterface.addIndex(TABLE, ["created_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
    // dropTable leaves the ENUM type behind on Postgres.
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "${STATUS_ENUM}";`,
    );
  },
};
