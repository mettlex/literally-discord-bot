export interface TheWinkingAssassinGame {
  gameStartedAt: Date;
  gameDurationInSeconds: number;
  alivePlayerIds: string[];
  deadPlayerIds: string[];
  assassinIds: string[];
  playerActions: {
    [userId: string]: string[];
  };
}

export interface ActiveTWAGames {
  [channelId: string]: TheWinkingAssassinGame | undefined | null;
}
