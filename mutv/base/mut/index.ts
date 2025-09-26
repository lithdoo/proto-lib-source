export interface Mut<T> {
    val(): T
    on(listener: () => void): void
    off(listener: () => void): void
}



export abstract class MutBase<T> implements Mut<T> {
    protected abstract value: T
    protected listeners: (() => void)[] = []

    static split(val: Mut<unknown>) {
        const value = val.val()
        if (!value) return []
        if (typeof value !== 'object') return []
        return Object.keys(value).map(name => {
            return {
                name, value: new MutComputed<[unknown], unknown>([val], (t: any) => {
                    return t?.[name]
                })
            }
        })
    }

    on(listener: () => void): void {
        this.listeners = this.listeners
            .filter(v => v !== listener)
            .concat([listener])
    }

    off(listener: () => void): void {
        this.listeners = this.listeners
            .filter(v => v === listener)
    }

    val() {
        return this.value
    }

    computed<S extends any[], R>(
        args: { [K in keyof S]: MutBase<S[K]>; },
        call: (t: T, ...argus: S) => R
    ): MutBase<R> {

        const val = () => {
            const t = this.val()
            const argus = args.map(v => v.val())
            return call(t,...argus as any)
        }

        const s =  new MutVal(val());

        [this,...args].forEach(v=>{
            v.on(()=>{  s.update(val()) })
        })

        return s

    }
}


export class MutVal<T> extends MutBase<T> {
    constructor(protected value: T) {
        super()
    }
    update(value: T) {
        this.value = value
        this.listeners.forEach(v => v())
    }
}


// ['1','2','3'] -> ['2','3']
type Tail<Tuple extends any[]> = ((...args: Tuple) => void) extends ((a: any, ...args: infer T) => void) ? T : never
// ['1','2','3'] -> '1'
type Head<Tuple extends any[]> = Tuple extends [infer Result, ...any[]] ? Result : never
// (['2','3'],'1') -> ['1','2','3']
// type Unshift<Tuple extends any[], Element> = ((a: Element, ...args: Tuple) => void) extends ((...args: infer T) => void) ? T : never

type ArrayMut<S extends any[], Upper extends any[] = []> = Head<S> extends never ? Upper : ArrayMut<Tail<S>, [...Upper, Mut<Head<S>>]>


// type PickMut<S extends Mut<unknown>> = S extends Mut<infer S> ? S : never

// type PickMutArray<S extends Mut<unknown>[]> = { [Key in keyof S]: PickMut<S[Key]> }



export class MutComputed<S extends any[], T> extends MutBase<T> {

    protected value: T

    constructor(
        public watchers: ArrayMut<S>,
        public fn: (...argus: S) => T
    ) {
        super()
        this.value = this.getUpdateVal()
        this.bind()
    }

    private getUpdateVal() {
        const argus = (this.watchers as Mut<unknown>[]).map(v => v.val())
        const val = this.fn(...argus as any)
        return val
    }

    private updateFn = () => {
        this.value = this.getUpdateVal()
    }

    private bind() {
        (this.watchers as Mut<unknown>[]).forEach(v => v.on(this.updateFn))
    }

    private unbind() {
        (this.watchers as Mut<unknown>[]).forEach(v => v.off(this.updateFn))
    }

    destory() {
        this.unbind()
    }

}

export class MutTable<T extends Object> extends MutBase<T> {

    protected value: T

    constructor(private readonly target: { [Key in keyof T]: Mut<T[Key]> }) {
        super()
        this.value = {} as T
        this.updateFn()
        Array.from(Object.values(this.target))
            .forEach((mut: Mut<unknown>) => mut.on(this.updateFn))
    }


    private updateFn = () => {
        this.value = Object.entries(this.target).reduce((res, [key, mut]) => {
            res[key] = mut.val()
            return res
        }, {} as any)
    }

    destroy() {
        Array.from(Object.values(this.target))
            .forEach((mut: Mut<unknown>) => mut.off(this.updateFn))
    }
}