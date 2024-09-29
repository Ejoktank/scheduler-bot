
class OptionsDescriber {
    private options = new Map<string, () => void>()

    option (payload:string, action:() => void) {
        this.options.set(payload, action)
    }

    private render() {
        return (payload:string) => {
            if (this.options.has(payload)) {
                this.options.get(payload)!()
            }
        }
    }

    static make(f:(x:OptionsDescriber) => void) {
        const desc = new OptionsDescriber()
        f(desc)
        return desc.render()
    }
}

type DialogCallback = () => void

interface DialogContext<T> {
    suspend: (f:DialogCallback) => void

    goto: (id:string) => void
    next: (id:string) => void
    continue: (id:string) => () => void
    
    choose: (f:(x:OptionsDescriber) => void) => void
    got: T 
}
interface DialogState<T> {
    original: T
    payload?: string
}

interface DialogContinueBox {
    thens: DialogContinue[]
}

interface DialogInput<T> {
    ctx: T,
    payload?: string
}

type DialogUnique = number | string
type DialogLineHandler<T> = (ctx:DialogContext<T>) => void
type DialogContinue = () => void

class DialogDescriber<T> {

    private storage = new Map<string, DialogLineHandler<T>>

    line(title:string, action:DialogLineHandler<T>) {
        this.storage.set(title, action);
        return this
    }

    private render() {

        const continuations = new Map<DialogUnique, DialogContinueBox>()
        const running = new Map<DialogUnique, DialogState<T>>()

        function withContext(id:DialogUnique, ctx:DialogInput<T>, f:() => void) {
            running.set(id, { 
                original: ctx.ctx, 
                payload: ctx.payload
            })
            f()
            running.delete(id)
        }

        const routine = (id:DialogUnique, ctx:DialogInput<T>) => {
            if (continuations.has(id)) {
                const box = continuations.get(id)!
                continuations.delete(id)
                withContext(id, ctx, () => box.thens.forEach(next => next()))
            }
        }
        
        const begin = (title:string, id:DialogUnique, ctx:DialogInput<T>) => {
            const context: DialogContext<T> = {
                suspend(action) {
                    if (!continuations.has(id)) {
                        continuations.set(id, { 
                            thens: [] 
                        })
                    }
                    continuations.get(id)?.thens.push(action)
                },
                goto: (id) => {
                    this.storage.get(id)?.(context);
                },
                next: (id) => context.suspend(() => context.goto(id)),
                continue: (id) => () => context.goto(id),
                choose: (f) => {
                    const selector = OptionsDescriber.make(f)
                    context.suspend(() => {
                        const payload = running.get(id)!.payload
                        if (payload) {
                            selector(payload)
                        }
                    })
                },
                get got() {
                    return running.get(id)!.original
                }
            }
            
            withContext(id, ctx, () => this.storage.get(title)?.(context))
        }

        return [routine, begin] as const
    }

    static make<T>(f:(x:DialogDescriber<T>) => void) {
        const desc = new DialogDescriber<T>()
        f(desc)
        return desc.render()
    }
}

export const make = DialogDescriber.make;
export function justCtx<T>(c:T): DialogInput<T> {
    return {
        ctx: c
    }
}

//////////////////////////////////////////////
// concept

const [use, begin] = make<string>(w => {
    w.line("START", e => {
        console.log("HELLO", e.got)
        e.choose(d => {
            d.option("_one", e.continue("FST"))
            d.option("_two", e.continue("SND"))
        })
    })
    w.line("FST", e => {
        console.log("FST", e.got)
        e.suspend(e.continue("FST"))
    })
    w.line("SND", e => {
        console.log("SND", e.got)
    })
})

begin("START", 4, justCtx("0"))

use(4, { payload: '_two', ctx: "1" })
use(4, justCtx("2"))
use(4, justCtx("3"))
use(4, justCtx("4"))
