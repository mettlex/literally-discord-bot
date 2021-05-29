import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getAppRootDir } from "../app";

export default function checkEnv(): boolean {
  const envFilePath = path.resolve(getAppRootDir(), "..", ".env");

  if (fs.existsSync(envFilePath)) {
    dotenv.config({ path: envFilePath });
  }

  if (!process.env.TOKEN) {
    // eslint-disable-next-line no-console
    console.error("No access token found.");
    return false;
  }

  return true;
}
