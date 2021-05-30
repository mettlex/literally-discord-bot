require("source-map-support").install();
import pino from "pino";
import { Client } from "discord.js";
import { setupWordChainGame } from "./games/word-chain";
import checkEnv from "./utils/check-env";
import { setupTwoTruthsAndALieGame } from "./games/two-truths-and-a-lie";
import { GatewayServer, SlashCreator } from "slash-create";
import { setupHelpMenu } from "./help";

const notInProduction = process.env.NODE_ENV !== "production";

const logger = pino({ prettyPrint: notInProduction });

process.on("unhandledRejection", (reason) => reason && logger.error(reason));

export const getAppRootDir = () => __dirname;

if (!checkEnv()) {
  process.exit(1);
}

const client = new Client();

client.once("ready", () => {
  const creator = new SlashCreator({
    applicationID: process.env.APP_ID || "",
    publicKey: process.env.PUBLIC_KEY,
    token: process.env.TOKEN,
  });

  creator.withServer(
    // @ts-ignore
    new GatewayServer((handler) => client.ws.on("INTERACTION_CREATE", handler)),
  );

  if (notInProduction) {
    creator.on("debug", (message) => {
      logger.info(message);
    });
  }

  creator.on("error", (message) => {
    logger.error(message);
  });

  setupWordChainGame(client, creator);
  setupTwoTruthsAndALieGame(client, creator);
  setupHelpMenu(client, creator);

  creator.syncCommands({ syncGuilds: true, deleteCommands: true });

  client.user?.setActivity({
    name: "ly.help or /help",
    type: "PLAYING",
  });

  logger.info(`> discord bot is ready!`);
});

client.login(process.env.TOKEN);

export const getGuildIds = () => client.guilds.cache.map((g) => g.id);
export const getDiscordJSClient = () => client;
