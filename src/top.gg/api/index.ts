import * as Topgg from "@top-gg/sdk";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { getAppRootDir } from "../../app";
import { Client } from "discord.js";

if (!process.env.TOPGG_API_TOKEN) {
  const envFilePath = path.resolve(getAppRootDir(), "..", ".env");

  if (fs.existsSync(envFilePath)) {
    dotenv.config({ path: envFilePath });
  }
}

if (!process.env.TOPGG_API_TOKEN) {
  // eslint-disable-next-line no-console
  console.error("> No top.gg token found.");
}

const api = new Topgg.Api(process.env.TOPGG_API_TOKEN || "");

export const hasVoted = async (userId: string): Promise<boolean | null> => {
  try {
    const result = await api.hasVoted(userId);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return null;
  }
};

export const postStats = async (client: Client) => {
  try {
    const result = await api.postStats({
      serverCount: client.guilds.cache.size,
    });
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return null;
  }
};
