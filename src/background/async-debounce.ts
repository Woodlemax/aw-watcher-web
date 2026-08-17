export interface DebouncedAsyncTask {
  schedule(): void
}

export function createDebouncedAsyncTask(
  task: () => Promise<void>,
  delayMilliseconds: number,
): DebouncedAsyncTask {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let running = false
  let rerun = false

  const run = async () => {
    timeout = undefined
    if (running) {
      rerun = true
      return
    }

    running = true
    try {
      await task()
    } finally {
      running = false
      if (rerun) {
        rerun = false
        schedule()
      }
    }
  }

  const schedule = () => {
    if (timeout !== undefined) clearTimeout(timeout)
    timeout = setTimeout(
      () =>
        void run().catch((error) =>
          console.error('Debounced background task failed:', error),
        ),
      delayMilliseconds,
    )
  }

  return { schedule }
}
