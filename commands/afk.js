const djs = require("discord.js");
const { SlashCommandBuilder } = djs;
const config = require("../config");
const { duration } = require("../utils/format");
const { embed, done } = require("../utils/feedback");

const afk = new Map();

module.exports = {
    group: "utility",
    usage: "afk [reason]",

    data: new SlashCommandBuilder()
        .setName("afk")
        .setDescription("Marks you as away, or clears your away status.")
        .addStringOption((option) =>
            option.setName("reason").setDescription("Reason for going AFK").setMaxLength(200)
        ),

    async execute(ctx) {
        const reason = ctx.text() || null;

        if (afk.has(ctx.author.id)) {
            afk.delete(ctx.author.id);
            return done(ctx, {
                title: "Welcome back",
                description: "Your AFK status has been cleared."
            });
        }

        afk.set(ctx.author.id, { since: Date.now(), reason });

        return done(ctx, {
            title: "You are now AFK",
            description: reason ? `Reason: ${reason}` : "You will be greeted when you come back."
        });
    },

    events: {
        [djs.Events.MessageCreate]: async (client, message) => {
            if (message.author.bot) return;

            const entry = afk.get(message.author.id);

            if (entry) {
                afk.delete(message.author.id);
                await message
                    .reply({
                        embeds: [
                            embed({
                                color: config.colors.success,
                                title: "Welcome back",
                                description: `You were AFK for **${duration(Date.now() - entry.since)}**. Your status has been cleared.`,
                                footer: entry.reason ? `Reason: ${entry.reason}` : null
                            })
                        ]
                    })
                    .catch(() => {});
            }

            for (const mentioned of message.mentions?.users?.values() ?? []) {
                const target = afk.get(mentioned.id);
                if (!target) continue;

                await message
                    .reply({
                        embeds: [
                            embed({
                                color: config.colors.warning,
                                title: `${mentioned.username} is AFK`,
                                description: `${target.reason ? `${target.reason}\n` : ""}Away for **${duration(Date.now() - target.since)}**.`
                            })
                        ]
                    })
                    .catch(() => {});
            }
        }
    }
};
