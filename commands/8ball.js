const { SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { embed, fail } = require("../utils/feedback");

const ANSWERS = [
    "It is certain.",
    "It is decidedly so.",
    "Without a doubt.",
    "Yes, definitely.",
    "You may rely on it.",
    "As I see it, yes.",
    "Most likely.",
    "Outlook good.",
    "Signs point to yes.",
    "Reply hazy, try again.",
    "Ask again later.",
    "Better not tell you now.",
    "Cannot predict now.",
    "Concentrate and ask again.",
    "Don't count on it.",
    "My reply is no.",
    "My sources say no.",
    "Outlook not so good.",
    "Very doubtful."
];

module.exports = {
    group: "fun",
    usage: "8ball <question>",

    data: new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Answers your question with a magic 8 ball.")
        .addStringOption((option) =>
            option.setName("question").setDescription("Your question").setMaxLength(300).setRequired(true)
        ),

    async execute(ctx) {
        const question = ctx.text();

        if (!question) return fail(ctx, "No question", "Ask the 8 ball something.");

        const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];

        await ctx.respond({
            embeds: [
                embed({
                    color: config.colors.primary,
                    title: "🎱 Magic 8 Ball",
                    description: `**${question}**`,
                    fields: [{ name: "Answer", value: answer }],
                    footer: ctx.author.tag
                })
            ]
        });
    }
};
