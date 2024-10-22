// index.ts
import { Client, GatewayIntentBits, Interaction, Message } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Sequelize } from "sequelize";
import { Command, defineCommandModel } from "./models/CommandModel";

const token =
    "token";
const clientId = "1197002000135618660";
const guildId = "1195975632098701402";
const dbPath = "./database/database.sqlite";

const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: dbPath,
});

defineCommandModel(sequelize);

// force 옵션 제거

sequelize
    .sync()
    .then(async () => {
        console.log("SQLite database synced");
        await Command.bulkCreate([
            { name: "hello", response: "Hello there!" },
            { name: "bye", response: "Goodbye!" },
        ]);
        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });

        const rest = new REST({ version: "9" }).setToken(token);

        // commands 배열 추가
        const commands = [
            {
                name: "hello",
                description: "Hello command",
            },
            {
                name: "bye",
                description: "Goodbye command",
            },
        ];

        const refreshCommands = async () => {
            try {
                console.log("Started refreshing application (/) commands.");

                await rest.put(
                    Routes.applicationGuildCommands(clientId, guildId),
                    {
                        body: commands,
                    }
                );

                console.log("Successfully reloaded application (/) commands.");
            } catch (error) {
                console.error(error);
            }
        };

        const handleCustomCommands = async (interaction: Interaction) => {
            if (!interaction.isCommand()) return;

            const { commandName } = interaction;

            // Sequelize에서 명령어와 답변을 찾아 응답
            const command = await Command.findOne({
                where: { name: commandName },
            });

            if (command) {
                await interaction.reply(command.response);
            }
        };

        const handleMessage = async (message: Message) => {
            if (message.author.bot) return; // 봇의 메시지 무시

            // Sequelize에서 명령어와 답변을 찾아 응답
            const command = await Command.findOne({
                where: { name: message.content.toLowerCase() },
            });

            if (command) {
                await message.reply(command.response);
            }
        };

        // 서버 실행 후 Discord 봇 로그인
        client.once("ready", () => {
            console.log(`Logged in as ${client.user?.tag}`);
            refreshCommands();
        });

        client.on("interactionCreate", async (interaction: Interaction) => {
            await handleCustomCommands(interaction);
        });

        client.on("messageCreate", async (message: Message) => {
            await handleMessage(message);
        });

        client.login(token);
    })
    .catch((error) => console.error("Error syncing SQLite database:", error));
