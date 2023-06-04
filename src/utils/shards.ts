/* eslint-disable no-console */
import { PartialChannelData, Client, Guild } from "discord.js";

export const getServerCount = async (client: Client) => {
  if (!client.shard) {
    return 0;
  }

  const promise = client.shard.fetchClientValues(
    "guilds.cache.size",
  ) as Promise<number[]>;

  return await promise
    .then((result) => {
      const totalGuilds = result.reduce(
        (acc, guildCount) => acc + guildCount,
        0,
      );

      return totalGuilds;
    })
    .catch((e) => {
      console.error(e);
      return 0;
    });
};

export const getGuildIds = async (client: Client) => {
  if (!client.shard) {
    return [];
  }

  const promise = client.shard.fetchClientValues("guilds.cache") as Promise<
    Guild[][]
  >;

  return await promise
    .then((result) => {
      return result.flat().map((g) => g.id);
    })
    .catch((e) => {
      console.error(e);
      return [];
    });
};

export const getGuilds = async (client: Client) => {
  if (!client.shard) {
    return [];
  }

  const promise = client.shard.fetchClientValues("guilds.cache") as Promise<
    Guild[][]
  >;

  return await promise
    .then((result) => {
      return result.flat();
    })
    .catch((e) => {
      console.error(e);
      return [];
    });
};

export const getMemberIds = async (client: Client) => {
  if (!client.shard) {
    return [];
  }

  return (await getGuilds(client))
    .map((g) => g.members as unknown as string[])
    .flat();
};

export const getGuildChannelIds = async (client: Client) => {
  if (!client.shard) {
    return [];
  }

  const guildsCache = await getGuilds(client);

  return guildsCache.map((g) => g.channels as unknown as string[]).flat();
};

export const getAllDmChannelsData = async (client: Client) => {
  if (!client.shard) {
    return [];
  }

  const promise = client.shard.fetchClientValues("channels.cache") as Promise<
    PartialChannelData[][]
  >;

  return await promise
    .then((result) => {
      return result.flat();
    })
    .catch((e) => {
      console.error(e);
      return [];
    });
};
