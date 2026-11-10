"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("email_logs", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      email_type: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      recipient: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      application_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "pending",
      },
      provider_message_id: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      sent_at: {
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

    await queryInterface.addIndex("email_logs", ["application_reference"]);
    await queryInterface.addIndex("email_logs", ["status", "created_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("email_logs");
  },
};
