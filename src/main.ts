import config from './.env.json';
import { Telegraf } from 'telegraf'
import { callbackQuery, message } from 'telegraf/filters'

type TelegramId = number | string;
type DialogState = string;

const DIALOG_STATES: DialogState[] = [
    "SELECT_DAY",
    "WRITE_NOTIFICATION_MESSAGE",
    "SELECT_TIME"
];

function main() {

    const dialogState = new Map<TelegramId, DialogState>();

    const bot = new Telegraf(config.token);

    bot.start((ctx) => {
        ctx.reply("Здарова!");
    });

    bot.on(callbackQuery('data'), async (ctx) => {
        await ctx.answerCbQuery();

        const payload = ctx.callbackQuery.data
        if (payload === 'one') {
            ctx.reply("Ты нажал на 1");
        }
        if (payload === 'two') {
            ctx.reply("Ты нажал на 2");
        }
        if (payload === 'three') {
            ctx.reply("Ты нажал на 3");
        }
    });

    bot.on(message('text'), async (ctx) => {
        ctx.reply('OK', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '1', callback_data: 'one' }],
                    [{ text: '2', callback_data: 'two' }],
                    [{ text: '3', callback_data: 'three' }]
                ]
            }
        })
    });

    bot.launch(() => console.log("ONLINE!"));

    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

main();
