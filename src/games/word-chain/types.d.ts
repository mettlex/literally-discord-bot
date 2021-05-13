export interface ActiveWordChainGames {
  [channelId: string]:
    | {
        gameStartedAt: Date;
        joinable: boolean;
        userIds: string[];
        longestWord: string;
        currentUser: string;
        currentUserPassed: boolean;
        currentTurnWillEndAt: Date;
        currentStartingLetter: string;
        currentWordMinLength: number;
      }
    | undefined;
}
