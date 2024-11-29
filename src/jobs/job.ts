import { SermonDownloaderJob } from "@/jobs/sermon-downloader.job.ts";
import { SermonEmbedderJob } from "@/jobs/sermon-embedder.job.ts";
import log from "@/log.ts";

const jobs: Job[] = [new SermonDownloaderJob(), new SermonEmbedderJob()];

export interface Job {
  run: () => Promise<void>;
  get schedule(): Deno.CronSchedule | string;
}

export function runAllJobs() {
  log.info("Starting crons");
  jobs.forEach((job: Job) => {
    const jobName = job.constructor.name;
    Deno.cron(jobName, job.schedule, () => job.run());
  });
}

export function runJob(name: string) {
  jobs.find((j) => j.constructor.name == name)?.run();
}
