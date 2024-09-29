import EventEmitter from 'node:events'

class PulseNode {
    constructor(
        public readonly jobs:string[], 
        public readonly time:number,
        public next?:PulseNode
    ) {}
}

const PULSE_CORRECTION_THRESHOLD = 20;
const PULSE_TIMEOUT_THRESHOLD = 20;
const PULSE_EVENTS = {
    FINISHED: 'finished',
    CANCELED: 'canceled'
}

class Pulse {

    private clockTime = 0
    private time = 0
    private jobs = new Map<string, [number, boolean, Function]>()
    private queue?: PulseNode;
    
    private running = false
    private timeout?: NodeJS.Timeout
    private cycleCancel?: () => void 

    private emitter = new EventEmitter();

    private static running?: Pulse
    private children: Pulse[] = [];
    private parent?: Pulse

    constructor() { 
        if (Pulse.running) {
            Pulse.running.children.push(this)
            this.parent = Pulse.running
        }
    }

    private enqueue(delay:number, name:string) {
        const node = new PulseNode([name], this.time + delay);
        this.insert(node);
    }

    private insert(node:PulseNode): PulseNode  {
        if (!this.queue) {
            this.queue = node
            return this.queue;
        }

        let prev = undefined as PulseNode | undefined;
        let current = this.queue;

        while (current.time < node.time) {
            if (!current.next) {
                current.next = node;
                return node;
            }

            prev = current;
            current = current.next;
        }
        if (current.time === node.time) {
            current.jobs.push(...node.jobs)
            return current;
        }

        if (prev) {
            node.next = current;
            prev.next = node;
            return node
        }

        this.queue = node;
        node.next = current;
        return node;
    }

    private pop(): PulseNode | undefined {
        if (this.queue) {
            const node = this.queue;
            this.queue = this.queue.next;
            return node
        }
        return
    }

    private restore(node:PulseNode) {
        node.next = this.queue;
        this.queue = node;
    }

    private begin() {
        const repeatJobs:string[] = []
        for (const [name, [delay, repeat]] of this.jobs) {
            if (repeat) {
                repeatJobs.push(name);
            } else {
                this.enqueue(delay, name);
            }
        }

        this.insert(new PulseNode(repeatJobs, 0));
    }
    
    private notify() {
        if (this.queue === undefined && this.timeout === undefined) {
            this.emitter.emit(PULSE_EVENTS.FINISHED)
        } else {
            this.emitter.emit(PULSE_EVENTS.CANCELED)
        }
    }

    private end() {
        this.queue = undefined
    }

    repeat(name:string, interval:number, f:Function) {
        this.jobs.set(name, [interval, true, f])
        if (this.running) {
            const isOnline = this.timeout !== undefined;
            if (isOnline) {
                clearTimeout(this.timeout);
                this.cycleCancel?.();
                this.timeout = undefined;   
                this.time = Date.now() - this.clockTime;
            }
            this.enqueue(0, name);
            if (isOnline) {
                this.cycle();
            }
        }
        return this;
    }

    do(name:string, after:number, f:Function) {
        this.jobs.set(name, [after, false, f]);
        if (this.running) {
            const isOnline = this.timeout !== undefined;
            if (isOnline) {
                clearTimeout(this.timeout);
                this.cycleCancel?.();
                this.timeout = undefined;
                this.time = Date.now() - this.clockTime;
            }
            this.enqueue(after, name);
            if (isOnline) {
                this.cycle();
            }
        }
        return this;
    }

    private cycle() {
        const node = this.pop();
        
        if (node) {
            let correction = 0;
            const clockTime = Date.now() - this.clockTime;
            const clockTimeDelta = clockTime - this.time;
            if (Math.abs(clockTimeDelta) >= PULSE_CORRECTION_THRESHOLD) {
                correction = clockTimeDelta;
            }
            const dt = node.time - this.time - correction;

            const handler = () => {

                this.timeout = undefined;
                this.cycleCancel = undefined;
                this.time = node.time;

                const jobs = node.jobs
                    .map(e => [e, this.jobs.get(e)!] as const) // can be null
                    .filter(([, box]) => box) // all nulls filtered
                    .map(([name, [ms, repeat, action]]) => [name, ms, repeat, action] as const)

                for (const [ name, ms, repeat, action ] of jobs) {
                    Pulse.running = this;
                    action();
                    Pulse.running = undefined
                    if (repeat) {
                        this.enqueue(ms, name)
                    } else {
                        this.jobs.delete(name);
                    }
                }

                this.cycle();
            }

            if (dt > PULSE_TIMEOUT_THRESHOLD) {
                this.timeout = setTimeout(handler, dt);
                this.cycleCancel = () => this.restore(node);
            } else {
                handler();
            }
        } else {
            this.stop();
        }
    }

    start() {
        if (this.running) {
            return
        }

        this.clockTime = Date.now();
        this.time = 0;
        
        this.running = true;
        this.begin();
        this.cycle();
    }

    stop(recursive = false) {
        if (!this.running) {
            return
        }

        this.notify();
        
        this.end();
        clearInterval(this.timeout)
        this.timeout = undefined
        this.running = false;

        if (this.parent) {
            const idx = this.parent.children.indexOf(this);
            this.parent.children.splice(idx, 1)
        }

        if (recursive) {
            for (const pulse of this.children) {
                pulse.parent = undefined;
                pulse.stop(true);
            }
            this.children = [];
        }
    }

    finished(f:() => void) {
        this.emitter.once(PULSE_EVENTS.FINISHED, f);
    }

    canceled(f:() => void) {
        this.emitter.once(PULSE_EVENTS.CANCELED, f)
    }

    off(event: 'canceled' | 'finished', f:() => void) {
        if (event === 'canceled') {
            this.emitter.off(PULSE_EVENTS.CANCELED, f)
            return
        }
        if (event === 'finished') {
            this.emitter.off(PULSE_EVENTS.FINISHED, f)
            return
        }
    }

    debugPrint() {
        let msg: string[] = [];
        let current = this.queue;
        while (current) {
            msg.push(`[${current.jobs.join(', ')} | ${current.time}]`);
            current = current.next
        }

        console.log("DEBUG", msg.join(' -> '))
    }
    
}

export function pulse() {
    return new Pulse();
}

//////////////////////////////////////////////////////////
// concept

/* test and example 
const p = pulse();

const allStartTime = Date.now();
p.repeat("listen", 5 * 1000, () => {
    console.log(Date.now() - allStartTime, "LOOP");
    const count = Math.floor(Math.random() * 10);

    const startTime = Date.now();
    const pl = pulse();

    console.log("COUNT", count)
    for (let i = 0; i < count; ++i) {
        const delay = Math.floor(Math.random() * 5000);
        pl.do(`job_${i}`, delay, () => {
            console.log(Date.now() - startTime, delay, `JOB #${i}`);
        })
    }

    pl.start();

    pl.finished(() => { 
        console.log("FINISHED")
    })

    pl.canceled(() => {
        console.log("INNER CANCELED");
    })
});

p.canceled(() => {
    console.log("OUTER CANCELED")
})

p.start();

setTimeout(() => {
    p.stop();
}, 500);
*/