// index.ts
import { Client, GatewayIntentBits, Interaction, Message } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Sequelize, DataTypes } from "sequelize";
import { Command, defineCommandModel } from "./models/CommandModel";

const token =
    "토큰";
const clientId = "1197002000135618660";
const guildId = "1195975632098701402";
const dbPath = "./database/database.sqlite";

const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: dbPath,
});

defineCommandModel(sequelize);

sequelize
    .sync({ alter: true })
    .then(async () => {
        console.log("SQLite database synced");
        await Command.bulkCreate(
            [
                { name: "hello", response: "Hello there!" },
                { name: "bye", response: "Goodbye!" },
            ],
            { ignoreDuplicates: true }
        );

        const client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });

        const rest = new REST({ version: "9" }).setToken(token);

        const commands = [
            {
                name: "배워",
                description: "Learn a new command",
                options: [
                    {
                        name: "keyword",
                        description: "The keyword for the new command",
                        type: 3,
                        required: true,
                    },
                    {
                        name: "reaction",
                        description: "The reaction for the new command",
                        type: 3,
                        required: true,
                    },
                ],
            },
        ];

        const refreshCommands = async () => {
            try {
                console.log("Started refreshing application (/) commands.");

                for (const command of commands) {
                    const existingCommand = await Command.findOne({
                        where: { name: command.name },
                    });

                    if (existingCommand) {
                        console.error(
                            `Command "${command.name}" already exists.`
                        );
                        continue;
                    }

                    try {
                        await rest.put(
                            Routes.applicationGuildCommands(clientId, guildId),
                            {
                                body: [command],
                            }
                        );
                        console.log(
                            `Successfully added command "${command.name}".`
                        );
                    } catch (error: any) {
                        console.error(
                            `Error adding command "${command.name}":`,
                            error
                        );

                        if (error.rawError && error.rawError.errors) {
                            console.error(
                                `API errors for command "${command.name}":`,
                                error.rawError.errors
                            );
                        }
                    }
                }

                console.log("Finished refreshing application (/) commands.");
            } catch (error) {
                console.error(error);
            }
        };

        const handleCustomCommands = async (interaction: Interaction) => {
            if (!interaction.isCommand()) return;

            const { commandName, options } = interaction;

            if (commandName === "배워") {
                const keywordOption = (options as any).getString("keyword");
                const reactionOption = (options as any).getString("reaction");

                const keyword = keywordOption as string;
                const reaction = reactionOption as string;

                if (keyword && reaction) {
                    await Command.create({
                        name: keyword.toLowerCase(),
                        response: reaction,
                    });
                    await interaction.reply(
                        `Command "${keyword}" added with reaction "${reaction}"`
                    );
                } else {
                    await interaction.reply(
                        "Please provide both keyword and reaction."
                    );
                }
            } else {
                const command = await Command.findOne({
                    where: { name: commandName },
                });

                if (command) {
                    await interaction.reply(command.response);
                }
            }
        };

        const handleMessage = async (message: Message) => {
            if (message.author.bot) return;

            const command = await Command.findOne({
                where: { name: message.content.toLowerCase() },
            });

            if (command) {
                await message.reply(command.response);
            }
        };

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
