import { inspectionStatusCronJob } from "./dashboardJob.js";


const jobs = [
    inspectionStatusCronJob,

    //Add more jobs
];

export const startAllJobs = () => {
    jobs.forEach(job => job.start());
    console.log("✅ All cron jobs started...");
};
