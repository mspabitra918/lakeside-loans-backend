"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bank_verification_requests", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      application_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "loan_applications", key: "id" },
        onDelete: "CASCADE",
      },
      type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      outcome: { type: Sequelize.STRING(32), allowNull: true },
    });

    await queryInterface.addIndex("bank_verification_requests", [
      "application_id",
      "expires_at",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bank_verification_requests");
  },
};
