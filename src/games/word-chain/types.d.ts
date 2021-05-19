import { User } from "discord.js";

export type WordChainGameLevel = "Noob" | "Casual" | "Challenge";
export interface ActiveWordChainGames {
  [channelId: string]:
    | {
        gameStartedAt: Date;
        joinable: boolean;
        userIds: string[];
        longestWord: string;
        longestWordUserId: string;
        currentUser: string;
        currentStartingLetter: string;
        currentWordMinLength: number;
        roundIndex: number;
        usedWords: string[];
        reduce: boolean;
        level: WordChainGameLevel;
        maxLives: number;
        playerLives: {
          [userId: string]: number;
        };
      }
    | undefined;
}

export type WiktionaryAPIResponse = [string, [string, string] | []];

export interface ActiveUnlimitedWordChains {
  [channelId: string]: UnlimitedWordChainGame | undefined;
}
export interface UnlimitedWordChainGame {
  totalCorrectWords: number;
  connectedChainWords: number;
  lastCorrectMessageId: string;
  longestWord: string;
  longestWordAuthor: User | null;
}
