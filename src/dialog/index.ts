class DialogClojureRef<Val> {

    static createdId = 0

    private ref: Val
    private unique: string

    constructor (
        public generator: () => Val
    ) {
        this.ref = this.generator()
        this.unique = `${Math.round(Math.random() * 100000)}${Date.now()}${++DialogClojureRef.createdId}`
    }

    id() {
        return this.unique
    }

    reset() {
        this.ref = this.generator()
    }

    value() {
        return this.ref
    }

    update(ref:Val) {
        this.ref = ref
    }
}

class DialogClojureState<Val> {
    
    private constructor(
        private ref: DialogClojureRef<Val>
    ) {}

    get value() {
        return this.ref.value()
    }

    set value(val:Val) {
        this.ref.update(val)
    }

    static make<V>(g:() => V) {
        const ref = new DialogClojureRef(g)
        return [
            new DialogClojureState(ref),
            ref
        ] as const
    }
}

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
interface DialogEnvironment<T> {
    original: T
    sessionWillContinue: boolean
    payload?: string
    refs: DialogClojureRef<unknown>[]
}

interface DialogContinueBox {
    thens: DialogContinue[],
    refs: DialogClojureRef<unknown>[]
}

interface DialogInput<T> {
    ctx: T,
    payload?: string
}

type DialogUnique = number | string
type DialogLineHandler<T, P> = (ctx:DialogContext<T> & P) => void
type DialogContinue = () => void

type DialogDescribeHandler<T, P> = (x:DialogDescriber<T, P>) => void

interface DialogClojureParam<T, P> {
    lines: DialogDescriber<T, P>
    state: <V>(x:() => V) => DialogClojureState<V> 
}
type DialogClojureDescribeHandler<T, P> = (x:DialogClojureParam<T, P>) => void
export type DialogPlugin<Ctx, Patch> = (ctx:DialogContext<Ctx>) => Patch

class DialogDescriber<T, Patch> {

    private storage = new Map<string, [DialogLineHandler<T, Patch>, DialogClojureRef<unknown>[]]>()
    private scope: DialogClojureRef<unknown>[][] = []

    constructor(
        private plugin: DialogPlugin<T, unknown>
    ) {}

    line(title:string, action:DialogLineHandler<T, Patch>) {
        this.storage.set(title, [action, this.scope.flatMap(x => x)]);
        return this
    }

    clojure(action: DialogClojureDescribeHandler<T, Patch>) {
        const refs: DialogClojureRef<unknown>[] = []
        this.scope.push(refs)
        action({
            lines: this,
            state: (x) => {
                const [st, ref] = DialogClojureState.make(x)
                refs.push(ref)
                return st
            }
        })
        this.scope.pop()
        return this
    }

    private render() {

        const continuations = new Map<DialogUnique, DialogContinueBox>()
        const environment = new Map<DialogUnique, DialogEnvironment<T>>()
        const sessions = new Map<DialogUnique, Map<string, unknown>>()

        let wannaGoTo = null as null | [string, DialogContext<T>]

        function withContext(id:DialogUnique, ctx:DialogInput<T>, refs:DialogClojureRef<unknown>[], f:() => void) {
            const env: DialogEnvironment<T> = {
                original: ctx.ctx, 
                payload: ctx.payload,
                sessionWillContinue: false,
                refs
            }
            environment.set(id, env)
            f()
            environment.delete(id)
            return env.sessionWillContinue
        }

        function loadState(id:DialogUnique, refs:DialogClojureRef<unknown>[]) {
            if (!refs.length) {
                return
            }
            const session = sessions.get(id)!
            for (const ref of refs) {
                if (session.has(ref.id())) {
                    ref.update(session.get(ref.id()))
                } else {
                    ref.reset()
                }
            }
        }

        function storeState(id:DialogUnique, refs:DialogClojureRef<unknown>[]) {
            if (!refs.length) {
                return
            }
            const session = sessions.get(id)!
            for (const ref of refs) {
                session.set(ref.id(), ref.value())
            }
        }

        function withState(id:DialogUnique, ctx:DialogInput<T>, refs:DialogClojureRef<unknown>[], f:() => void) {
            loadState(id, refs)
            const willContinue = withContext(id, ctx, refs, f)
            if (willContinue) {
                storeState(id, refs)
            } else {
                sessions.delete(id)
            }
        }

        const destroy = (id:DialogUnique) => {
            continuations.delete(id)
            environment.delete(id)
            sessions.delete(id)
            wannaGoTo = null
        }

        const routine = (id:DialogUnique, ctx:DialogInput<T>) => {
            if (continuations.has(id)) {
                wannaGoTo = null
                const box = continuations.get(id)!
                continuations.delete(id)
                withState(id, ctx, box.refs, () => box.thens.forEach(next => next()))
                while (wannaGoTo !== null) {
                    const [ title, context ] = wannaGoTo as [string, DialogContext<T> & Patch]
                    const item = this.storage.get(title)
                    wannaGoTo = null
                    if (!item) {
                        return
                    }
                    const [ action, refs ] = item
                    if (!sessions.has(id)) {
                        sessions.set(id, new Map())
                    }
                    withState(id, ctx, refs, () => action(context))
                }
            }
        }
        
        const begin = (title:string, id:DialogUnique, ctx:DialogInput<T>) => {
            let context: DialogContext<T> = {
                suspend(action) {
                    if (!continuations.has(id)) {
                        continuations.set(id, { 
                            thens: [],
                            refs: environment.get(id)!.refs
                        })
                    }
                    environment.get(id)!.sessionWillContinue = true
                    continuations.get(id)?.thens.push(action)
                },
                goto: (title) => {
                    environment.get(id)!.sessionWillContinue = true
                    wannaGoTo = [title, context]
                },
                next: (id) => context.suspend(() => context.goto(id)),
                continue: (id) => () => context.goto(id),
                choose: (f) => {
                    const selector = OptionsDescriber.make(f)
                    context.suspend(() => {
                        const payload = environment.get(id)!.payload
                        if (payload) {
                            selector(payload)
                        }
                    })
                },
                get got() {
                    return environment.get(id)!.original
                }
            }

            context = Object.assign(context, this.plugin(context))
            
            continuations.set(id, {
                thens: [() => context.goto(title)],
                refs: []
            })
            routine(id, ctx)
        }

        return [routine, begin, destroy] as const
    }

    static make<T>(f:DialogDescribeHandler<T, {}>) {
        const desc = new DialogDescriber<T, {}>(() => ({}))
        f(desc)
        return desc.render()
    }

    static create<T>() {
        return <P>(plugin:DialogPlugin<T, P>, f:DialogDescribeHandler<T, P>) => {
            const desc = new DialogDescriber<T, P>(plugin)
            f(desc)
            return desc.render()
        }
    }
}

export const make = DialogDescriber.make
export const create = DialogDescriber.create
export function justCtx<T>(c:T): DialogInput<T> {
    return {
        ctx: c
    }
}

//////////////////////////////////////////////
// concept

/* 
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
*/
