export interface RuntimeSnapshot {
  draining: boolean;
  inFlightRequests: number;
}

export class RequestTracker {
  private draining = false;
  private inFlight = 0;
  private readonly waiters = new Set<() => void>();

  acquire(): (() => void) | null {
    if (this.draining) return null;
    this.inFlight += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.inFlight = Math.max(0, this.inFlight - 1);
      if (this.inFlight === 0) this.notifyWaiters();
    };
  }

  startDraining(): void {
    this.draining = true;
    if (this.inFlight === 0) this.notifyWaiters();
  }

  async drain(timeoutMs: number): Promise<boolean> {
    this.startDraining();
    if (this.inFlight === 0) return true;

    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.waiters.delete(done);
        resolve(true);
      };
      const timer = setTimeout(() => {
        this.waiters.delete(done);
        resolve(false);
      }, Math.max(0, timeoutMs));
      this.waiters.add(done);
    });
  }

  snapshot(): RuntimeSnapshot {
    return {
      draining: this.draining,
      inFlightRequests: this.inFlight,
    };
  }

  private notifyWaiters(): void {
    for (const waiter of this.waiters) waiter();
  }
}
