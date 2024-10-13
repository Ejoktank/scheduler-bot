import config from './.env.json';
import { Telegraf, Context } from 'telegraf'
import { callbackQuery, message } from 'telegraf/filters'
import { pulse } from './pulse';
import { create, justCtx } from './dialog';
import { telegraf } from './dialog/plugins';
import { DateTime } from 'luxon'
import { drizzle } from 'drizzle-orm/connect'
import * as $ from './storage/schema'
import { eq, type InferSelectModel } from 'drizzle-orm';
import { DialogText, text } from './text';

interface ScheduleBotContext {
    ctx: Context,
    lang: DialogText,
    user: InferSelectModel<typeof $.user>
}

async function main() {

    const scheduler = pulse()
    const bot = new Telegraf(config.token)

    const db = await drizzle('better-sqlite3', config.database)

    const [use, start, destroy] = create<ScheduleBotContext>()(
        telegraf((x) => x.ctx),
        script => script.clojure(({ lines, state }) => {

            const info = state(() => ({
                dateTime: DateTime.now(),
                caption: null as null | number
            }))

            lines.line('START', e => {
                e.tg.select('На когда создать уведомление?', o => {
                    o.option('Сегодня', () => {
                        info.value.dateTime = DateTime.now().startOf('day');
                        e.goto('SELECT TIME TODAY')
                    })
                    o.option('Завтра', () => {
                        info.value.dateTime = DateTime.now().startOf('day').plus({ day: 1 });
                        e.goto('SELECT TIME')
                    })
                    o.option('Завтра или позже', () => {
                        e.got.ctx.editMessageText('Введите дату в формате DD.MM.YYYY')
                        e.next('ENTER DAY')
                    })
                })
            })
            lines.line('ENTER DAY', e => {
                if (!e.got.ctx.has(message('text'))) {
                    e.got.ctx.reply('Дата не распознана, введите другую дату')
                    e.next('ENTER DAY')
                    return
                }
                const parsed = DateTime.fromFormat(e.got.ctx.message.text, 'dd.MM.yyyy')
                if (!parsed.isValid) {
                    e.got.ctx.reply('Дата не распознана, введите другую дату')
                    e.next('ENTER DAY')
                    return
                }
                if (parsed.diffNow().milliseconds <= 0) {
                    e.got.ctx.reply('Мы не можем напомнить вам в прошлом :( Попробуйте еще раз')
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
                        e.got.ctx.editMessageText('Напечатайте время в формате HH:mm')
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
                        e.got.ctx.editMessageText('Напечатайте время в формате HH:mm')
                        e.next('ENTER TIME')
                    })
                })                
            })
            lines.line('ENTER TIME', e => {
                if (!e.got.ctx.has(message('text'))) {
                    e.got.ctx.reply('Время не распознано, введите другое время')
                    e.next('ENTER TIME')
                    return
                }
                const parsed = DateTime.fromFormat(e.got.ctx.message.text, 'HH:mm')
                if (!parsed.isValid) {
                    e.got.ctx.reply('Время не распознано, введите другое время')
                    e.next('ENTER TIME')
                    return
                }
                info.value.dateTime = info.value.dateTime.plus({ 
                    hours: parsed.hour,
                    minutes: parsed.minute
                })
                if (info.value.dateTime.diffNow().milliseconds < 0) {
                    e.got.ctx.reply('Мы не можем Вам напомнить в прошлом :( Попробуйте еще раз')
                    e.next('ENTER TIME')
                    return
                }
                e.goto('ENTER CAPTION')
            })
            lines.line('ENTER CAPTION', e => {
                const question = 'Отправьте контент напоминания'
                if (e.got.ctx.callbackQuery) {
                    e.got.ctx.editMessageText(question)
                } else {
                    e.got.ctx.reply(question)
                }
                e.suspend(() => {
                    if (!e.got.ctx.has(message())) {
                        e.goto('ENTER CAPTION')
                        return
                    }
                    
                    info.value.caption = e.got.ctx.message.message_id
                    e.goto('CONFIRMATION')
                })
            })
            lines.line('CONFIRMATION', e => {
                if (info.value.caption === null) {
                    console.warn('NO CAPTION!', e.got.ctx.from?.id)
                    return
                }
                const chatId = e.got.ctx.chat?.id
                const userId = e.got.ctx.from?.id
                if (!userId || !chatId) {
                    console.warn('NO ID!', e.got.ctx.from?.id)
                    return
                }

                const delay = info.value.dateTime.diffNow().milliseconds 
                const messageId = info.value.caption

                const message = `Создано новое напоминание на ${info.value.dateTime.toFormat('LLLL dd yyyy HH:mm:ss')}`

                const context = e.got.ctx
                db.insert($.task).values([{
                    userId: e.got.user.id,
                    notificationTime: info.value.dateTime.toJSON(),
                    replyMessageId: messageId
                }]).then(info => {
                    const taskId = info.lastInsertRowid
                    if (context.callbackQuery) {
                        context.editMessageText(message)
                    } else {
                        context.reply(message)
                    }
    
                    scheduler.do(scheduler.gen(), delay, () => {
                        bot.telegram.sendMessage(userId, 'Напоминание!')
                        bot.telegram.forwardMessage(userId, userId, messageId)

                        db.delete($.task).where(eq($.task.id, Number(taskId))).catch(console.error)
                    })
                })
            })
        })
    )

    function enter(title:string) {
        return (ctx:Context) => {
            if (ctx.has(message('text'))) {
                getUserOrRegister(ctx.from.id).then(user => {
                    start(
                        title, 
                        ctx.from.id, 
                        justCtx({
                            ctx,
                            user,
                            lang: text('RU_ru'),
                        })
                    )
                })
            }
        }
    }

    /* ------- ENTRY POINT -------- */
    bot.command('start', enter('START'))
    bot.command('new', enter('START'))
    bot.command('list', ctx => {
        getUserOrRegister(ctx.from.id)
            .then(user => db.select().from($.task).where(eq($.task.userId, user.id)))
            .then(tasks => {
                let message = `Список напоминаний:\n`
                for (const task of tasks) {
                    message += `+ ${task.notificationTime}\n`
                }

                ctx.reply(message)
            })
        
    })
    /* ---------- ENGINE ---------- */
    const CANCELLATION_WORDS = new Set([
        'ОТМЕНА',
        'CANCEL'
    ])
    function getUserOrRegister(telegramId:number) {
        const RECURSIVE_THRESHOLD = 2
        async function ask(count:number): Promise<InferSelectModel<typeof $.user>> {
            if (count > RECURSIVE_THRESHOLD) {
                throw new Error("Enough!")
            }
            const users = await db.select().from($.user)
                .where(eq($.user.telegramId, telegramId))
                .limit(1)

            if (!users.length) {
                await db.insert($.user).values([{
                    telegramId
                }])
                return await ask(count + 1)
            }
            return await Promise.resolve(users[0])
        }
        return ask(0)
    }
    bot.on(message('text'), async ctx => {
        if (CANCELLATION_WORDS.has(ctx.message.text.toUpperCase())) {
            destroy(ctx.from.id)
            ctx.reply('Создание напоминания отменено')
            return
        }
        const user = await getUserOrRegister(ctx.from.id)
        use(
            ctx.from.id, 
            justCtx({
                ctx,
                user,
                lang: text('RU_ru')
            })
        )
    })
    bot.on(callbackQuery('data'), async ctx => {
        ctx.answerCbQuery()
        const user = await getUserOrRegister(ctx.from.id)
        use(ctx.from.id, {
            payload: ctx.callbackQuery.data,
            ctx: {
                ctx,
                user,
                lang: text('RU_ru')
            }
        })
    })

    /* ---------- LAUNCH ---------- */
    scheduler.repeat('KEEP ALIVE', 10 * 60 * 1000,  () => {})
    scheduler.start()
    bot.launch(() => console.log("ONLINE!"))

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
