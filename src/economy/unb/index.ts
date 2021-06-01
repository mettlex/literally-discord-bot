import pino from "pino";
import { Client, Guild, User } from "unb-api";
import sleep from "../../utils/sleep";

const logger = pino({ prettyPrint: process.env.NODE_ENV !== "production" });

export const getUser = async (
  client: Client,
  guildID: string,
  userID: string,
): Promise<User | undefined> => {
  let user;

  for (let i = 0; i < 30; i++) {
    try {
      logger.info("> Calling getUserBalance API");

      user = await client.getUserBalance(guildID, userID);

      logger.info("> Finished calling getUserBalance API");
      logger.info(user);

      return user;
    } catch (error) {
      logger.error(error);
      logger.info("> Retrying getUserBalance API");
      await sleep(1000);
      return getUser(client, guildID, userID);
    }
  }
};

export const addToCashBalance = async (
  client: Client,
  guildID: string,
  userID: string,
  amount: number,
) => {
  let user;

  for (let i = 0; i < 30; i++) {
    try {
      logger.info(`> Calling editUserBalance API with amount ${amount}`);

      user = await client.editUserBalance(guildID, userID, {
        cash: amount,
      });

      logger.info("> Finished calling editUserBalance API");
      logger.info(user);

      return user;
    } catch (error) {
      logger.error(error);
      logger.info("> Retrying editUserBalance API");
      await sleep(1000);
      return getUser(client, guildID, userID);
    }
  }
};

export const checkPermission = async (
  unbclient: Client,
  guildId: string,
): Promise<boolean> => {
  for (let i = 0; i < 30; i++) {
    try {
      logger.info(`> Calling getApplicationPermission API`);

      const permission = await unbclient
        .getApplicationPermission(guildId || "")
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error(e);
          return undefined;
        });

      logger.info(`> Finished calling getApplicationPermission API`);

      return permission?.has("economy") || false;
    } catch (error) {
      logger.error(error);
      logger.info("> Retrying getApplicationPermission API");
      await sleep(1000);
      return checkPermission(unbclient, guildId);
    }
  }

  return false;
};

export const getGuild = async (
  unbclient: Client,
  guildId: string,
): Promise<Guild | undefined> => {
  for (let i = 0; i < 30; i++) {
    try {
      logger.info(`> Calling getGuild API`);

      const guild = await unbclient.getGuild(guildId).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        return undefined;
      });

      logger.info(`> Finished calling getGuild API`);

      return guild;
    } catch (error) {
      logger.error(error);
      logger.info("> Retrying getGuild API");
      await sleep(1000);
      return getGuild(unbclient, guildId);
    }
  }
};
