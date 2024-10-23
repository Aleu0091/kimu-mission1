// index.ts
import { Client, GatewayIntentBits, Interaction, Message } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Sequelize } from "sequelize";
import { Command, defineCommandModel } from "./models/CommandModel";
import axios, { AxiosError } from "axios";

interface Novel {
    title: string;
    description: string;
}

// API로부터 소설 데이터 가져오기
async function fetchNovelData(apiUrl: string): Promise<Novel[] | null> {
    try {
        const response = await axios.get(apiUrl);
        return response.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error(
                "Error fetching novel data:",
                (error as AxiosError).message
            );
        } else {
            console.error("Unknown error:", error);
        }
        return null;
    }
}

// handleCustomCommands 함수 정의
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

// handleMessage 함수 정의
const handleMessage = async (message: Message) => {
    if (message.author.bot) return;

    const command = await Command.findOne({
        where: { name: message.content.toLowerCase() },
    });

    if (command) {
        await message.reply(command.response);
    }
};

const apiUrl = "https://muvel.kimustory.net/api/novels";
const token =
    "토큰"; // 봇 토큰 입력
const clientId = "1197002000135618660"; // 클라이언트 ID 입력
const guildId = "1195975632098701402"; // 길드 ID 입력
const dbPath = "./database/database.sqlite";

// SQLite 연결 및 모델 정의
const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: dbPath,
});

defineCommandModel(sequelize);

// Discord.js 클라이언트 설정
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
        description: "뮤블검색",
    },

];

// Discord.js 이벤트 및 명령어 처리
client.once("ready", () => {
    console.log(`Logged in as ${client.user?.tag}`);
    refreshCommands();
});

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

client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;

    if (
        interaction.commandName === "뮤블검색"
    ) {
        // API로부터 소설 데이터 가져오기
        fetchNovelData(apiUrl).then((novelData) => {
            if (novelData) {
                // 제목과 설명만 추출하여 novels 배열에 저장
                const novels: Novel[] = novelData.map((novel: Novel) => ({
                    title: novel.title,
                    description: novel.description,
                }));

                // novels 배열을 텍스트 형식으로 변환
                const novelsText = novels
                    .map(
                        (novel) =>
                            `Title: ${novel.title}\nDescription: ${novel.description}\n`
                    )
                    .join("\n");

                // 텍스트를 Discord 메시지로 출력
                interaction
                    .reply(`\`\`\`${novelsText}\`\`\``)
                    .then(() =>
                        console.log(
                            "Novels (Title and Description) sent as response."
                        )
                    )
                    .catch((error) =>
                        console.error("Error sending message:", error)
                    );
            } else {
                console.log("Failed to fetch novel data.");
                interaction.reply("Failed to fetch novel data.");
            }
        });
    } else {
        await handleCustomCommands(interaction);
    }
});

client.on("messageCreate", async (message: Message) => {
    await handleMessage(message);
});

// Discord.js 로그인
client.login(token);
