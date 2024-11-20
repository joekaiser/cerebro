import { SermonDownloaderJob } from "@/jobs/sermon-downloader.job.ts";
import log from "@/log.ts";

const jobs: Job[] = [new SermonDownloaderJob()];

export interface Job {
  run: () => Promise<void>;
  get schedule(): Deno.CronSchedule | string;
}

export function runAllJobs() {
  jobs.forEach((job: Job) => {
    log.info("Starting crons");
    const jobName = job.constructor.name;
    Deno.cron(jobName, job.schedule, () => job.run());
  });
}

export function runJob(name: string) {
  jobs.find((j) => j.constructor.name == name)?.run();
}
