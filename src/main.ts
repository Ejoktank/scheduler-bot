import config from './.env.json';
import { Telegraf } from 'telegraf'
import { callbackQuery, message } from 'telegraf/filters'

type TelegramId = number | string;
type DialogMode = string;

const DIALOG_STATES: DialogMode[] = [
    "SELECT_DAY",
    "SELECT_TIME",
    "WRITE_NOTIFICATION_MESSAGE",
];

interface DialogState {
    mode: DialogMode,
    time: number
}

function main() {

    const dialogState = new Map<TelegramId, DialogState>();

    const bot = new Telegraf(config.token);

    bot.start((ctx) => {
        ctx.reply("Здарова!");
    });

    bot.command('schedule', (ctx) => {
        dialogState.set(ctx.from.id, { mode: DIALOG_STATES[0], time: 0} );
        ctx.reply('На когда создать sms сообщение', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Сегодня', callback_data: 'schedule_today' }],
                    [{ text: 'Завтра', callback_data: 'schedule_tomorrow' }],
                    [{ text: 'Когда-нибдуь', callback_data: 'schedule_one_day' }],
                ]
            }
        })
    });

    bot.on(callbackQuery('data'), async (ctx) => {

        if (!dialogState.has(ctx.from.id)) {
            return;
        }

        const mode = dialogState.get(ctx.from.id)?.mode;

        if (mode === DIALOG_STATES[0]) {
            await ctx.answerCbQuery();

            const payload = ctx.callbackQuery.data

            if (payload === 'schedule_today') {
                ctx.reply("1", {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "30 секунд", callback_data: "seconds_30" }],
                            [{ text: "15 минут", callback_data: "minutes_15" }],
                            [{ text: "30 минут", callback_data: "minutes_30" }],
                            [{ text: "Задать время", callback_data: "set_time" }],
                        ]
                    }
                });
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[1],
                    time: 0
                });
            }
            if (payload === 'schedule_tomorrow') {
                ctx.reply("2");
                dialogState.delete(ctx.from.id);
            }
            if (payload === 'schedule_one_day') {
                ctx.reply("3");
                dialogState.delete(ctx.from.id);
            }
        }
        if (mode == DIALOG_STATES[1]) {
            await ctx.answerCbQuery();
            const payload = ctx.callbackQuery.data

            if (payload === 'seconds_30') {
                ctx.reply("Введите сообщение");
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    time: 1000 * 5
                });
            }
        }
    });

    bot.on(message('text'), async (ctx) => {

        if (!dialogState.has(ctx.from.id)) {
            return;
        }

        const item = dialogState.get(ctx.from.id)!;

        if (item.mode === DIALOG_STATES[2]) {
            const message = ctx.message.text;
            const time = item.time;
            
            ctx.reply("Поставлено на счетчик")
            setTimeout(() => {
                ctx.reply(message);
            }, time);
        }
    });

    bot.launch(() => console.log("ONLINE!"));

    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

main();
