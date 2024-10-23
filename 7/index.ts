import { Client, GatewayIntentBits, Interaction, Snowflake } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import sqlite3 from "sqlite3";

const token =
    "token";
const clientId = "1197002000135618660";
const guildId = "1195975632098701402";
// index.ts

const commands = [
    {
        name: "가입",
        description: "가입 명령어",
    },
];

const db = new sqlite3.Database("user.db");

// 테이블 생성
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT
    )
`);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once("ready", () => {
    console.log(`Logged in as ${client.user?.tag}`);

    const rest = new REST({ version: "9" }).setToken(token);

    (async () => {
        try {
            console.log("Started refreshing application (/) commands.");

            await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
                body: commands,
            });

            console.log("Successfully reloaded application (/) commands.");
        } catch (error) {
            console.error(error);
        }
    })();
});

client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === "가입") {
        const userId = interaction.user.id;
        const userName = interaction.user.username;

        // 사용자 정보 데이터베이스에 저장
        db.run("INSERT OR REPLACE INTO users (id, name) VALUES (?, ?)", [
            userId,
            userName,
        ]);

        await interaction.reply(
            `가입이 완료되었습니다. ID: ${userId}, 이름: ${userName}`
        );
    }
});

client.login(token);
