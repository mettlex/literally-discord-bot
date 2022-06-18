require("source-map-support").install();
export const getAppRootDir = () => __dirname;
import pino from "pino";
const notInProduction = process.env.NODE_ENV !== "production";
const logger = pino({ prettyPrint: notInProduction });
export const getLogger = () => logger;
import { Client, ClientOptions, Intents } from "discord.js";
import { setupWordChainGame } from "./games/word-chain";
import checkEnv from "./utils/check-env";
import { setupTwoTruthsAndALieGame } from "./games/two-truths-and-a-lie";
import { GatewayServer, SlashCreator } from "slash-create";
import { setupHelpMenu } from "./help";
import { setupTheWinkingAssassinGame } from "./games/the-winking-assassin";
import { setupJottoGame } from "./games/jotto";
import { setupCoupReformationGame } from "./games/coup-reformation";
import { setupVote } from "./vote";
import { postStats } from "./top.gg/api";
import { earlyAccessMode } from "./config";
import { setupGif } from "./social/gif";
import sleep from "./utils/sleep";

process.on(
  "unhandledRejection",
  (reason) =>
    reason &&
    // eslint-disable-next-line no-console
    console.error(reason),
);

if (!checkEnv()) {
  process.exit(1);
}

const options: ClientOptions = {
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
};

const client = new Client(options);

export const getDiscordJSClient = () => client;

client.once("ready", async () => {
  const creator = new SlashCreator({
    applicationID: process.env.APP_ID || "",
    publicKey: process.env.PUBLIC_KEY,
    token: process.env.TOKEN,
  });

  creator.withServer(
    new GatewayServer((handler) => client.ws.on("INTERACTION_CREATE", handler)),
  );

  if (notInProduction) {
    creator.on("debug", (message) => {
      logger.info(message);
    });
  }

  creator.on("error", (message) => {
    // eslint-disable-next-line no-console
    console.error(message);
  });

  setupGif(client, creator);
  setupCoupReformationGame(client, creator);
  setupWordChainGame(client, creator);
  setupTwoTruthsAndALieGame(client, creator);
  setupHelpMenu(client, creator);
  setupTheWinkingAssassinGame(client, creator);
  setupJottoGame(client, creator);
  setupVote(client);

  creator.syncCommands({ syncGuilds: true, deleteCommands: true });

  try {
    client.user?.setActivity({
      name: `${(earlyAccessMode() && "_") || ""}ly.help or /help`,
      type: "PLAYING",
    });
  } catch (error) {
    logger.error(error as object);
  }

  logger.info(`> discord bot is ready!`);

  try {
    if (client.user?.id === "842397311916310539") {
      await sleep(30000);
      const result = await postStats(client);
      logger.info(`Posted stats to Top.gg: ${result?.serverCount} servers.`);
    }
  } catch (error) {
    logger.error(error as object);
  }
});

client.login(process.env.TOKEN);
