import { Client } from "discord.js";
import { setupGame } from "../setup";
import { ActiveWordChainGames } from "./types";
import { prefixes } from "./config";
import start from "./handlers/start";
import join from "./handlers/join";
import check from "./handlers/check";
import halt from "./handlers/halt";
import {
  handleMessageForUnlimitedMode,
  startUnlimitedMode,
  stopUnlimitedMode,
} from "./unlimited";

const activeGames: ActiveWordChainGames = {};

export const getAllActiveGames = () => activeGames;
export const getCurrentGame = (id: string) => activeGames[id];

export const actions = [
  {
    commands: ["stop unlimited", "stop u"],
    handler: stopUnlimitedMode,
  },
  {
    commands: ["stop", "halt", "abandon"],
    handler: halt,
  },
  {
    commands: [
      "unlimited",
      "start unlimited",
      "begin unlimited",
      "start u",
      "begin u",
      "s u",
    ],
    handler: startUnlimitedMode,
  },
  {
    commands: ["start", "begin", "s"],
    handler: start,
  },
  {
    commands: ["join", "enter", "j"],
    handler: join,
  },
  {
    commands: ["check", "c"],
    handler: check,
  },
];

export const setupWordChainGame = (client: Client) => {
  setupGame(client, prefixes, actions, [handleMessageForUnlimitedMode]);
};
