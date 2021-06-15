import { oneLine, stripIndents } from "common-tags";
import { differenceInSeconds } from "date-fns";
import { Message, MessageEmbed } from "discord.js";
import { ButtonStyle, ComponentType } from "slash-create";
import { flatColors } from "../../config";
import { ExtendedTextChannel } from "../../extension";
import { shuffleArray } from "../../utils/array";
import { prefixes, timeToJoinInSeconds } from "./config";
import {
  createDeck,
  getCurrentCoupReformationGame,
  setCurrentCoupReformationGame,
  setInitialMessageAndEmbed,
} from "./data";

export const askToJoinCoupGame = async (message: Message) => {
  const embed = new MessageEmbed()
    .setTitle("Join Coup Board Game!")
    .setDescription(
      stripIndents`${oneLine`_You are head of influences
    in a city run by a weak and corrupt court. You need to manipulate,
    bluff and bribe your way to power. Your object is to destroy
    the influences of all the other players, forcing them into exile.
    Only one player will survive..._`}

    ${oneLine`In Coup, you want to be the last player with
    influence in the game, with influence being represented
    by hidden character cards in your playing area.`}

    ${oneLine`You may join by pressing the button below
    or by sending \`${prefixes[0]}join\``}
  `,
    )
    .addField("Time left to join", `${timeToJoinInSeconds} seconds`, false)
    .setFooter(
      `${
        message.member?.nickname || message.author.username
      } is asking you to join`,
    )
    .setThumbnail(
      "https://cdn.discordapp.com/attachments/848495134874271764/854318440654831636/roles.png",
    )
    .setColor(flatColors.yellow);

  const channel = message.channel as ExtendedTextChannel;

  const initialMessage = (await channel.sendWithComponents({
    content: "",
    options: { embed },
    components: [
      {
        components: [
          {
            type: ComponentType.BUTTON,
            label: "Count me in!",
            custom_id: "join_coup",
            style: ButtonStyle.PRIMARY,
          },
        ],
      },
    ],
  })) as Message;

  const startTime = new Date();

  const interval = setInterval(() => {
    const game = getCurrentCoupReformationGame(message.channel.id);

    if (!game) {
      clearInterval(interval);
      return;
    }

    const timeLeft =
      timeToJoinInSeconds - differenceInSeconds(new Date(), startTime);

    if (timeLeft <= 0 || game.gameStarted) {
      embed.fields[0].name = `Time up!`;
      embed.fields[0].value = `Let's see who joined below.`;

      initialMessage.edit(embed);

      startCoupGame(initialMessage);

      clearInterval(interval);

      return;
    }

    embed.fields[0].value = `${timeLeft} seconds`;

    initialMessage.edit(embed);
  }, 3000);

  setInitialMessageAndEmbed({ message: initialMessage, embed, interval });
};

export const startCoupGame = (message: Message) => {
  let game = getCurrentCoupReformationGame(message.channel.id);

  if (!game) {
    message.channel.send("> No initial game data found to start.");
    return;
  }

  if (game.players.length < 2) {
    message.channel.send("> At least 2 players are needed to start Coup game.");

    setCurrentCoupReformationGame(message.channel.id, null);

    return;
  }

  game = {
    ...game,
    deck: createDeck({
      playersCount: game.players.length,
      gameMode: "classic",
    }),
    gameStarted: true,
    gameStartedAt: new Date(),
  };

  shuffleArray(game.players);

  game.currentPlayer = game.players[0].id;

  for (let i = 0; i < game.players.length; i++) {
    game.players[i].influences = [game.deck.pop()!, game.deck.pop()!];
  }

  setCurrentCoupReformationGame(message.channel.id, game);
};
