"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const column of ["bank_name", "routing_number", "account_number"]) {
      await queryInterface.changeColumn("loan_applications", column, {
        type: Sequelize.TEXT,
        allowNull: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    for (const column of ["bank_name", "routing_number", "account_number"]) {
      await queryInterface.changeColumn("loan_applications", column, {
        type: Sequelize.STRING(258),
        allowNull: false,
      });
    }
  },
};
