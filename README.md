# Literally (Discord Bot)
[![Discord Bots](https://top.gg/api/widget/status/842397311916310539.svg)](https://top.gg/bot/842397311916310539)

A Discord bot for word-games & social games

## Environment variables

Create & Edit a `.env` file like below:

```
TOKEN=paste the discord bot token here

APP_ID=paste the application id here

PUBLIC_KEY=paste the public key here

JOTTO_GAME_DATA_DIR=write path to your temp folder e.g. /tmp/ on linux

TOPGG_API_TOKEN=paste top.gg bot token (optional)

MONGODB_CONNECTION_URI=paste MongoDB connection uri with username, password and database name
```

Example file: [.env.example](./.env.example)

## Install Packages
```sh
npm i
```

## Run Development Server
```sh
npm run dev
```
