/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { ShardingManager } from "discord.js";

const envFilePath = path.resolve(__dirname, "..", ".env");

if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

if (!process.env.TOKEN) {
  console.error("No access token found.");
  process.exit(1);
}

const manager = new ShardingManager(`${__dirname}/app.js`, {
  token: process.env.TOKEN,
});

manager.on("shardCreate", async (shard) => {
  console.log(`Launched shard ${shard.id}`);
});

manager.spawn();
