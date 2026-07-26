import type {
  WorkflowEvent,
  WorkflowEventInput,
  WorkflowEventListener,
} from "./types";

/**
 * Synchronous typed Event Emitter for Workflow lifecycle events.
 *
 * @remarks
 * The Emitter assigns a monotonically increasing sequence and ISO timestamp to
 * every event. Listeners run synchronously in subscription order.
 */
export class WorkflowEventEmitter {
  readonly #listeners = new Set<WorkflowEventListener>();
  #sequence = 0;

  /**
   * Subscribes to every Workflow event.
   *
   * @param listener - Callback invoked for each event.
   * @returns A function that removes this subscription.
   */
  on(listener: WorkflowEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.off(listener);
  }

  /**
   * Removes a previously registered listener.
   *
   * @param listener - Callback originally passed to {@link on}.
   * @returns `true` when the listener was registered.
   */
  off(listener: WorkflowEventListener): boolean {
    return this.#listeners.delete(listener);
  }

  /**
   * Adds envelope metadata and synchronously emits an event.
   *
   * @param input - Typed event payload without sequence or timestamp.
   * @returns The complete immutable event delivered to listeners.
   */
  emit(input: WorkflowEventInput): WorkflowEvent {
    const event = Object.freeze({
      ...input,
      sequence: ++this.#sequence,
      timestamp: new Date().toISOString(),
    }) as WorkflowEvent;

    for (const listener of [...this.#listeners]) {
      listener(event);
    }

    return event;
  }

  /**
   * Removes every registered listener.
   */
  clear(): void {
    this.#listeners.clear();
  }

  /**
   * Returns the number of active listeners.
   */
  get listenerCount(): number {
    return this.#listeners.size;
  }
}

