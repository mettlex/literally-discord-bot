import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import pino from "pino";
import { getAppRootDir } from "../app";
import {
  ILiterallyUser,
  LiterallyUserModel,
  literallyUserSchema,
} from "./models/User";
const notInProduction = process.env.NODE_ENV !== "production";
const logger = pino({ prettyPrint: notInProduction });

if (!process.env.MONGODB_CONNECTION_URI) {
  const envFilePath = path.resolve(getAppRootDir(), "..", ".env");

  if (fs.existsSync(envFilePath)) {
    dotenv.config({ path: envFilePath });
  }
}

if (!process.env.MONGODB_CONNECTION_URI) {
  // eslint-disable-next-line no-console
  console.error("> No database connection uri found.");
}

let db: mongoose.Connection;
let LiterallyUser: LiterallyUserModel;

export const getDbConnection = () => db;
export const getLiterallyUserModel = () => LiterallyUser;

if (process.env.MONGODB_CONNECTION_URI) {
  mongoose
    .connect(process.env.MONGODB_CONNECTION_URI || "", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error);
    });

  db = mongoose.connection;

  db.on("error", (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
  });

  db.once("open", () => {
    logger.info(`> MongoDB connected`);

    LiterallyUser = db.model<ILiterallyUser, LiterallyUserModel>(
      "LiterallyUser",
      literallyUserSchema,
    );
  });
}
