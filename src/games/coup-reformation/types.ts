import { Message, MessageEmbed, User } from "discord.js";
import EventEmitter from "events";

export type CoupActionNameInClassic =
  | "income"
  | "foreignAid"
  | "coup"
  | "tax"
  | "assassinate"
  | "exchange"
  | "steal";

export type CoupActionsInClassic = Record<
  CoupActionNameInClassic,
  (...args: any[]) => void
>;

export type ActionEventName = `action_${CoupActionNameInClassic}`;

export interface CoupGameActionEventEmitter extends EventEmitter {
  once(
    eventName: ActionEventName,
    callback: ({
      channelId,
      player,
      target,
    }: {
      channelId: string;
      player: CoupPlayer;
      target?: CoupPlayer;
    }) => void,
  ): this;

  emit(
    eventName: ActionEventName,
    data: {
      channelId: string;
      player: CoupPlayer;
      target?: CoupPlayer;
    },
  ): boolean;
}

export interface CoupPlayer {
  id: User["id"];
  tag: User["tag"];
  name: string;
  allegiance?: "loyalist" | "reformist";
  influences: [Influence, Influence] | [];
  coins: number;
  avatarURL: string;
  decidedAction?: CoupActionNameInClassic;
  lostChallenge?: boolean;
}

export const gameModes = ["classic", "reformation"] as const;
export interface CoupGame {
  gameStarted: boolean;
  gameStartedAt: Date;
  startMessageId: string;
  mode: typeof gameModes[number];
  players: CoupPlayer[];
  currentPlayer: string;
  deck: Deck;
  turnCount: number;
  eventEmitter: CoupGameActionEventEmitter;
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

export interface Influence extends InfluenceCard {
  dismissed: boolean;
}

export type Deck = InfluenceCard[];