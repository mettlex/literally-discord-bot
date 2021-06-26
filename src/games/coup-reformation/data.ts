import path from "path";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import {
  CoupActionNameInClassic,
  CoupGame,
  CoupPlayer,
  CurrentCoupGames,
  Deck,
  InfluenceCard,
  influenceCardNamesInClassic,
  influenceCardNamesInReformation,
  InitialData,
} from "./types";
import { shuffleArray } from "../../utils/array";
import { oneLine } from "common-tags";
import glob from "glob";

export const numberEmojis = [
  "0️⃣",
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
] as const;

export const convertNumberToEmojis = (num: number): string => {
  if (num < 10) {
    return numberEmojis[num];
  }

  return num
    .toString()
    .split("")
    .map((n) => convertNumberToEmojis(+n))
    .join("");
};

export const gameDataDir = path.resolve(
  process.env.COUP_GAME_DATA_DIR || "/tmp/",
);

const currentCoupGames: CurrentCoupGames = {};

const initialMessages: {
  [channelId: string]: InitialData | undefined;
} = {};

export const getFileNameForGameData = (channelId: string) =>
  `coup_reformation_${channelId}.json`;

export const getCurrentCoupGame = (
  channelId: string,
): CoupGame | undefined | null => {
  const filepath = path.resolve(gameDataDir, getFileNameForGameData(channelId));

  if (!currentCoupGames[channelId] && existsSync(filepath)) {
    const filedata = JSON.parse(readFileSync(filepath, { encoding: "utf-8" }));

    currentCoupGames[channelId] = filedata;
  }

  return currentCoupGames[channelId];
};

export const setCurrentCoupGame = (
  channelId: string,
  gameData: CoupGame | null,
) => {
  const filepath = path.resolve(gameDataDir, getFileNameForGameData(channelId));

  currentCoupGames[channelId] = gameData;

  try {
    if (gameData) {
      writeFileSync(
        filepath,
        JSON.stringify(
          {
            ...gameData,
            initialMessageInterval: undefined,
            turnInterval: undefined,
          },
          null,
          2,
        ),
        {
          encoding: "utf-8",
        },
      );
    } else {
      unlinkSync(filepath);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  return currentCoupGames[channelId];
};

export const getAllCurrentCoupGames = () => {
  if (Object.keys(currentCoupGames).length === 0) {
    const fileNamePrefix = "coup_reformation_";
    const fileExt = ".json";

    const filePaths = glob.sync(
      `${path.resolve(gameDataDir)}/${fileNamePrefix}*${fileExt}`,
    );

    for (const filePath of filePaths) {
      if (existsSync(filePath)) {
        const text = readFileSync(filePath, { encoding: "utf-8" });
        const game = JSON.parse(text);

        const channelId = filePath
          .split("/")
          .slice(-1)[0]
          .replace(fileNamePrefix, "")
          .replace(fileExt, "");

        currentCoupGames[channelId] = game;
      }
    }
  }

  return currentCoupGames;
};

export const getInitialMessageAndEmbed = (channelId: string) =>
  initialMessages[channelId];

export const setInitialMessageAndEmbed = (data: InitialData) => {
  initialMessages[data.message.channel.id] = data;
};

export const influenceCardImagesClassic = influenceCardNamesInClassic.reduce<{
  [name: string]: string[];
}>((data, curr) => {
  if (curr === "ambassador") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028201629188116/ambassador_lg_1.jpg",
    ];
  } else if (curr === "assassin") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028204376588308/assassin_lg_1.jpg",
    ];
  } else if (curr === "captain") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028203236524093/captain_lg_1.jpg",
    ];
  } else if (curr === "contessa") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028202385080340/contessa_lg_1.jpg",
    ];
  } else if (curr === "duke") {
    data[curr] = [
      "https://cdn.discordapp.com/attachments/848495134874271764/854028204082462760/duke_lg_1.jpg",
    ];
  }

  return data;
}, {});

export const getImageURLForInfluenceCard = (
  name: InfluenceCard["name"],
): string | undefined => {
  return influenceCardImagesClassic[name][0];
};

interface CreateDeckParams {
  playersCount: number;
  gameMode: CoupGame["mode"];
}

// prettier-ignore
export const getDescriptionFromCardName = (name: InfluenceCard["name"]) =>
  name === "duke"
    ? oneLine`Takes 3 coins from the treasury. This action can't be blocked.
      Duke can block foreign aid.`
    : name === "captain"
      ? oneLine`Steals 2 coins from any other player.
        This action can be blocked by captain or ambassador.`
      : name === "ambassador"
        ? oneLine`Exchanges cards with the court deck.
        This action can't be blocked.`
        : name === "assassin"
          ? oneLine`Spends 3 coins to assassinate any other player.
          This action can be blocked by contessa.`
          : name === "contessa"
            ? oneLine`Blocks assassinations.`
            : "";

export const createDeck = ({
  playersCount,
  gameMode,
}: CreateDeckParams): Deck => {
  const deck: Deck = [];

  // prettier-ignore
  const cardNamesCount =
    gameMode === "classic"
      ? influenceCardNamesInClassic.length
      : gameMode === "reformation"
        ? influenceCardNamesInReformation.length
        : 1;

  const addCardsToDeck = (maxCards: number) => {
    const maxCardsForEachInfluence = maxCards / cardNamesCount;

    for (let i = 0; i < maxCards; i += maxCardsForEachInfluence) {
      for (let j = 0; j < maxCardsForEachInfluence; j++) {
        const name =
          influenceCardNamesInClassic[cardNamesCount * (i / maxCards)];

        // prettier-ignore
        deck.push({
          name,
          description:
            getDescriptionFromCardName(name),
          imageURL: getImageURLForInfluenceCard(name) || "",
        });
      }
    }
  };

  if (playersCount > 1 && playersCount < 7) {
    addCardsToDeck(15);
  } else if (playersCount > 6 && playersCount < 9) {
    addCardsToDeck(20);
  } else if (playersCount > 8 && playersCount < 11) {
    addCardsToDeck(25);
  }

  shuffleArray(deck);

  return deck;
};

export const coupActionsInClassic = {
  income: (channelId: string, game: CoupGame, player: CoupPlayer) => {
    player && (player.coins += 1);
    setCurrentCoupGame(channelId, game);
  },
  foreignAid: (channelId: string, game: CoupGame, player: CoupPlayer) => {
    player && (player.coins += 2);
    setCurrentCoupGame(channelId, game);
  },
  tax: (channelId: string, game: CoupGame, player: CoupPlayer) => {
    player && (player.coins += 3);
    setCurrentCoupGame(channelId, game);
  },
  exchange: (
    channelId: string,
    game: CoupGame,
    player: CoupPlayer,
    numberOfInfluences: number,
    selectedInfluenceIndexesForDeck:
      | [number, number]
      | [undefined, number]
      | [number, undefined]
      | [number]
      | [],
    selectedInfluenceIndexesForPlayer:
      | [number, number]
      | [undefined, number]
      | [number, undefined]
      | [number]
      | [],
  ) => {
    if (
      !player ||
      !numberOfInfluences ||
      !selectedInfluenceIndexesForDeck ||
      !selectedInfluenceIndexesForPlayer
    ) {
      return;
    }

    const performExchange = (deckInfIndex: number, playersInfIndex: number) => {
      const taken = game.deck.splice(deckInfIndex, 1)[0];
      const put = player.influences.splice(playersInfIndex, 1)[0];

      player.influences[playersInfIndex] = {
        ...taken,
        dismissed: false,
      };

      game.deck[deckInfIndex] = {
        name: put.name,
        description: put.description,
        imageURL: put.imageURL,
      };

      shuffleArray(game.deck);
    };

    if (numberOfInfluences === 2) {
      if (
        typeof selectedInfluenceIndexesForDeck[0] === "number" &&
        typeof selectedInfluenceIndexesForPlayer[0] === "number"
      ) {
        performExchange(
          selectedInfluenceIndexesForDeck[0],
          selectedInfluenceIndexesForPlayer[0],
        );
      }

      if (
        typeof selectedInfluenceIndexesForDeck[1] === "number" &&
        typeof selectedInfluenceIndexesForPlayer[1] === "number"
      ) {
        performExchange(
          selectedInfluenceIndexesForDeck[1],
          selectedInfluenceIndexesForPlayer[1],
        );
      }
    } else if (numberOfInfluences === 1) {
      if (
        typeof selectedInfluenceIndexesForDeck[0] === "number" &&
        typeof selectedInfluenceIndexesForPlayer[0] === "number"
      ) {
        performExchange(
          selectedInfluenceIndexesForDeck[0],
          selectedInfluenceIndexesForPlayer[0],
        );
      }
    }

    setCurrentCoupGame(channelId, game);
  },
  steal: (
    channelId: string,
    game: CoupGame,
    targetPlayer: CoupPlayer,
    player: CoupPlayer,
  ) => {
    if (!targetPlayer || !player || !channelId || !game) {
      return;
    }

    let stolenCoins = 0;

    if (targetPlayer.coins >= 2) {
      stolenCoins = 2;
    } else if (targetPlayer.coins === 1) {
      stolenCoins = 1;
    }

    targetPlayer.coins -= stolenCoins;
    player.coins += stolenCoins;

    setCurrentCoupGame(channelId, game);

    return stolenCoins;
  },
  assassinate: (
    channelId: string,
    game: CoupGame,
    player: CoupPlayer,
    targetPlayer: CoupPlayer,
    dismissedInfluenceIndex?: number,
  ) => {
    if (!player || !targetPlayer) {
      return;
    }

    player.coins -= 3;

    if (dismissedInfluenceIndex) {
      for (let i = 0; i < game.players.length; i++) {
        if (game.players[i].id === targetPlayer.id && dismissedInfluenceIndex) {
          game.players[i].influences[dismissedInfluenceIndex].dismissed = true;
          break;
        }
      }
    }

    setCurrentCoupGame(channelId, game);
  },
  coup: (
    channelId: string,
    game: CoupGame,
    player: CoupPlayer,
    targetPlayer: CoupPlayer,
    disarmedInfluenceIndex: number,
  ) => {
    if (!player || !targetPlayer) {
      return;
    }

    player.coins -= 7;

    for (let i = 0; i < game.players.length; i++) {
      if (game.players[i].id === targetPlayer.id && disarmedInfluenceIndex) {
        game.players[i].influences[disarmedInfluenceIndex].dismissed = true;
        break;
      }
    }

    setCurrentCoupGame(channelId, game);
  },
} as const;

export const coupActionNamesInClassic = Object.keys(
  coupActionsInClassic,
) as CoupActionNameInClassic[];
