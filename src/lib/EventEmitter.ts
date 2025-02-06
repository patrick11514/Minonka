// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventEmitter<Events extends Record<string, (...args: any) => void>> {
    private onceListeners = {} as Record<keyof Events, Events[keyof Events][]>;
    private listeners = {} as Record<keyof Events, Events[keyof Events][]>;

    on<T extends keyof Events>(eventName: T, listener: Events[T]) {
        this.listeners[eventName] = this.listeners[eventName] || [];
        this.listeners[eventName].push(listener);
    }

    once<T extends keyof Events>(eventName: T, listener: Events[T]) {
        this.onceListeners[eventName] = this.onceListeners[eventName] || [];
        this.onceListeners[eventName].push(listener);
    }

    emit<T extends keyof Events>(eventName: T, ...args: Parameters<Events[T]>) {
        const listeners = this.listeners[eventName];
        if (listeners) {
            listeners.forEach((listener) => listener(...Array.from(args)));
        }

        const onceListeners = this.onceListeners[eventName];
        if (onceListeners) {
            onceListeners.forEach((listener) => listener(...Array.from(args)));
            delete this.onceListeners[eventName];
        }
    }

    clearEvent<T extends keyof Events>(eventName: T, listener: Events[T]) {
        //normal
        {
            const index = this.listeners[eventName].findIndex((l) => l === listener);
            if (index > -1) {
                delete this.listeners[eventName][index];
                return;
            }
        }
        //once
        {
            const index = this.onceListeners[eventName].findIndex((l) => l === listener);
            if (index > -1) {
                delete this.onceListeners[eventName][index];
                return;
            }
        }
    }

    clearEvents() {
        this.onceListeners = {} as Record<keyof Events, Events[keyof Events][]>;
        this.listeners = {} as Record<keyof Events, Events[keyof Events][]>;
    }
}
