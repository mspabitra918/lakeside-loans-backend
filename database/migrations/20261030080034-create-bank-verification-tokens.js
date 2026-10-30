"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("bank_verification_tokens", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      application_reference: {
        type: Sequelize.STRING(20),
        allowNull: false,
        references: {
          model: "loan_applications",
          key: "reference",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },

      type: {
        type: Sequelize.ENUM("initial", "reverification"),
        allowNull: false,
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      used_at: {
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

    await queryInterface.addIndex("bank_verification_tokens", [
      "application_reference",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bank_verification_tokens");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_bank_verification_tokens_type";',
    );
  },
};
