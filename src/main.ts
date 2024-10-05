import config from './.env.json';
import { Telegraf, Context } from 'telegraf'
import { callbackQuery, message } from 'telegraf/filters'
import { pulse } from './pulse';
import { create, justCtx } from './dialog';
import { telegraf } from './dialog/plugins';
import { DateTime } from 'luxon'

function main() {

    const scheduler = pulse()
    const bot = new Telegraf(config.token)

    const [use, start, destroy] = create<Context>()(
        telegraf,
        script => script.clojure(({ lines, state }) => {

            const info = state(() => ({
                dateTime: DateTime.now(),
                caption: null as null | number
            }))

            lines.line('START', e => {
                e.tg.select('На когда создать уведомление?', (o) => {
                    o.option('Сегодня', () => {
                        info.value.dateTime = DateTime.now().startOf('day');
                        e.goto('SELECT TIME TODAY')
                    })
                    o.option('Завтра', () => {
                        info.value.dateTime = DateTime.now().startOf('day').plus({ day: 1 });
                        e.goto('SELECT TIME')
                    })
                    o.option('Завтра или позже', () => {
                        e.got.editMessageText('Введите дату в формате DD.MM.YYYY')
                        e.next('ENTER DAY')
                    })
                })
            })
            lines.line('ENTER DAY', e => {
                if (!e.got.has(message('text'))) {
                    e.got.reply('Дата не распознана, введите другую дату')
                    e.next('ENTER DAY')
                    return
                }
                const parsed = DateTime.fromFormat(e.got.message.text, 'dd.MM.yyyy')
                if (!parsed.isValid) {
                    e.got.reply('Дата не распознана, введите другую дату')
                    e.next('ENTER DAY')
                    return
                }
                if (parsed.diffNow().milliseconds <= 0) {
                    e.got.reply('Мы не можем напомнить вам в прошлом :( Попробуйте еще раз')
                    e.next('ENTER DAY')
                    return
                }
                info.value.dateTime = parsed.startOf('day')
                e.goto('SELECT TIME')
            })
            lines.line('SELECT TIME TODAY', e => {
                e.tg.select('Укажите время', o => {
                    const today = info.value.dateTime
                    o.option('Через минуту', () => {
                        info.value.dateTime = DateTime.now().plus({ minutes: 1 })
                        e.goto('ENTER CAPTION')
                    })
                    o.option('Через 5 минут', () => {
                        info.value.dateTime = DateTime.now().plus({ minutes: 5 })
                        e.goto('ENTER CAPTION')
                    })
                    o.option('Через час', () => {
                        info.value.dateTime = DateTime.now().plus({ hours: 1 })
                        e.goto('ENTER CAPTION')
                    })

                    const morning = today.plus({ hours: 8 })
                    const dayDay = today.plus({ hours: 12 }) 
                    const evening = today.plus({ hours: 18 })
                    const beforeBad = today.plus({ hours: 23 })

                    if (morning.diffNow().milliseconds > 0) {
                        o.option('Утром (08:00)', () => {
                            info.value.dateTime = morning
                            e.goto('ENTER CAPTION')
                        })
                    }
                    if (dayDay.diffNow().milliseconds > 0) {
                        o.option('Днем (12:00)', () => {
                            info.value.dateTime = dayDay
                            e.goto('ENTER CAPTION')
                        })
                    }
                    if (evening.diffNow().milliseconds > 0) {
                        o.option('Вечером (18:00)', () => {
                            info.value.dateTime = evening
                            e.goto('ENTER CAPTION')
                        })
                    }
                    if (beforeBad.diffNow().milliseconds > 0) {
                        o.option('На сон грядущий (23:00)', () => {
                            info.value.dateTime = beforeBad
                            e.goto('ENTER CAPTION')
                        })
                    }

                    o.option('Напишу время', () => {
                        e.got.editMessageText('Напечатайте время в формате HH:mm')
                        e.next('ENTER TIME')
                    })
                })
            })
            lines.line('SELECT TIME', e => {
                e.tg.select('Выберите время', o => {
                    o.option('Утром (08:00)', () => {
                        info.value.dateTime = info.value.dateTime.plus({
                            hours: 8
                        })
                        e.goto('ENTER CAPTION')
                    })
                    o.option('Днем (12:00)', () => {
                        info.value.dateTime = info.value.dateTime.plus({
                            hours: 12
                        })
                        e.goto('ENTER CAPTION')
                    })
                    o.option('Вечером (18:00)', () => {
                        info.value.dateTime = info.value.dateTime.plus({
                            hours: 18
                        })
                        e.goto('ENTER CAPTION')
                    })
                    o.option('На сон грядущий (23:00)', () => {
                        info.value.dateTime = info.value.dateTime.plus({
                            hours: 23
                        })
                        e.goto('ENTER CAPTION')
                    })
                    o.option('Напишу время', () => {
                        e.got.editMessageText('Напечатайте время в формате HH:mm')
                        e.next('ENTER TIME')
                    })
                })                
            })
            lines.line('ENTER TIME', e => {
                if (!e.got.has(message('text'))) {
                    e.got.reply('Время не распознано, введите другое время')
                    e.next('ENTER TIME')
                    return
                }
                const parsed = DateTime.fromFormat(e.got.message.text, 'HH:mm')
                if (!parsed.isValid) {
                    e.got.reply('Время не распознано, введите другое время')
                    e.next('ENTER TIME')
                    return
                }
                info.value.dateTime = info.value.dateTime.plus({ 
                    hours: parsed.hour,
                    minutes: parsed.minute
                })
                if (info.value.dateTime.diffNow().milliseconds < 0) {
                    e.got.reply('Мы не можем Вам напомнить в прошлом :( Попробуйте еще раз')
                    e.next('ENTER TIME')
                    return
                }
                e.goto('ENTER CAPTION')
            })
            lines.line('ENTER CAPTION', e => {
                e.got.reply('Отправьте контент напоминания')
                e.suspend(() => {
                    if (!e.got.has(message())) {
                        e.goto('ENTER CAPTION')
                        return
                    }
                    
                    info.value.caption = e.got.message.message_id
                    e.goto('CONFIRMATION')
                })
            })
            lines.line('CONFIRMATION', e => {
                if (info.value.caption === null) {
                    console.warn('NO CAPTION!', e.got.from?.id)
                    return
                }
                const chatId = e.got.chat?.id
                const userId = e.got.from?.id
                if (!userId || !chatId) {
                    console.warn('NO ID!', e.got.from?.id)
                    return
                }
                const message = `Создано новое напоминание на ${info.value.dateTime.toFormat('LLLL dd yyyy HH:mm:ss')}`
                if (e.got.callbackQuery) {
                    e.got.editMessageText(message)
                } else {
                    e.got.reply(message)
                }

                const delay = info.value.dateTime.diffNow().milliseconds 
                const messageId = info.value.caption

                scheduler.do(scheduler.gen(), delay, () => {
                    bot.telegram.sendMessage(userId, 'Напоминание!')
                    bot.telegram.forwardMessage(userId, userId, messageId)
                })
            })
        })
    )

    function enter(title:string) {
        return (ctx:Context) => {
            if (ctx.has(message('text'))) {
                start(title, ctx.from.id, justCtx(ctx))
            }
        }
    }

    /* ------- ENTRY POINT -------- */
    bot.command('start', enter('START'))
    bot.command('new', enter('START'))

    const CANCELLATION_WORDS = new Set([
        'ОТМЕНА',
        'CANCEL'
    ])
    /* ---------- ENGINE ---------- */
    bot.on(message('text'), ctx => {
        if (CANCELLATION_WORDS.has(ctx.message.text.toUpperCase())) {
            destroy(ctx.from.id)
            ctx.reply('Создание напоминания отменено')
            return
        }
        use(ctx.from.id, justCtx(ctx))
    })
    bot.on(callbackQuery('data'), ctx => {
        ctx.answerCbQuery()
        use(ctx.from.id, {
            payload: ctx.callbackQuery.data,
            ctx
        })
    })

    /* ---------- LAUNCH ---------- */
    scheduler.repeat('KEEP ALIVE', 10 * 60 * 1000,  () => {})
    scheduler.start()
    bot.launch(() => console.log("ONLINE!"));

    /* --------- SHUTDOWN --------- */
    process.once('SIGINT', () => {
        scheduler.stop()
        bot.stop('SIGINT')
        console.log()
    })
    process.once('SIGTERM', () => {
        scheduler.stop()
        bot.stop('SIGTERM')
        console.log()
    })
}

main();
