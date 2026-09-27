import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SYNC_QUEUE, SyncService } from './sync.service';

interface SyncJobData {
  runId: string;
}

/**
 * Runs sync jobs off the request thread. A full register pull downloads ~7 MB
 * and compares ~13k rows, which is far too long for an HTTP request — the API
 * queues a `sync_run` and the UI polls it.
 *
 * Concurrency 1 on purpose: two register pulls would diff the same rows against
 * each other's half-applied output. `SyncService.queueRun` also refuses a second
 * run of the same kind, so this is the backstop, not the only guard.
 */
@Processor(SYNC_QUEUE, { concurrency: 1 })
export class SyncProcessor extends WorkerHost {
  private readonly log = new Logger(SyncProcessor.name);

  constructor(private readonly sync: SyncService) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    const { runId } = job.data;
    this.log.log(`Processing ${job.name} run ${runId}`);
    switch (job.name) {
      case 'cricos_register':
        await this.sync.executeCricosRun(runId);
        return;
      case 'site_scrape':
        await this.sync.executeSiteScrapeRun(runId);
        return;
      default:
        // ai_curation arrives in a later phase; fail loudly rather than
        // silently marking the run complete.
        throw new Error(`Unsupported sync job "${job.name}"`);
    }
  }
}
