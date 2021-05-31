import { User } from "discord.js";

export type WordChainGameMode =
  | "Noob"
  | "Casual"
  | "Challenge"
  | "Banned Letters";

export interface WordChainGame {
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
  mode: WordChainGameMode;
  maxLives: number;
  playerLives: {
    [userId: string]: number;
  };
  bannedLetters: string[];
  shouldAddBannedLetter: boolean;
}
export interface ActiveWordChainGames {
  [channelId: string]: WordChainGame | undefined;
}

export type WiktionaryAPIResponse = [string, [string, string] | []];

export interface ActiveUnlimitedWordChains {
  [channelId: string]: UnlimitedWordChainGame | undefined;
}
export interface UnlimitedWordChainGame {
  totalCorrectWords: number;
  connectedChainWords: number;
  lastCorrectMessageId: string;
  lastCorrectMessageAuthorId?: string;
  usedWords?: string[];
  longestWord: string;
  longestWordAuthor: User | null;
}
