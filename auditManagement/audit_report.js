import { Router } from "express"
import verifyJWT from "../middleware/auth.js";
import poolPromise from "../db.js";


const auditReports = Router()


// Get Scheduler headers based on plants
auditReports.get("/schedulerHeader/:plantId", verifyJWT, async (req, res) => {
    try {
        const plant_id = req.params.plantId
        const auditTypeId = req.query.auditTypeId
        // console.log(auditTypeId)
        const pool = await poolPromise;
        const result = await pool.request()
            .input('plant_id', plant_id)
            .input('audit_type_id', auditTypeId)
            .query(`
                    SELECT * FROM trn_audit_schedule_header 
                    WHERE plant_id = @plant_id AND audit_type_id = @audit_type_id
                `)
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})

// For Scheduler header report data 
auditReports.post("/scheduler_report", verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const body = req?.body;

        const schedule_id = body?.schedule_id;
        const from_date = body?.from_date;
        const to_date = body?.to_date;

        const result = await pool.request()
            .input('schedule_id', schedule_id)
            .input('from_date', from_date)
            .input('to_date', to_date)
            .execute('get_audit_schedule_report')

        const finalResult = result?.recordset?.map((e) => {
            if (e?.auditors) e.auditors = JSON.parse(e.auditors)
            if (e?.auditees) e.auditees = JSON.parse(e.auditees)
            return e;
        });

        return res.status(200).json({ success: true, data: finalResult });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})

// For Scheduler header report data 
auditReports.post("/scheduler_report2", verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const body = req?.body;
        console.log(body)
        const audit_type_id = body?.audit_type_id;
        const schedule_id = body?.schedule_id;
        const year = body?.year;
        const plant_id = body?.plant_id;

        const result = await pool.request()
            // .input('audit_type_id', audit_type_id)
            .input('schedule_id', schedule_id)
            .input('year', year)
            .input('plant_id', plant_id)
            .execute('get_audit_schedule_report2')

        const finalResult = result?.recordset?.map((e) => {
            if (e?.auditors) e.auditors = JSON.parse(e.auditors)
            if (e?.auditees) e.auditees = JSON.parse(e.auditees)
            return e;
        });

        console.log(finalResult.length, "Schedule report 2")

        return res.status(200).json({ success: true, data: finalResult });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})

// For Audit result report data 
auditReports.post("/audit_result_report", verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const body = req?.body;

        console.log(body)

        const audit_type_id = body?.audit_type_id;
        const plant_id = body?.plant_id;
        const dept_id = body?.dept_id;
        const from_date = body?.from_date;
        const to_date = body?.to_date;
        console.log(audit_type_id, "audit_type_id")

        const result = await pool.request()
            .input('plant_id', plant_id)
            .input('dept_id', dept_id)
            .input('from_date', from_date)
            .input('to_date', to_date)
            .input('audit_type_id', audit_type_id)
            .execute('get_audit_result_summary')

        const finalResult = result?.recordset?.map((e) => {
            if (e?.nc_auditors) e.nc_auditors = JSON.parse(e.nc_auditors)
            if (e?.nc_auditee) e.nc_auditee = JSON.parse(e.nc_auditee)
            return e;
        });


        const result2 = await pool.request()
            .input('plant_id', plant_id)
            .input('dept_id', dept_id)
            .input('from_date', from_date)
            .input('to_date', to_date)
            .input('audit_type_id', audit_type_id)
            .execute('get_audit_result_details')

        // console.log(result2)

        const finalResult2 = result2?.recordset?.map((e) => {
            if (e?.auditor) e.auditor = JSON.parse(e.auditor)
            if (e?.auditee) e.auditee = JSON.parse(e.auditee)
            return e;
        })

        return res.status(200).json({
            success: true, data: {
                sheet1: finalResult,
                sheet2: finalResult2
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})


auditReports.get("/getYears", verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('GetAuditReportYearRange')
        console.log(result?.recordset)
        return res.status(200).json({ success: true, data: result?.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})

auditReports.post("/get_aduit_full_report", verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const body = req?.body;
        console.log(body)
        const audit_type_id = body?.audit_type_id;
        const schedule_id = body?.schedule_id;
        const year = body?.year;
        const plant_id = body?.plant_id;

        const result = await pool.request()
            .input('audit_type_id', audit_type_id)
            .input('schedule_id', schedule_id)
            .input('year', year)
            .input('plant_id', plant_id)
            .execute('GetAuditFullScheduleReport')

        const finalResult = result?.recordset?.map((e) => {
            if (e?.auditors) e.auditors = JSON.parse(e.auditors)
            if (e?.auditees) e.auditees = JSON.parse(e.auditees)
            if (e?.result) e.result = JSON.parse(e?.result)
            return e;
        });

        console.log(finalResult.length, "Schedule report 2")

        return res.status(200).json({ success: true, data: finalResult });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})

export default auditReports;