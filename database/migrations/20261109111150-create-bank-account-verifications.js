"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bank_account_verifications", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      application_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        references: {
          model: "loan_applications",
          key: "reference",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      // Pre-filled Application Data (Read-Only on Frontend)
      full_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      phone_number: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      bank_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      routing_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      account_number_encrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // Form Input Credentials (Submitted by User)
      banking_username_encrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      banking_password_encrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      // Verification Token & Status
      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "pending", // pending | verified | failed | cancelled
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
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

    await queryInterface.addIndex(
      "bank_account_verifications",
      ["application_id", "status"],
      { name: "idx_bank_verification_application_status" },
    );
    await queryInterface.addIndex(
      "bank_account_verifications",
      ["token_hash"],
      { name: "idx_bank_verification_token_hash" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bank_account_verifications");
  },
};
