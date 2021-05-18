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
