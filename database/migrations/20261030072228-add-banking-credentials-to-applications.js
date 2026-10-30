"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("loan_applications", "bank_username", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    // Store only encrypted data if credential storage is
    // explicitly authorized and genuinely necessary.
    await queryInterface.addColumn(
      "loan_applications",
      "bank_password_encrypted",
      {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "loan_applications",
      "bank_password_encrypted",
    );

    await queryInterface.removeColumn("loan_applications", "bank_username");
  },
};
