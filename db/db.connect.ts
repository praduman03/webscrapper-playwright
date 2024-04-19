import { Sequelize, DataTypes } from "sequelize";
import dotenv from "dotenv"
dotenv.config();

// setup sequelize
export const sequelize = new Sequelize("plenatask", "root", "password@123", {
  host: "localhost",
  dialect: "mysql",
});

// Define Sequelize model
export const BabyModel = sequelize.define(
  "BabyData",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sex: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: false,
  }
);
