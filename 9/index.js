const discord_js_1 = require("discord.js");
const rest_1 = require("@discordjs/rest");
const v9_1 = require("discord-api-types/v9");
const sqlite3_1 = __importDefault(require("sqlite3"));
const schedule = __importStar(require("node-schedule"));
const { EmbedBuilder } = require("discord.js");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
} = require("discord.js");
const token =
    "token";
const clientId = "1197002000135618660";
const guildId = "604137297033691137";
const commands = [
    {
        name: "가입",
        description: "가입 명령어",
    },
    {
        name: "출석",
        description: "출석 명령어",
    },
    {
        name: "내돈",
        description: "현재 가지고 있는 돈을 보여줍니다.",
    },
    {
        name: "창업",
        description: "주식투자",
        options: [
            {
                name: "companyname",
                type: 3,
                description: "Name of the company",
                required: true,
            },
            {
                name: "amount",
                type: 4, 
                description: "Initial investment amount",
                required: true,
            },
        ],
    },
];
const db = new sqlite3_1.default.Database("user.db");
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        coins INTEGER DEFAULT 0,
        lastAttendance INTEGER DEFAULT 0
    )
`);
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
const companies = new Map();

client.once("ready", () => {
    console.log(`Logged in as ${client.user?.tag}`);
    const rest = new rest_1.REST({ version: "9" }).setToken(token);
    (async () => {
        try {
            console.log("Started refreshing application (/) commands.");
            await rest.put(
                v9_1.Routes.applicationGuildCommands(clientId, guildId),
                {
                    body: commands,
                }
            );
            console.log("Successfully reloaded application (/) commands.");
        } catch (error) {
            console.error(error);
        }
    })();
    schedule.scheduleJob("0 0 * * *", async () => {
        try {
            const users = await getAllUsers();
            for (const user of users) {
                await giveAttendanceReward(user.id);
            }
            console.log("Attendance rewards have been given.");
        } catch (error) {
            console.error("Error giving attendance rewards:", error);
        }
    });
});
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;
    const { commandName } = interaction;
    if (commandName === "가입") {
        const userId = interaction.user.id;
        const userName = interaction.user.username;
        const existingUser = await getUser(userId);
        if (existingUser) {
            interaction.reply("이미 가입된 사용자입니다.");
            return;
        }
        db.run(
            "INSERT INTO users (id, name) VALUES (?, ?)",
            [userId, userName],
            (error) => {
                if (error) {
                    console.error("Error saving user information:", error);
                    interaction.reply("가입 중 오류가 발생했습니다.");
                } else {
                    interaction.reply(
                        `가입이 완료되었습니다. ID: ${userId}, 이름: ${userName}`
                    );
                }
            }
        );
    } else if (commandName === "출석") {
        const userId = interaction.user.id;
        const user = await getUsertime(userId);
        if (!user) {
            interaction.reply(
                "가입 후 출석이 가능합니다. `가입` 명령어로 가입해주세요."
            );
            return;
        }
        const lastAttendance = user.lastAttendance;
        const currentTime = Date.now();
        const cooldownTime = 24 * 60 * 60 * 1000;
        if (currentTime - lastAttendance < cooldownTime) {
            interaction.reply(
                `아직 출석 쿨타임이 남아있습니다. 다음 출석은 ${formatCooldownTime(
                    lastAttendance + cooldownTime - currentTime
                )} 후에 가능합니다.`
            );
            return;
        }
        if (currentTime - lastAttendance < cooldownTime) {
            interaction.reply(
                `아직 출석 쿨타임이 남아있습니다. 다음 출석은 ${formatCooldownTime(
                    lastAttendance + cooldownTime - currentTime
                )} 후에 가능합니다.`
            );
            return;
        }
        try {
            console.log("lastAttendance:", lastAttendance);
            console.log("currentTime:", currentTime);
            console.log("cooldownTime:", cooldownTime);
            console.log("Time Difference:", currentTime - lastAttendance);
            const coins = await giveAttendanceReward(userId);
            interaction.reply(
                `출석이 확인되었습니다! ${coins} 코인이 지급되었습니다.`
            );
        } catch (error) {
            console.error("Error giving attendance reward:", error);
            interaction.reply("출석 중 오류가 발생했습니다.");
        }
    } else if (commandName === "내돈") {
        const userId = interaction.user.id;
        const user = await getUser(userId);

        if (!user) {
            interaction.reply("가입 후 돈을 확인할 수 있습니다.");
            return;
        }

        const userBalance = user.coins;
        interaction.reply(`현재 가지고 있는 돈: ${userBalance} 코인`);
    } else if (commandName === "창업") {
        const companyName = interaction.options.getString("companyname");
        const amount = interaction.options.getInteger("amount");
        let userId = interaction.user.id;
        let user = await getUser(userId);

        if (!user) {
            interaction.reply(
                "가입 후에 투자가 가능합니다. `가입` 명령어로 가입해주세요."
            );
            return;
        }

        if (user.coins < amount) {
            interaction.reply("돈이 부족하여 투자할 수 없습니다.");
            return;
        }
        if (companies.has(interaction.guildId)) {
            interaction.reply("이미 투자 중인 게임이 있습니다.");
            return;
        }
        updateUserCoins(userId, user.coins - amount);
        userId = interaction.user.id;
        user = await getUser(userId);

        companies.set(interaction.guildId, {
            companyName,
            value: amount,
            turns: 0,
        });

        const embed = new EmbedBuilder()
            .setTitle("투자 시작!")
            .setDescription(
                `**${companyName}**에 ${amount}코인을 투자했습니다.`
            );

        const fin = new ButtonBuilder()
            .setCustomId("exitInvestment")
            .setLabel("사업 철수")
            .setStyle("Danger");

        const row = new ActionRowBuilder().addComponents(fin);
        const respond = await interaction.reply({
            embeds: [embed],
            components: [row],
        });

        const startTurn = async () => {
            const company = companies.get(interaction.guildId);

            if (!company) return;

            company.turns++;

            company.value -= 5;

            const eventChance = Math.random() * 100;
            let eventMessage = "";

            if (eventChance < 5) {
                // 파산
                company.value = 0;
                eventMessage = "파산했습니다! 회사 가치가 0이 되었습니다.";
                const earnings = company.value;
                companies.delete(interaction.guildId);

                const embed = new EmbedBuilder()
                    .setTitle("사업 파산!")
                    .setDescription(`**${company.companyName}**가 망했습니다.`);

                await interaction.editReply({
                    embeds: [embed],
                    components: [],
                });
            } else if (eventChance < 25) {
                // 손해
                const lossPercentage = Math.floor(
                    Math.random() * (30 - 10 + 1) + 10
                );
                const lossAmount = Math.floor(
                    (company.value * lossPercentage) / 100
                );
                company.value -= lossAmount;
                eventMessage = `손해를 봤습니다!\n **${companyName}**의 가치가 ${lossPercentage}% 감소했습니다.`;
            } else if (eventChance < 30) {
                // 무난한 순항
                eventMessage = `무난한 순항입니다.\n **${companyName}**의 가치가 변동이 없습니다.`;
            } else if (eventChance < 50) {
                // 좋은 일
                const gainPercentage = Math.floor(
                    Math.random() * (30 - 10 + 1) + 10
                );
                const gainAmount = Math.floor(
                    (company.value * gainPercentage) / 100
                );
                company.value += gainAmount;
                eventMessage = `좋은 일이 생겼습니다!\n **${companyName}**의 가치가 ${gainPercentage}% 증가했습니다.`;
            } else if (eventChance < 99.9) {
                // 대박
                const jackpotMultiplier = Math.floor(
                    Math.random() * (200 - 100 + 1) + 100
                );
                const jackpotAmount = Math.floor(
                    (company.value * jackpotMultiplier) / 100
                );
                company.value += jackpotAmount;
                eventMessage = `대박이야!\n **${companyName}**의 가치가 ${jackpotMultiplier}% 증가했습니다.`;
            } else {
                // 초대박
                const megaJackpotMultiplier = 500;
                const megaJackpotAmount = Math.floor(
                    (company.value * megaJackpotMultiplier) / 100
                );
                company.value += megaJackpotAmount;
                eventMessage = `초대박이야!\n **${companyName}**의 가치가 ${megaJackpotMultiplier}% 증가했습니다.`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`턴 ${company.turns}`)
                .setDescription(
                    `${eventMessage}\n유지비로 5코인이 차감되었습니다.\n현재 가치: ${company.value}코인`
                );

            const collectorFilter = (i) => i.user.id === interaction.user.id;
            if (eventChance < 5) {
                // 파산
                company.value = 0;
                eventMessage =
                    "파산했습니다!\n **${companyName}**의 가치가 0이 되었습니다.";
                const earnings = company.value;
                companies.delete(interaction.guildId);

                const embed = new EmbedBuilder()
                    .setTitle("사업 파산!")
                    .setDescription(
                        `**${company.companyName}**에서 ${earnings}코인을 얻었습니다.`
                    );

                try {
                    const respond = await interaction.editReply({
                        embeds: [embed],
                    });
                } catch (e) {
                    console.log(`${e}`);
                }
            } else {
                const fin = new ButtonBuilder()
                    .setCustomId("exitInvestment")
                    .setLabel("사업 철수")
                    .setStyle("Danger");

                const row = new ActionRowBuilder().addComponents(fin);
                try {
                    const respond = await interaction.editReply({
                        embeds: [embed],
                        components: [row],
                    });
                } catch (e) {
                    console.log(`${e}`);
                }
                try {
                    const confirmation = await respond.awaitMessageComponent({
                        filter: collectorFilter,
                        time: 5_000,
                    });

                    if (confirmation.customId === "exitInvestment") {
                        const earnings = company.value;
                        companies.delete(interaction.guildId);

                        const embed = new EmbedBuilder()
                            .setTitle("사업 철수!")
                            .setDescription(
                                `**${company.companyName}**에서 ${earnings}코인을 얻었습니다.`
                            );
                        updateUserCoins(userId, user.coins + earnings);
                        const fin = new ButtonBuilder()
                            .setCustomId("exitInvestment")
                            .setLabel("사업 철수")
                            .setStyle("Danger")
                            .setDisabled(true);

                        const row = new ActionRowBuilder().addComponents(fin);

                        try {
                            const respond = await interaction.editReply({
                                embeds: [embed],
                                components: [row],
                            });
                        } catch (e) {
                            console.log(`${e}`);
                        }
                        await confirmation.update({
                            components: [],
                        });
                    }
                } catch (e) {
                    setTimeout(
                        () =>
                            startTurn(
                                interaction.guildId,
                                interaction.channelId
                            ),
                        0
                    );
                }
            }
        };

        startTurn();
    }
});

client.login(token);
const getUser = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, coins FROM users WHERE id = ?",
            [userId],
            (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(row || null);
                }
            }
        );
    });
};
const getUsertime = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, coins, lastAttendance FROM users WHERE id = ?",
            [userId],
            (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(row || null);
                }
            }
        );
    });
};
const getAllUsers = () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT id, lastAttendance FROM users", (error, rows) => {
            if (error) {
                reject(error);
            } else {
                resolve(rows);
            }
        });
    });
};
const giveAttendanceReward = (userId) => {
    return new Promise((resolve, reject) => {
        const currentTime = Date.now();
        db.run(
            "UPDATE users SET coins = coins + 100, lastAttendance = ? WHERE id = ?",
            [currentTime, userId],
            function (error) {
                if (error) {
                    reject(error);
                } else {
                    const consecutiveBonus = this.changes > 1 ? 50 : 0;
                    const coinsEarned = 100 + consecutiveBonus;
                    resolve(coinsEarned);
                }
            }
        );
    });
};
const formatCooldownTime = (cooldownTime) => {
    const hours = Math.floor(cooldownTime / (60 * 60 * 1000));
    const minutes = Math.floor((cooldownTime % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((cooldownTime % (60 * 1000)) / 1000);
    return `${hours}시간 ${minutes}분 ${seconds}초`;
};
const updateUserCoins = (userId, coins) => {
    db.run("UPDATE users SET coins = ? WHERE id = ?", [coins, userId]);
};
