"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("drip_email_schedule", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      application_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "loan_applications",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      email_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      track: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "scheduled",
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      locked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status_at_send: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      resolution: {
        type: Sequelize.TEXT,
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

    await queryInterface.addConstraint("drip_email_schedule", {
      fields: ["email_number"],
      type: "check",
      name: "drip_email_schedule_email_number_check",
      where: {
        email_number: { [Sequelize.Op.between]: [1, 99] },
      },
    });
    await queryInterface.addConstraint("drip_email_schedule", {
      fields: ["status"],
      type: "check",
      name: "drip_email_schedule_status_check",
      where: {
        status: {
          [Sequelize.Op.in]: [
            "scheduled",
            "sending",
            "sent",
            "cancelled",
            "skipped",
            "failed",
          ],
        },
      },
    });
    await queryInterface.addConstraint("drip_email_schedule", {
      fields: ["application_id", "email_number"],
      type: "unique",
      name: "drip_email_schedule_application_email_unique",
    });
    await queryInterface.addIndex("drip_email_schedule", ["status", "scheduled_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("drip_email_schedule");
  },
};
