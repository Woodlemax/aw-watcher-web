import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDebouncedAsyncTask } from './async-debounce'

describe('createDebouncedAsyncTask', () => {
  afterEach(() => vi.useRealTimers())

  it('collapses rapid browser changes into one task', async () => {
    vi.useFakeTimers()
    const task = vi.fn(async () => {})
    const debounced = createDebouncedAsyncTask(task, 250)

    debounced.schedule()
    debounced.schedule()
    debounced.schedule()
    await vi.advanceTimersByTimeAsync(249)
    expect(task).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('serializes a change that arrives while the task is running', async () => {
    vi.useFakeTimers()
    let finishFirst: (() => void) | undefined
    const task = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirst = resolve
          }),
      )
      .mockResolvedValue(undefined)
    const debounced = createDebouncedAsyncTask(task, 250)

    debounced.schedule()
    await vi.advanceTimersByTimeAsync(250)
    debounced.schedule()
    await vi.advanceTimersByTimeAsync(250)
    expect(task).toHaveBeenCalledTimes(1)
    finishFirst?.()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(250)
    expect(task).toHaveBeenCalledTimes(2)
  })
})
