import { BulkResult, DocUpdate } from './types'
type WorkerFunction = (tasks: DocUpdate[]) => Promise<BulkResult>;

export function writeQueue(worker: WorkerFunction, payload: number = Infinity): { push(task: DocUpdate): Promise<BulkResult>; } {
  const queue: { task: DocUpdate; resolve: (result: BulkResult) => void; }[] = []
  let isProcessing = false

  async function process() {
    if (isProcessing || queue.length === 0) return
    isProcessing = true

    // Extract the tasks and corresponding resolve functions
    const tasksToProcess = queue.splice(0, payload)
    const updates = tasksToProcess.map(item => item.task)

    // Process the updates with the worker function
    const result = await worker(updates)

    // Resolve the promises for the processed tasks with the result
    tasksToProcess.forEach(task => task.resolve(result))

    isProcessing = false
    void process()
  }

  return {
    push(task: DocUpdate): Promise<BulkResult> {
      return new Promise<BulkResult>((resolve) => {
        queue.push({ task, resolve })
        void process()
      })
    }
  }
}
