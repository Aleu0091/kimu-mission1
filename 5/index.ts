// index.ts
import {
    Client,
    GatewayIntentBits,
    Interaction,
    Message,
    CommandInteractionOptionResolver,
    EmbedBuilder,
} from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Sequelize } from "sequelize";
import { Command, defineCommandModel } from "./models/CommandModel";
import axios, { AxiosError } from "axios";

interface novels {
    tags: string[];
    id: string;
    title: string;
    description: string;
    thumbnail: string | null;
    createdAt: string;
    updatedAt: string;
    author: {
        id: string;
        username: string;
        avatar: string;
        novelIds: string[];
    };
    episodeIds: string[];
}

// API로부터 소설 데이터 가져오기

// 뮤블 검색 기능
async function searchNovelByTitle(title: string): Promise<novels[] | null> {
    const apiUrlWithTitle = `https://muvel.kimustory.net/api/novels?title=${title}`;

    try {
        const response = await axios.get(apiUrlWithTitle);
        return response.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error(
                "Error searching novel by title:",
                (error as AxiosError).message
            );
        } else {
            console.error("Unknown error:", error);
        }
        return null;
    }
}

const token =
    "token";
const clientId = "1197002000135618660";
const guildId = "1197357350508580924";
const dbPath = "./database/database.sqlite";

const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: dbPath,
});

defineCommandModel(sequelize);

// force 옵션 제거

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
        name: "뮤블검색",
        description: "소설 검색 기능",
        options: [
            {
                name: "search",
                type: 3, // Make sure the type is correct
                description: "검색할 소설 제목",
                required: true,
            },
        ],
    },
];

const refreshCommands = async () => {
    try {
        console.log("Started refreshing application (/) commands.");

        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: commands,
        });

        console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error(error);
    }
};

// ...

const handleCustomCommands = async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === "뮤블검색") {
        const searchTitle = options.get("search")?.value as string | undefined;

        if (searchTitle) {
            const searchResult = await searchNovelByTitle(searchTitle);

            if (searchResult) {
                const embeds = searchResult.map((novel) => {
                    const authorInfo = `${novel.author.username} (${novel.author.id})`;
                    const episodeIdsInfo = `${novel.episodeIds.join(", ")}`;
                    const createdAtInfo = `${novel.createdAt}`;
                    const updatedAtInfo = `${novel.updatedAt}`;

                    const embed = new EmbedBuilder()
                        .setTitle(novel.title)
                        .setDescription(novel.description)
                        .addFields(
                            {
                                name: "Author: ",
                                value: `${novel.author.username} (${novel.author.id})`,
                            },
                            {
                                name: "Episode IDs: ",
                                value: `${novel.episodeIds.join(", ")}`,
                            },
                            {
                                name: "Created At: ",
                                value: `${novel.createdAt}`,
                            },
                            {
                                name: "Updated At: ",
                                value: `${novel.updatedAt}`,
                            }
                        );
                    return embed;
                });

                if (embeds.length > 0) {
                    // Only send a reply if there are embeds
                    await interaction.reply({ embeds });
                } else {
                    interaction.reply("Search result is empty.");
                }
            } else {
                await interaction.reply("Failed to search novel.");
            }
        } else {
            await interaction.reply("Please provide a search title.");
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
