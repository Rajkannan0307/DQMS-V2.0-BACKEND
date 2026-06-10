import { inspectionStatusCronJob } from "./dashboardJob.js";
import remainderMailing from "./RemainderMailing.js";


const jobs = [
    // inspectionStatusCronJob,

    //Add more jobs,
    remainderMailing
];

export const startAllJobs = () => {
    jobs.forEach(job => job.start());
    console.log("✅ All cron jobs started...");
};
