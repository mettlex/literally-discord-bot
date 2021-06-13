import { User } from "discord.js";

export interface CoupPlayer {
  id: User["id"];
  tag: User["tag"];
}

export interface CoupReformationGame {
  gameStarted: boolean;
  gameStartedAt: Date;
  mode: "classic" | "reformation";
  players: CoupPlayer[];
}

export interface CurrentCoupReformationGames {
  [channelId: string]: CoupReformationGame | undefined | null;
}

export interface InitialData {
  message: Message;
  embed: MessageEmbed;
  interval: NodeJS.Timeout;
}
