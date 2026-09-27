const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");
const config = require("../config");
const { embed } = require("../utils/feedback");

const activeGames = new Map();

function solve24(numbers) {
    function getExprs(nums) {
        if (nums.length === 1) {
            return [{ expr: String(nums[0].val), val: nums[0].val }];
        }
        let results = [];
        for (let i = 1; i < nums.length; i++) {
            let lefts = getExprs(nums.slice(0, i));
            let rights = getExprs(nums.slice(i));
            for (let l of lefts) {
                for (let r of rights) {
                    results.push({ expr: `(${l.expr} + ${r.expr})`, val: l.val + r.val });
                    results.push({ expr: `(${l.expr} - ${r.expr})`, val: l.val - r.val });
                    results.push({ expr: `(${r.expr} - ${l.expr})`, val: r.val - l.val });
                    results.push({ expr: `(${l.expr} * ${r.expr})`, val: l.val * r.val });
                    if (Math.abs(r.val) > 1e-5) {
                        results.push({ expr: `(${l.expr} / ${r.expr})`, val: l.val / r.val });
                    }
                    if (Math.abs(l.val) > 1e-5) {
                        results.push({ expr: `(${r.expr} / ${l.expr})`, val: r.val / l.val });
                    }
                }
            }
        }
        return results;
    }

    const wrappedNums = numbers.map((n) => ({ val: n }));
    const all = getExprs(wrappedNums);
    for (const item of all) {
        if (Math.abs(item.val - 24) < 1e-5) {
            return item.expr;
        }
    }
    return null;
}

function getCardAllowedValues(rawCard, mode) {
    if (mode === "casual") {
        if (rawCard === 1) return [1, 11]; // Ace: 1 or 11
        if (rawCard >= 11 && rawCard <= 13) return [10]; // J, Q, K: 10
        return [rawCard]; // 2-10
    } else {
        return [rawCard]; // chaos: A=1, 2-10=2-10, J=11, Q=12, K=13
    }
}

function getValueCombinations(cards, mode) {
    const allowedList = cards.map((c) => getCardAllowedValues(c, mode));
    function cartesian(arrs) {
        return arrs.reduce((acc, arr) => {
            let res = [];
            acc.forEach((x) => {
                arr.forEach((y) => {
                    res.push(x.concat([y]));
                });
            });
            return res;
        }, [[]]);
    }
    return cartesian(allowedList);
}

function generateCards(mode) {
    while (true) {
        const cards = [
            Math.floor(Math.random() * 13) + 1,
            Math.floor(Math.random() * 13) + 1,
            Math.floor(Math.random() * 13) + 1,
            Math.floor(Math.random() * 13) + 1
        ];
        const valueCombinations = getValueCombinations(cards, mode);
        let foundSolution = null;
        for (const valCombo of valueCombinations) {
            const sol = solve24(valCombo);
            if (sol) {
                foundSolution = sol;
                break;
            }
        }
        if (foundSolution) {
            return { cards };
        }
    }
}

function formatCard(n) {
    const names = { 1: "A", 11: "J", 12: "Q", 13: "K" };
    const label = names[n] || String(n);
    const suits = ["♠", "♥", "♦", "♣"];
    const suit = suits[Math.floor(Math.random() * suits.length)];
    return `\` ${label}${suit} \``;
}

function evaluateExpression(expr) {
    if (!/^[\d\s+\-*/()]+$/.test(expr)) {
        return { valid: false, error: "Invalid characters" };
    }

    try {
        function evalFlat(subExpr) {
            let tokens = [];
            let i = 0;
            while (i < subExpr.length) {
                let char = subExpr[i];
                if (/\s/.test(char)) {
                    i++;
                    continue;
                }
                if (/\d/.test(char)) {
                    let numStr = "";
                    while (i < subExpr.length && /\d/.test(subExpr[i])) {
                        numStr += subExpr[i];
                        i++;
                    }
                    tokens.push(Number(numStr));
                } else if ("+-*/".includes(char)) {
                    tokens.push(char);
                    i++;
                } else {
                    throw new Error("Invalid character");
                }
            }

            if (tokens.length === 0) return 0;
            let result = tokens[0];
            if (typeof result !== "number") throw new Error("Invalid expression");

            for (let j = 1; j < tokens.length; j += 2) {
                let op = tokens[j];
                let nextNum = tokens[j + 1];
                if (typeof nextNum !== "number") throw new Error("Invalid expression");

                switch (op) {
                    case "+": result += nextNum; break;
                    case "-": result -= nextNum; break;
                    case "*": result *= nextNum; break;
                    case "/": 
                        if (nextNum === 0) throw new Error("Division by zero");
                        result /= nextNum; 
                        break;
                    default: throw new Error("Unknown operator");
                }
            }
            return result;
        }

        while (expr.includes("(")) {
            let lastOpen = expr.lastIndexOf("(");
            let nextClose = expr.indexOf(")", lastOpen);
            if (nextClose === -1) return { valid: false, error: "Mismatched parentheses" };

            let inside = expr.slice(lastOpen + 1, nextClose);
            let res = evaluateExpression(inside);
            if (!res.valid) return res;

            expr = expr.slice(0, lastOpen) + res.value + expr.slice(nextClose + 1);
        }

        let tokens = [];
        let i = 0;
        while (i < expr.length) {
            let char = expr[i];
            if (/\s/.test(char)) {
                i++;
                continue;
            }
            if (/\d/.test(char)) {
                let numStr = "";
                while (i < expr.length && /\d/.test(expr[i])) {
                    numStr += expr[i];
                    i++;
                }
                tokens.push({ type: "number", value: Number(numStr) });
            } else if ("+-*/".includes(char)) {
                let hasSpaceBefore = i > 0 && /\s/.test(expr[i - 1]);
                let hasSpaceAfter = i < expr.length - 1 && /\s/.test(expr[i + 1]);
                let isUnspaced = !hasSpaceBefore && !hasSpaceAfter;
                tokens.push({ type: "operator", value: char, isUnspaced });
                i++;
            } else {
                return { valid: false, error: "Invalid character" };
            }
        }

        let changed = true;
        while (changed) {
            changed = false;
            for (let j = 0; j < tokens.length; j++) {
                if (tokens[j].type === "operator" && tokens[j].isUnspaced) {
                    let left = tokens[j - 1];
                    let right = tokens[j + 1];
                    if (left && left.type === "number" && right && right.type === "number") {
                        let a = left.value;
                        let b = right.value;
                        let op = tokens[j].value;
                        let res = 0;
                        switch (op) {
                            case "+": res = a + b; break;
                            case "-": res = a - b; break;
                            case "*": res = a * b; break;
                            case "/": 
                                if (b === 0) return { valid: false, error: "Division by zero" };
                                res = a / b; 
                                break;
                        }
                        tokens.splice(j - 1, 3, { type: "number", value: res });
                        changed = true;
                        break;
                    }
                }
            }
        }

        let flatStr = tokens.map(t => t.value).join(" ");
        let finalVal = evalFlat(flatStr);

        return { valid: true, value: finalVal };

    } catch (err) {
        return { valid: false, error: err.message || "Evaluation error" };
    }
}

function extractNumbers(expr) {
    const matches = expr.match(/\d+/g);
    if (!matches) return [];
    return matches.map(Number);
}

function validateCardMatch(usedNumbers, rawCards, mode) {
    function permute(arr) {
        if (arr.length <= 1) return [arr];
        let res = [];
        for (let i = 0; i < arr.length; i++) {
            let current = arr[i];
            let remaining = arr.slice(0, i).concat(arr.slice(i + 1));
            for (let p of permute(remaining)) {
                res.push([current, ...p]);
            }
        }
        return res;
    }

    function canAssign(cards, index, targetSorted, currentAssigned) {
        if (index === cards.length) {
            const sortedCurr = [...currentAssigned].sort((a, b) => a - b);
            return sortedCurr.length === targetSorted.length && sortedCurr.every((v, i) => v === targetSorted[i]);
        }
        const allowed = getCardAllowedValues(cards[index], mode);
        for (const val of allowed) {
            if (canAssign(cards, index + 1, targetSorted, [...currentAssigned, val])) {
                return true;
            }
        }
        return false;
    }

    const cardPerms = permute(rawCards);
    const sortedUsed = [...usedNumbers].sort((a, b) => a - b);

    for (const p of cardPerms) {
        if (canAssign(p, 0, sortedUsed, [])) {
            return true;
        }
    }
    return false;
}

function validateEquation(expr, expectedCards, mode) {
    const evalRes = evaluateExpression(expr);
    if (!evalRes.valid) return { success: false, reason: "syntax" };

    const usedNumbers = extractNumbers(expr).sort((a, b) => a - b);
    if (usedNumbers.length !== expectedCards.length) return { success: false, reason: "count" };

    if (!validateCardMatch(usedNumbers, expectedCards, mode)) {
        return { success: false, reason: "wrong_cards" };
    }

    if (Math.abs(evalRes.value - 24) > 1e-5) {
        return { success: false, reason: "not_24", value: evalRes.value };
    }

    return { success: true, value: evalRes.value };
}

module.exports = {
    group: "fun",
    usage: "24 [mode:casual|chaos] [rounds (0 for infinite)]",

    data: new SlashCommandBuilder()
        .setName("24")
        .setDescription("Play the multiplayer card game 24: type your equation in chat to win!")
        .addStringOption((option) =>
            option
                .setName("mode")
                .setDescription("Game mode (default: casual)")
                .addChoices(
                    { name: "Casual (J,Q,K = 10, Ace = 1 or 11)", value: "casual" },
                    { name: "Chaos (A=1, J=11, Q=12, K=13)", value: "chaos" }
                )
        )
        .addIntegerOption((option) =>
            option
                .setName("rounds")
                .setDescription("Number of rounds (0 for infinite mode, default 3)")
                .setMinValue(0)
                .setMaxValue(100)
        ),

    async execute(ctx) {
        const channelId = ctx.channel.id;
        if (activeGames.has(channelId)) {
            return ctx.respond({
                content: "⚠️ A 24 game is already active in this channel! Finish or end that game before starting a new one.",
                ephemeral: true
            });
        }

        let mode = "casual";
        let roundsTotal = 3;

        const arg0 = ctx.args[0]?.toString().toLowerCase();
        const arg1 = ctx.args[1]?.toString();

        if (arg0 === "casual" || arg0 === "chaos") {
            mode = arg0;
            if (arg1 !== undefined && !isNaN(arg1)) {
                roundsTotal = Math.max(Number(arg1), 0);
            }
        } else if (arg0 !== undefined && !isNaN(arg0)) {
            roundsTotal = Math.max(Number(arg0), 0);
        }

        const session = {
            channelId,
            mode,
            roundsTotal,
            isInfinite: roundsTotal === 0,
            currentRound: 1,
            scores: new Map(),
            cards: [],
            gameMessage: null,
            messageCollector: null,
            ended: false,
            hostTag: ctx.author.tag
        };

        activeGames.set(channelId, session);

        const rulesText = mode === "casual"
            ? "📖 **Rules (Casual):** J, Q, K = 10 • Ace = 1 or 11\n💡 *Tip: Unspaced pairs (e.g. `9-8`) are prioritized first, then other operations evaluate strictly left-to-right (e.g. `5 - 9-8 * 6` = `(5 - 1) * 6`)*"
            : "📖 **Rules (Chaos):** A = 1, J = 11, Q = 12, K = 13\n💡 *Tip: Unspaced pairs (e.g. `9-8`) are prioritized first, then other operations evaluate strictly left-to-right (e.g. `5 - 9-8 * 6` = `(5 - 1) * 6`)*";

        const getScoreboardFields = () => {
            if (session.scores.size === 0) {
                return [{ name: "Scoreboard", value: "No points scored yet.", inline: false }];
            }
            const sorted = [...session.scores.entries()].sort((a, b) => b[1] - a[1]);
            const text = sorted
                .map(([uid, pts], idx) => `${idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"} <@${uid}>: **${pts}** pts`)
                .join("\n");
            return [{ name: "Scoreboard", value: text, inline: false }];
        };

        const getGameEmbed = (statusText = "") => {
            const roundStr = session.isInfinite
                ? `Round ${session.currentRound} (Infinite Mode ♾️)`
                : `Round ${session.currentRound} / ${session.roundsTotal}`;

            return embed({
                color: config.colors.primary,
                title: `🃏 24 Game (${mode.toUpperCase()}) — ${roundStr}`,
                description:
                    `Type your equation in chat using all 4 cards to get **24**!\n\n` +
                    `**Cards:** ${session.cards.map(formatCard).join("   ")}\n\n` +
                    `${rulesText}\n\n` +
                    (statusText ? `${statusText}\n\n` : "") +
                    `First player to type a correct equation in chat wins the round!`,
                fields: getScoreboardFields(),
                footer: `Host: ${session.hostTag} • Type equation in chat`
            });
        };

        const getActionRows = (disabled = false) => {
            return [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("24_end")
                        .setLabel("End Game")
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji("🛑")
                        .setDisabled(disabled)
                )
            ];
        };

        const startRound = async () => {
            if (session.ended) return;

            const gen = generateCards(session.mode);
            session.cards = gen.cards;

            try {
                session.gameMessage = await ctx.channel.send({
                    embeds: [getGameEmbed()],
                    components: getActionRows(false)
                });
            } catch (err) {
                console.error("Failed to send 24 game message:", err);
                activeGames.delete(channelId);
                return;
            }

            const filter = (m) => !m.author.bot && m.channelId === channelId && /[+\-*/()]/.test(m.content);
            const collector = ctx.channel.createMessageCollector({ filter, time: 600000 });
            session.messageCollector = collector;

            let roundWon = false;

            collector.on("collect", async (m) => {
                if (roundWon || session.ended) return;

                const validation = validateEquation(m.content, session.cards, session.mode);

                if (validation.success) {
                    roundWon = true;
                    collector.stop("solved");

                    const currentPts = session.scores.get(m.author.id) || 0;
                    session.scores.set(m.author.id, currentPts + 1);

                    const winMsg = `🎉 **<@${m.author.id}>** solved Round ${session.currentRound} with \`${m.content}\` = 24! (+1 pt)`;

                    try {
                        await m.react("✅");
                    } catch (e) {}

                    try {
                        if (session.gameMessage) {
                            await session.gameMessage.edit({
                                components: getActionRows(true)
                            });
                        }
                    } catch (e) {}

                    if (!session.isInfinite && session.currentRound >= session.roundsTotal) {
                        session.ended = true;
                        activeGames.delete(channelId);

                        const sortedScores = [...session.scores.entries()].sort((a, b) => b[1] - a[1]);
                        const topScore = sortedScores[0][1];
                        const winners = sortedScores.filter(([_, pts]) => pts === topScore).map(([uid]) => `<@${uid}>`);

                        await ctx.channel.send({
                            embeds: [
                                embed({
                                    color: config.colors.success,
                                    title: "🏆 24 Game Finished!",
                                    description: `${winMsg}\n\n🎉 **Final Winner(s):** ${winners.join(", ")} with **${topScore}** points!`,
                                    fields: getScoreboardFields()
                                })
                            ]
                        });
                    } else {
                        session.currentRound++;
                        await ctx.channel.send({
                            embeds: [embed({ color: config.colors.success, title: `Round ${session.currentRound - 1} Completed`, description: winMsg })]
                        });

                        setTimeout(() => {
                            startRound();
                        }, 2500);
                    }
                } else if (validation.reason === "not_24" && extractNumbers(m.content).length === session.cards.length) {
                    try {
                        await m.react("❌");
                    } catch (e) {}
                }
            });
        };

        await ctx.respond({
            content: "🎮 Starting 24 Game...",
            ephemeral: true
        });

        startRound();

        const buttonCollector = ctx.channel.createMessageComponentCollector({
            filter: (i) => i.customId === "24_end" && activeGames.get(channelId) === session,
            time: 600000
        });

        buttonCollector.on("collect", async (i) => {
            if (session.ended) return;
            session.ended = true;
            if (session.messageCollector) session.messageCollector.stop("ended");
            activeGames.delete(channelId);

            const winner = [...session.scores.entries()].sort((a, b) => b[1] - a[1])[0];
            const endText = winner
                ? `🛑 Game ended by <@${i.user.id}>.\n\n🏆 Winner: <@${winner[0]}> with **${winner[1]}** points!`
                : `🛑 Game ended by <@${i.user.id}>. No points scored.`;

            try {
                if (session.gameMessage) {
                    await session.gameMessage.edit({
                        components: getActionRows(true)
                    });
                }
            } catch (e) {}

            await i.update({
                content: null,
                embeds: [
                    embed({
                        color: config.colors.warning,
                        title: "🃏 24 Game Over",
                        description: endText,
                        fields: getScoreboardFields()
                    })
                ],
                components: []
            });
        });
    }
};
