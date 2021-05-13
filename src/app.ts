import pino from "pino";
import Discord from "discord.js";
import { setupWordChainGame } from "./games/word-chain";
import checkEnv from "./utils/check-env";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

if (!checkEnv()) {
  process.exit(1);
}

const client = new Discord.Client();

client.once("ready", () => {
  logger.info(`> discord bot is ready!`);

  setupWordChainGame(client);
});

client.login(process.env.TOKEN);
