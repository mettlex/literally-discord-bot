import fs from "fs";
import path from "path";
import dotenv from "dotenv";

export default function (): boolean {
  const envFilePath = path.resolve(__dirname, "..", "..", ".env");

  if (fs.existsSync(envFilePath)) {
    dotenv.config();
  }

  if (!process.env.TOKEN) {
    console.error("No access token found.");
    return false;
  }

  return true;
}
