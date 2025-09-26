import cron from 'node-cron'
import { sentInspectionStatusMail } from '../routes/dashborad/dashboard.js';


// Testing
// */5 * * * * *   --> 5 sec
// 0 8 * * *   -> 8:00 AM every day

// const inspectionStatusCronJob = cron.schedule('*/5 * * * * *', async () => {
const inspectionStatusCronJob = cron.schedule('0 8 * * *', async () => {
    try {
        console.info("Running inspection Status Cron Job...");
        await sentInspectionStatusMail()
        console.info("Inspection Status Cron Job completed successfully ✅...");
    } catch (error) {
        console.error("Inspection status cronjob error", error)
    }
})

export { inspectionStatusCronJob }