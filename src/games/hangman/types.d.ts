export interface ActiveHangmanGames {
  [channelId: string]:
    | {
        gameStartedAt: Date;
      }
    | undefined;
}
