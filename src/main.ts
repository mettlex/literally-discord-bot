/* eslint-disable no-console */
import { ShardingManager } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envFilePath = path.resolve(__dirname, "..", ".env");

if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

if (!process.env.TOKEN) {
  console.error("No access token found.");
  process.exit(1);
}

const manager = new ShardingManager(`${__dirname}/app.js`, {
  totalShards: parseInt(process.env.SHARD_COUNT || "2"),
  token: process.env.TOKEN,
});

manager.on("shardCreate", async (shard) => {
  console.log(`Launched shard ${shard.id}`);
});

manager.spawn();
