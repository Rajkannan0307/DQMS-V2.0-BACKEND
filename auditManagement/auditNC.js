import { Router } from "express";
import verifyJWT from "../middleware/auth.js";
import poolPromise from "../db.js";
import { NcActionType, TableName, trnAuditNcStatus } from "./utils/utils.js";

const auditNc = Router();

// Listing the Unique NC Data
auditNc.get("/get", verifyJWT, async (req, res) => {
    try {
        const userId = req.user;
        const status = req.query.status
        console.log(status)
        const statusMap = {
            OPEN: [trnAuditNcStatus.OPEN, trnAuditNcStatus.QUERY, trnAuditNcStatus.SUBMITTED],
            CLOSED: [trnAuditNcStatus.APPROVED],
        };

        const groupStatus = statusMap[status] || [];
        console.log(groupStatus)

        const grpStatusQuery = groupStatus.map((e) => `'${e}'`).join(', ');
        console.log(grpStatusQuery)

        const pool = await poolPromise;
        const result = await pool.request()
            .input("userId", userId)
            .query(`
                WITH RankedNC AS (
                    SELECT
                        nc.*,
                        mp.plant_name,
                        mat.Audit_Name AS audit_type_name,
                        sd.audit_scope,
                        sd.audit_date,
                        sh.audit_name,
                        auditor.emp_name AS nc_auditor_name,
                        auditee.emp_name AS nc_auditee_name,
                        tac.comments,
                        dept.dept_name,

                        -- Generates a row number for each record within the same schedule_detail_id group,
                        -- ordering them by audit_nc_id in descending order (latest record first)
                        ROW_NUMBER() OVER (PARTITION BY nc.schedule_detail_id ORDER BY nc.audit_nc_id DESC) AS rn
                    FROM ${TableName.trn_audit_nc} AS nc
                    LEFT JOIN ${TableName.mst_plant} AS mp ON mp.plant_id = nc.plant_id
                    LEFT JOIN ${TableName.Mst_Digital_Audit_Type} AS mat ON mat.Audit_Id = nc.audit_type_id
                    LEFT JOIN ${TableName.Trn_audit_schedule_details} AS sd ON sd.schedule_detail_id = nc.schedule_detail_id
                    LEFT JOIN ${TableName.Trn_sudit_schedule_header} AS sh ON sh.schedule_id = sd.schedule_id
                    LEFT JOIN ${TableName.mst_employees} AS auditor ON auditor.gen_id = nc.nc_auditor
                    LEFT JOIN ${TableName.mst_employees} AS auditee ON auditee.gen_id = nc.nc_auditee
                    LEFT JOIN ${TableName.trn_auditor_comments} AS tac ON tac.schedule_detail_id = nc.schedule_detail_id
                    LEFT JOIN ${TableName.mst_department} AS dept ON dept.dept_id = nc.dept_id
                    WHERE (nc.nc_auditor = @userId OR nc.nc_auditee = @userId) AND nc.nc_status IN (${grpStatusQuery})
                )
                
                -- Selects only the latest (most recent) record for each schedule_detail_id group
                SELECT * FROM RankedNC WHERE rn = 1
              `)
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})


auditNc.get("/edit_nc_data", verifyJWT, async (req, res) => {
    try {
        const userId = req.user;
        const auditId = req.query?.auditId;
        const plantId = req.query?.plantId;
        const deptId = req.query?.deptId;
        const schedule_detail_id = req.query?.scheduleDetailsId;

        const pool = await poolPromise;


        const checkSheetDataResult = await pool
            .request()
            .input('Audit_Id', auditId)
            .input('Plant', plantId)
            .input('Department', deptId)
            .query(`
                    SELECT 
                    *
                    FROM ${TableName.Mst_Audit_Checksheet} 
                    WHERE Audit_Id=@Audit_Id AND Plant=@Plant AND Department=@Department AND Active_Status=1
                `)

        const checksheet = checkSheetDataResult.recordset[0]

        const result = await pool.request()
            // .input("userId", userId)
            .input("schedule_detail_id", schedule_detail_id)
            .query(`
                    SELECT
                        nc.*,
                        mac.Major_Clause,
                        mac.Sub_Clause,
                        mac.Check_Point
                    FROM ${TableName.trn_audit_nc} AS nc
                    LEFT JOIN ${TableName.Mst_Audit_Checkpoint} AS mac ON mac.Audit_Checkpoint_Id = nc.audit_checkpoint_id
                    ---WHERE nc.nc_auditor = @userId OR nc.nc_auditee = @userId 
                    WHERE nc.schedule_detail_id = @schedule_detail_id
                `)

        return res.status(200).json({ success: true, data: result.recordset, checksheetData: checksheet });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})


auditNc.post("/edit_action", verifyJWT, async (req, res) => {
    try {

        const body = req.body;
        const actionType = body?.actionType;
        const ncdataList = body?.ncAuditDataList || []

        // "nc_root_cause", "nc_action", "target_date", "nc_auditor_comment"

        const auditeeSubmitColumns = ["nc_root_cause", "nc_action", "target_date"]
        if (actionType === NcActionType.auditee_submit) {
            const validate1 = [];
            ncdataList?.forEach((row) => {
                // const isEmpty = expectedColumns.every((field) => !row[field] || row[field].toString().trim() === '');
                const isInvalid = auditeeSubmitColumns.some((field) => {
                    const value = row[field];
                    return (
                        value === null ||
                        value === undefined ||
                        (typeof value === 'string' && value.trim() === '') // catches spaces
                    );
                });
                if (isInvalid) validate1.push(row)
            })

            if (validate1.length > 0) {
                return res.status(400).json({ success: false, data: 'Root cause, corrective action, and target date are mandatory in all NC points.' });
            }
        }

        // For Approve, Query validatiom
        const auditorSubmitColumns = ["nc_auditor_comment"]
        if (actionType === NcActionType.auditor_approve || actionType === NcActionType.auditor_query) {
            const validate2 = [];
            ncdataList?.forEach((row) => {
                // const isEmpty = expectedColumns.every((field) => !row[field] || row[field].toString().trim() === '');
                const isInvalid = auditorSubmitColumns.some((field) => {
                    const value = row[field];
                    return (
                        value === null ||
                        value === undefined ||
                        (typeof value === 'string' && value.trim() === '') // catches spaces
                    );
                });
                if (isInvalid) validate2.push(row)
            })

            if (validate2.length > 0) {
                return res.status(400).json({ success: false, data: 'Auditor comments are mandatory in all NC points.' });
            }
        }

        const pool = await poolPromise;


        await Promise.all(ncdataList?.map(async (e) => {
            await pool.request()
                .input("actionType", actionType)
                .input("audit_nc_id", e?.audit_nc_id)
                .input("nc_root_cause", e?.nc_root_cause)
                .input("nc_action", e?.nc_action)
                .input("target_date", e?.target_date)
                .input("nc_auditor_comment", e?.nc_auditor_comment)
                .execute('trn_audit_nc_UPDATE')
        }))

        return res.status(200).json({ success: true, data: "Success" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})


export default auditNc