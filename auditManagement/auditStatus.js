import { Router } from "express";
import verifyJWT from "../middleware/auth.js";
import poolPromise from "../db.js";
import { scheduleStatusEnum, trnParticipantRoleEnum } from "./auditSchedule.js";
import generateTemplate from "./mailTemplate/generateTemplate.js";
import nodemailer from "nodemailer";

// Perform audit section

const TableName = {
    Trn_sudit_schedule_header: "trn_audit_schedule_header",
    Trn_audit_schedule_details: "trn_audit_schedule_details",
    Trn_audit_participants: "trn_audit_participants",

    Mst_Audit_Checkpoint: "Mst_Audit_Checkpoint",
    Mst_Audit_Checksheet: "Mst_Audit_Checksheet",

    mst_department: "mst_department",
    mst_employees: "mst_employees",

    Mst_Digital_Audit_Type: "Mst_Digital_Audit_Type",


    trn_audit_result: "trn_audit_result",

    trn_auditor_comments: "trn_auditor_comments"
}

let mailconfig = nodemailer.createTransport({
    host: "3.109.243.162",
    port: 25,
    secure: false,
    auth: {
        user: "noreplyrml@ranegroup.com",
        pass: "",
    },
    tls: {
        rejectUnauthorized: false,
    },
});



const auditStatus = Router()

// We will get the audit schedule deatils all data based on auditType
auditStatus.get("/get", verifyJWT, async (req, res) => {
    try {
        const userId = req.user;
        const reqQuery = req.query;
        const auditTypeId = reqQuery?.auditTypeId
        const status = reqQuery?.status
        const isAuditeeView = reqQuery?.isAuditeeView;
        console.log(isAuditeeView, "isAuditeeView")

        const pool = await poolPromise;
        // Get the schedule header data
        const result1 = await pool.request()
            .input('audit_type_id', auditTypeId)
            .query(`
                    SELECT 
                    * 
                    FROM ${TableName.Trn_sudit_schedule_header}
                    WHERE audit_type_id = @audit_type_id
                `)
        const scheduleHeader = result1?.recordset || [];
        const scheduleHeaderIds = scheduleHeader?.map((e) => `'${e?.schedule_id}'`).join(", ");
        console.log(scheduleHeaderIds, "scheduleHeaderIds")

        if (scheduleHeaderIds?.length <= 0) {
            return res.status(200).json({ success: true, data: [] });
        }
        // TODO:
        const roleAudit = isAuditeeView === 'true' ? trnParticipantRoleEnum.Auditee : trnParticipantRoleEnum.Auditor
        const participantResult = await pool.request()
            .input("gen_id", userId)
            .input("role", roleAudit)
            // .input("role", trnParticipantRoleEnum.Auditor)
            .query(`
                    SELECT 
                    *
                    FROM ${TableName.Trn_audit_participants} 
                    WHERE gen_id = @gen_id AND role = @role
                `)

        const participants = participantResult?.recordset;

        console.log(participants.length, "participants")
        if (participants?.length <= 0) {
            console.log('No audit schedule found for this auditor')
            return res.status(200).json({ success: true, data: [] });
        }

        const participantsIds = participants?.map((e) => `'${e?.schedule_detail_id}'`).join(", ")


        const result2 = await pool.request()
            // .input("schedule_id", scheduleHeaderIds)
            .input("status", status || scheduleStatusEnum.scheduled)
            .query(`
                    SELECT 
                    sd.schedule_detail_id,
                    sd.schedule_id,
                    sd.dept_id,
                    dept.dept_name,
                    sd.audit_scope,
                    sd.shift,
                    sd.audit_date,
                    sd.created_by,
                    sd.created_on,
                    sd.modify_by,
                    sd.modify_on,
                    sd.status,
                    sh.plant_id,
                    sh.audit_type_id,
                    sh.audit_name,
                    cmd.comments,

                    -- Auditors as nested JSON array
                    (
                        SELECT 
                            p.gen_id,
                            e.emp_name
                        FROM trn_audit_participants p
                        INNER JOIN mst_employees e ON e.gen_id = p.gen_id
                        WHERE p.schedule_detail_id = sd.schedule_detail_id AND p.role = '${trnParticipantRoleEnum.Auditor}'
                        FOR JSON PATH
                    ) AS auditors,

                    -- Auditees as nested JSON array
                    (
                        SELECT 
                            p.gen_id,
                            e.emp_name
                        FROM trn_audit_participants p
                        INNER JOIN mst_employees e ON e.gen_id = p.gen_id
                        WHERE p.schedule_detail_id = sd.schedule_detail_id AND p.role = '${trnParticipantRoleEnum.Auditee}'
                        FOR JSON PATH
                    ) AS auditees

                    FROM ${TableName.Trn_audit_schedule_details} sd
                    INNER JOIN ${TableName.mst_department} AS dept ON dept.dept_id = sd.dept_id
                    INNER JOIN ${TableName.Trn_sudit_schedule_header} AS sh ON sh.schedule_id = sd.schedule_id
                    ---INNER JOIN ${TableName.Mst_Digital_Audit_Type} AS mst_at ON mst_at.Audit_Id = sh.audit_type_id
                    LEFT JOIN ${TableName.trn_auditor_comments} AS cmd ON cmd.schedule_detail_id = sd.schedule_detail_id
                    WHERE sd.schedule_id IN (${scheduleHeaderIds}) AND sd.schedule_detail_id IN (${participantsIds}) AND status=@status
                `)

        const scheduleDeatils = result2?.recordset || [];

        const finalResult = scheduleDeatils?.map(row => ({
            ...row,
            auditors: JSON.parse(row.auditors || '[]'),
            auditees: JSON.parse(row.auditees || '[]')
        }));

        return res.status(200).json({ success: true, data: finalResult });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})

auditStatus.get("/view-results", verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const auditId = req.query?.auditId;
        const plantId = req.query?.plantId;
        const deptId = req.query?.deptId;
        const schedule_details_id = req.query?.scheduleDetailsId;

        const missingFields = [];
        if (!auditId) missingFields.push("auditId");
        if (!plantId) missingFields.push("plantId");
        if (!deptId) missingFields.push("deptId");

        if (missingFields.length > 0) {
            return res.status(500).json({
                success: false,
                message: `Missing required field(s): ${missingFields.join(", ")}`,
            });
        }


        const result = await pool
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


        console.log(result?.recordset);

        if (result?.recordset?.length <= 0) {
            return res.status(200).json({ success: true, data: [], message: "Checksheet is empty for this Audit_Id, Plant, Department" });
        }

        const checksheet = result?.recordset[0];

        const checkpointResult = await pool
            .request()
            .input('Audit_Checksheet_Id', checksheet?.Audit_Checksheet_Id)
            .input('schedule_details_id', schedule_details_id)
            .query(`
                        SELECT 
                        *
                        FROM ${TableName.Mst_Audit_Checkpoint} AS mac
                        LEFT JOIN ${TableName.trn_audit_result} AS tar 
                            ON tar.checkpoint_id = mac.Audit_Checkpoint_Id
                            AND tar.schedule_details_id = @schedule_details_id
                        WHERE Audit_Checksheet_Id=@Audit_Checksheet_Id 
                            AND Active_Status=1
                    `)

        console.log(checkpointResult?.recordset, "checkpointResult")
        console.log(checkpointResult?.recordset?.length, "checkpointResult")

        return res.status(200).json({ success: true, data: checkpointResult?.recordset, checksheetData: checksheet });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})

auditStatus.post('/save_audit_result', verifyJWT, async (req, res) => {
    try {
        const body = req.body;
        // console.log(body)
        const userId = req.user;
        const auditResult = body?.auditResult;
        const schedule_id = body?.schedule_id;
        const schedule_detail_id = body?.schedule_detail_id;
        const plant_id = body?.plant_id;
        const dept_id = body?.dept_id;
        const audit_type_id = body?.audit_type_id;
        const audit_scope = body?.audit_scope;
        const shift = body?.shift;
        const audit_plan_date = body?.audit_plan_date;
        const dept_name = body?.dept_name;
        const audit_name = body?.audit_name;
        const auditees = body?.auditees;
        const auditors = body?.auditors;

        const comments = body?.comments;

        const pool = await poolPromise;

        const expectedColumns = ['ratings', 'observation_remarks'];
        // const actualColumns = Object.keys(auditResult[0]);
        // const mismatchedColumns = expectedColumns.filter(col => !actualColumns.includes(col));

        const emptyData = [];
        const validData = [];

        auditResult?.forEach((row) => {
            // const isEmpty = expectedColumns.every((field) => !row[field] || row[field].toString().trim() === '');
            const isInvalid = expectedColumns.some((field) => {
                const value = row[field];
                return (
                    value === null ||
                    value === undefined ||
                    (typeof value === 'string' && value.trim() === '') // catches spaces
                );
            });
            if (isInvalid) {
                emptyData.push(row)
            } else {
                validData.push(row)
            }
        })

        if (emptyData.length > 0) {
            return res.status(500).json({
                message: 'Uploaded File Contains Blank Columns',
                invalidData: emptyData
            });
        }


        //Based on the schedule detail id and checkpoint id it will update
        for (let data of validData) {
            await pool.request()
                .input('schedule_id', schedule_id)
                .input('schedule_details_id', schedule_detail_id)
                .input('plant_id', plant_id)
                .input('dept_id', dept_id)
                .input('audit_type_id', audit_type_id)
                .input('audit_scope', audit_scope)
                .input('shift', shift)
                .input('audit_plan_date', audit_plan_date)
                .input('checksheet_id', data?.Audit_Checksheet_Id)
                .input('checkpoint_id', data?.Audit_Checkpoint_Id)
                .input('ratings', data?.ratings)
                .input('observation_remarks', data?.observation_remarks)
                .input('audited_by', userId)
                .input('modify_by', userId)
                .execute('trn_audit_result_UPSERT')
        }

        // Updating the complete status
        await pool.request()
            .input('status', scheduleStatusEnum.completed)
            .input('schedule_details_id', schedule_detail_id)
            .query(`
                    UPDATE ${TableName.Trn_audit_schedule_details}
                    SET
                    status = @status
                    WHERE schedule_detail_id = @schedule_details_id
                `)

        // Updating auditor comments 
        await pool.request()
            .input('schedule_detail_id', schedule_detail_id)
            .input('comments', comments)
            .execute('trn_auditor_comments_UPSERT')



        // MAIL SENDING SECTION


        console.log(userId, "userId")

        const currentUserResult = await pool.request()
            .input("gen_id", userId)
            .query(`
                    SELECT
                    *
                    FROM ${TableName.mst_employees}
                    WHERE gen_id = @gen_id
                `)

        const currentUser = currentUserResult?.recordset[0];
        const auditTypeResult = await pool.request()
            .input('Audit_Id', audit_type_id)
            .query(`
                    SELECT * FROM ${TableName.Mst_Digital_Audit_Type}
                    WHERE Audit_Id = @Audit_Id
                `)


        //TO EMAIL DATA
        // const formattedList1 = auditors.map((e) => `'${e?.gen_id}'`).join(", ");
        const formattedList2 = auditees.map((e) => `'${e?.gen_id}'`).join(", ");
        console.log(formattedList2)
        const empResult = await pool.request().query(`
                                SELECT *
                                FROM ${TableName.mst_employees}
                                WHERE gen_id IN (${formattedList2})
                            `)
        const employees = empResult?.recordset;

        const toMails = employees?.map((e) => e?.email);


        // CC Extract section
        const ccResult = await pool.request()
            .input('plant_id', plant_id)
            .query(`
                    SELECT * FROM ${TableName.mst_employees}
                    WHERE role_id = '5'
                    UNION
                    SELECT * FROM ${TableName.mst_employees}
                    WHERE role_id = '5' AND plant_id = @plant_id
                `);

        const allUsers = ccResult?.recordset || [];

        // Extract unique emails
        const uniqueCCEmails = Array.from(
            new Set(allUsers.map(user => user?.email).filter(Boolean))
        );

        const htmlData = generateTemplate({
            variables: {
                auditTypeName: auditTypeResult?.recordset[0]?.Audit_Name,
                dept_name: dept_name,
                audit_name: audit_name,
                regardsBy: currentUser?.emp_name
            },
            fileName: "after_audit.html"
        })


        const mailPayload = {
            from: "noreplyrml@ranegroup.com",
            to: toMails,
            cc: uniqueCCEmails,
            subject: `${auditTypeResult?.recordset[0]?.Audit_Name} _ ${plant_id} - ${audit_name} _ ${dept_name}`,
            html: htmlData
        }

        console.log("mailPayload", mailPayload)

        mailconfig.sendMail(mailPayload, function (error, info) {
            if (error) {
                console.log('Error Sending Mail', error);
            } else {
                console.log("Email sent: " + info.response);
            }
        })
        return res.status(201).json({ success: true, data: 'success' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})


export default auditStatus;