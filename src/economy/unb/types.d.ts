export interface UNBServerConfig {
  [serverId: string]:
    | {
        wcWinReward:
          | {
              cash: number | undefined;
            }
          | undefined;
      }
    | undefined;
}
