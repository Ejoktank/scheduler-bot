import { DialogPlugin } from "."
import { Context } from "telegraf"

class TelegrafChooser {
    private idx = 0
    constructor (
        private storage: [string, string, () => void][] = []
    ) {}
    option(text:string, f:() => void) {
        this.storage.push([text, `_option${this.idx++}`, f])
        return this
    }
}

interface TelegrafContextPatch {
    tg: {
        select: (text:string, op:(ch:TelegrafChooser) => void) => void
    }
}

export const telegraf: DialogPlugin<Context, TelegrafContextPatch> = (ctx) => ({
    tg: {
        select: (text:string, op:(ch:TelegrafChooser) => void) => {
            const storage: [string, string, () => void][] = []
            const ch = new TelegrafChooser(storage)
            op(ch)
            ctx.choose((o) => {
                for (const [ , payload, action ] of storage) {
                    o.option(payload, action)
                }      
            })
            const buttons = {
                reply_markup: {
                    inline_keyboard: storage.map(([text, callback_data]) => [{ text, callback_data }])
                }
            }
            if (ctx.got.callbackQuery) {
                ctx.got.editMessageText(text, buttons)
            } else {
                ctx.got.reply(text, buttons)
            }
        }
    }
})
