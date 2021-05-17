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
      }
    | undefined;
}

export type WiktionaryAPIResponse = [string, [string, string] | []];
