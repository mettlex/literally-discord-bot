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
  respawn: true,
});

manager.on("shardCreate", async (shard) => {
  console.log(`Launched shard ${shard.id}`);

  shard.on("disconnect", () => {
    console.log(`Shard ${shard.id} disconnected`);
    // Implement reconnection strategy here
    manager.spawn();
  });

  shard.on("reconnecting", () => {
    console.log(`Shard ${shard.id} reconnecting`);
  });

  shard.on("ready", () => {
    console.log(`Shard ${shard.id} is ready`);
  });

  shard.on("error", (error) => {
    console.log(`Shard ${shard.id} encountered an error: ${error.message}`);
    // Handle the error here
    console.error(error);
  });
});

manager.spawn();
