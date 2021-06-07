import { User } from "discord.js";

export interface JottoData {
  playersData: {
    attemptsLeft: number;
    user: User;
    secret: string;
    availableLetters: string[];
    revealedLetters: string[];
    removedLetters: string[];
    secretFoundBy?: User;
    winner: boolean;
  }[];
  gameStarted: boolean;
  currentPlayerIndex: number;
  initialMessageInterval: NodeJS.Timeout | undefined;
  turnInterval: NodeJS.Timeout | undefined;
}

export interface ActiveJottoGames {
  [channelId: string]: JottoData | undefined | null;
}
