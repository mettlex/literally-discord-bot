import { Client } from "discord.js";
import { setupGame } from "../setup";
import { prefixes } from "./config";
import { ActiveHangmanGames } from "./types";

const activeGames: ActiveHangmanGames = {};

export const getAllActiveGames = () => activeGames;
export const getCurrentGame = (id: string) => activeGames[id];

export const actions = [
  {
    commands: ["stop", "halt", "abandon"],
    // handler: halt,
    handler: () => {},
  },
  {
    commands: ["start", "begin", "s"],
    // handler: start,
    handler: () => {},
  },
];

export const setupWordChainGame = (client: Client) => {
  setupGame(client, prefixes, actions);
};
