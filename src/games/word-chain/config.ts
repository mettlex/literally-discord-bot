import path from "path";
import { readFileSync, writeFileSync } from "fs";
import { GuildConfigCollection } from "./types";
import "./data/guild-config.json";
import { earlyAccessMode } from "../../config";

export const prefixes = ["wc.", "wc/", "wc!", "wordchain.", "word-chain."].map(
  (p) => (earlyAccessMode() ? `_${p}` : p),
);

export const secondsToJoin = 60;
export const mediumTurnSeconds = [30, 25, 20];
export const easyTurnSeconds = [30, 30, 25, 25, 20, 20];
export const hardTurnSeconds = [25, 20, 15];

const configDataFilePath = path.resolve(__dirname, "data", "guild-config.json");

const guildConfigs: GuildConfigCollection = JSON.parse(
  readFileSync(configDataFilePath, {
    encoding: "utf-8",
  }),
);

export const getGuildConfig = (guildId: string) => guildConfigs[guildId];

export const setGuildConfig = (
  guildId: string,
  data: GuildConfigCollection[string],
) => {
  try {
    guildConfigs[guildId] = {
      ...guildConfigs[guildId],
      ...data,
    };

    writeFileSync(configDataFilePath, JSON.stringify(guildConfigs, null, 2), {
      encoding: "utf-8",
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);

    return false;
  }

  return true;
};
