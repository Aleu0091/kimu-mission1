import { Client, GatewayIntentBits, Interaction } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";

const token =
    "token";
const clientId = "1197002000135618660";
const guildId = "1195618199744557106";

const commands = [
    {
        name: "안녕",
        description: "안녕 명령어 테스트",
    },
];

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

    if (commandName === "안녕") {
        await interaction.reply("안녕하세요 세상이여!");
    }
});

client.login(token);
