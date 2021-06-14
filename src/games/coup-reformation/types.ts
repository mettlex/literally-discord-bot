import { Message, MessageEmbed, User } from "discord.js";

export interface CoupPlayer {
  id: User["id"];
  tag: User["tag"];
  allegiance?: "loyalist" | "reformist";
  influences: [InfluenceCard, InfluenceCard] | [InfluenceCard] | [];
  coins: number;
}

export const gameModes = ["classic", "reformation"] as const;
export interface CoupGame {
  gameStarted: boolean;
  gameStartedAt: Date;
  mode: typeof gameModes[number];
  players: CoupPlayer[];
  currentPlayer: string;
  deck: Deck;
}

export interface CurrentCoupGames {
  [channelId: string]: CoupGame | undefined | null;
}

export interface InitialData {
  message: Message;
  embed: MessageEmbed;
  interval: NodeJS.Timeout;
}

export const influenceCardNamesInClassic = [
  "captain",
  "duke",
  "ambassador",
  "assassin",
  "contessa",
] as const;

export const influenceCardNamesInReformation = [
  ...influenceCardNamesInClassic,
  "inquisitor",
] as const;

export interface InfluenceCard {
  name:
    | typeof influenceCardNamesInClassic[number]
    | typeof influenceCardNamesInReformation[number];
  imageURL: string;
  description: string;
}

export type Deck = InfluenceCard[];
