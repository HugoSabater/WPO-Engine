import { wpoWorker } from './jobs/lighthouse.processor.js';

wpoWorker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} has completed successfully!`);
});

wpoWorker.on('failed', (job, err) => {
  console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});

console.log('[Worker] Lighthouse Asynchronous Worker is running...');
