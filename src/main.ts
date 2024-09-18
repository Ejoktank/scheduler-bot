import config from './.env.json';
import { Telegraf } from 'telegraf'
import { callbackQuery, message } from 'telegraf/filters'

type TelegramId = number | string;
type DialogMode = string;

const DIALOG_STATES: DialogMode[] = [
    "SELECT_DAY",
    "SELECT_TIME",
    "WRITE_NOTIFICATION_MESSAGE",
    "SELECT_CUSTOM_TIME",
];

interface DialogState {
    mode: DialogMode,
    in_time?: number,
    when?: string
}

function main() {

    const dialogState = new Map<TelegramId, DialogState>();

    const bot = new Telegraf(config.token);

    bot.telegram.setMyCommands([
        { command: 'start', description: 'Начать' },
        { command: 'schedule', description: 'Посмотреть расписание' },
    ])

    bot.start((ctx) => {
        ctx.reply("Опять ты! Ладно, жми /schedule, чтобы начать");
    });

    bot.command('schedule', (ctx) => {
        dialogState.set(ctx.from.id, { mode: DIALOG_STATES[0], in_time: 0} );
        ctx.reply('Выбери день', {
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
                ctx.reply("Когда отправить напоминалку?", {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "5 секунд", callback_data: "seconds_5" }],
                            [{ text: "5 минут", callback_data: "minutes_5" }, { text: "15 минут", callback_data: "minutes_15" }],
                            [{ text: "30 минут", callback_data: "minutes_30" }, { text: "1 час", callback_data: "hours_1" }],
                            [{ text: "2 часа", callback_data: "hours_2" }, { text: "3 часа", callback_data: "hours_3" }],
                            [{ text: "Днём", callback_data: "midday" }, { text: "Вечером", callback_data: "evening" }],
                            [{ text: "Перед сном", callback_data: "night" }, { text: "Задать время", callback_data: "set_time" }],
                        ]
                    }
                });                
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[1],
                    in_time: 0
                });
            }
            if (payload === 'schedule_tomorrow' || payload === 'schedule_one_day') {
                ctx.reply("Когда отправить напоминалку?", {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "Утром", callback_data: "morning" }],
                            [{ text: "Днём", callback_data: "midday" }, { text: "Вечером", callback_data: "evening" }],
                            [{ text: "Перед сном", callback_data: "night" }, { text: "Задать время", callback_data: "set_time" }],
                        ]
                    }
                });
                dialogState.delete(ctx.from.id);
            }
        }
        if (mode == DIALOG_STATES[1]) {
            await ctx.answerCbQuery();
            const payload = ctx.callbackQuery.data;
            ctx.reply("Введите сообщение");

            if (payload === 'seconds_5') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    in_time: 1000 * 5
                });
            }
            if (payload === 'minutes_5') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    in_time: 1000 * 60 * 5
                });
            }
            if (payload === 'minutes_15') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    in_time: 1000 * 60 * 15
                });
            }
            if (payload === 'minutes_30') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    in_time: 1000 * 60 * 30
                });
            }
            if (payload === 'hours_1') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    in_time: 1000 * 60 * 60
                });
            }
            if (payload === 'hours_2') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    in_time: 1000 * 60 * 60 * 2
                });
            }
            if (payload === 'hours_3') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    in_time: 1000 * 60 * 60 * 3
                });
            }
            if (payload === 'midday') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    when: "12:00"
                });
            }
            if (payload === 'evening') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    when: "19:00"
                });
            }
            if (payload === 'night') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[2],
                    when: "23:00"
                });
            }
            if (payload === 'set_time') {
                dialogState.set(ctx.from.id, {
                    mode: DIALOG_STATES[3],
                });
            }
        }
        if (mode === DIALOG_STATES[3]) {
            await ctx.answerCbQuery();
            const payload = ctx.callbackQuery.data;
            console.log(payload);

            ctx.reply("Введите время в формате чч:мм");
            dialogState.set(ctx.from.id, {
                mode: DIALOG_STATES[2],
            });
        }
    });

    bot.on(message('text'), async (ctx) => {

        if (!dialogState.has(ctx.from.id)) {
            return;
        }

        const item = dialogState.get(ctx.from.id)!;

        if (item.mode === DIALOG_STATES[2]) {
            const message = ctx.message.text;
            const time = item.in_time;
            
            ctx.reply("Положил напоминалку в очередь. Если хочешь загрузить меня ещё работой, валяй -- /schedule")
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
