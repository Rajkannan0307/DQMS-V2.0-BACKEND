import { Router } from "express";
import verifyJWT from "../middleware/auth.js";
import poolPromise, { sql } from "../db.js";
import nodemailer from "nodemailer";
import { getAuditDateInfo } from "./utils/date.js";
import generateTemplate from "./mailTemplate/generateTemplate.js";
import { AduitConstant, scheduleStatusEnum, TableName, trnParticipantRoleEnum } from "./utils/utils.js";


let mailconfig = nodemailer.createTransport({
    // host: "3.109.243.162",
    host: "10.101.0.10",
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


const auditSchedule = Router();


auditSchedule.get('/getHeader', verifyJWT, async (req, res) => {
    try {
        const audit_id = req.query.audit_id;
        const pool = await poolPromise;
        const result = await pool.request()
            .input("audit_type_id", audit_id)
            .query(`select * from ${TableName.Trn_audit_schedule_header} where audit_type_id=@audit_type_id`)
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})

auditSchedule.post('/header_insert', verifyJWT, async (req, res) => {
    try {
        const body = req.body;
        const {
            plant_id, audit_type_id, audit_name, audit_date
        } = body;

        const userId = req.user;

        const pool = await poolPromise;
        const result = await pool.request()
            .input('plant_id', plant_id)
            .input('audit_type_id', audit_type_id)
            .input('audit_name', audit_name)
            .input('audit_date', audit_date)
            .input('created_by', userId)      // assumed variable exists
            .execute('trn_audit_schedule_header_INSERT');
        return res.status(201).json({ success: true, data: result?.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})

auditSchedule.put('/header_update', verifyJWT, async (req, res) => {
    try {
        const body = req.body;
        const {
            schedule_id, plant_id, audit_type_id, audit_name, audit_date
        } = body;

        const userId = req.user;

        const pool = await poolPromise;
        const result = await pool.request()
            .input('schedule_id', schedule_id)
            // .input('plant_id', plant_id)
            // .input('audit_type_id', audit_type_id)
            .input('audit_name', audit_name)
            .input('audit_date', audit_date)
            .input('modify_by', userId)      // assumed variable exists
            .execute('trn_audit_schedule_header_UPDATE');
        return res.status(200).json({ success: true, data: result?.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})


// =============== Schedule details insert===============

auditSchedule.get('/getDetails', verifyJWT, async (req, res) => {
    try {
        const schedule_id = req.query.schedule_id;
        const pool = await poolPromise;
        const result = await pool.request()
            .input("schedule_id", schedule_id)
            .input("status", scheduleStatusEnum.scheduled)
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

                    FROM trn_audit_schedule_details sd
                    INNER JOIN mst_department AS dept ON dept.dept_id = sd.dept_id
                    WHERE schedule_id = @schedule_id AND status=@status
                `)

        const finalResult = result?.recordset?.map(row => ({
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


auditSchedule.post('/send-mail', verifyJWT, async (req, res) => {
    try {
        const userId = req.user;

        const body = req.body;
        const schedule_id = body?.schedule_id;

        const pool = await poolPromise;

        const sdResult = await pool.request()
            .input('schedule_id', schedule_id)
            .input('status', scheduleStatusEnum.scheduled)
            .query(`
                    SELECT *
                    FROM ${TableName.Trn_audit_schedule_details}
                    WHERE schedule_id=@schedule_id AND status=@status 
                `)
        // const 
        const scheduleDetails = sdResult?.recordset;

        // Schedular validation
        if (scheduleDetails?.length <= 0) {
            return res.status(500).json({ success: false, data: 'Schedular details is empty' });
        }

        const dateInfo = getAuditDateInfo(scheduleDetails);

        console.log(dateInfo)

        const scheduleDetailsIds = scheduleDetails?.map((e) => `'${e?.schedule_detail_id}'`).join(", ")

        const auditUsersResult = await pool.request()
            .input('role', 'Auditor')
            .query(`
                    SELECT *
                    FROM ${TableName.Trn_audit_participants}
                    WHERE schedule_detail_id IN (${scheduleDetailsIds}) 
                    ---AND role=@role
                `)


        const auditUsers = auditUsersResult?.recordset;

        const auditees = auditUsers?.filter((e) => e?.role === "Auditee")
        const auditors = auditUsers?.filter((e) => e?.role === "Auditor")
        // Get list of gen_ids
        const auditeeIds = auditees.map((e) => e?.gen_id);
        const auditorIds = auditors.map((e) => e?.gen_id);

        const formattedList1 = auditors.map((e) => `'${e?.gen_id}'`).join(", ");
        const formattedList2 = auditees.map((e) => `'${e?.gen_id}'`).join(", ");

        console.log(formattedList1, formattedList2)
        const empResult = await pool.request().query(`
                                SELECT *
                                FROM ${TableName.mst_employees}
                                WHERE gen_id IN (${formattedList1}) OR gen_id IN (${formattedList2})
                            `)
        const employees = empResult?.recordset;

        const auditorsList = employees
            .filter((emp) => auditorIds.includes(emp?.gen_id))
            .map((e) => e.emp_name)
            .join(" | ") || "N/A";

        const auditeesList = employees
            .filter((emp) => auditeeIds.includes(emp?.gen_id))
            .map((e) => e.emp_name)
            .join(" | ") || "N/A";

        const toMails = employees?.map((e) => e?.email);
        console.log("employees", toMails);
        if (toMails?.length <= 0) {
            return res.status(500).json({ success: false, data: 'Auditor or Auditee user mail is empty' });
        }

        const shResult = await pool.request()
            .input("schedule_id", schedule_id)
            .query(`
                    SELECT
                    sh.audit_type_id,
                    sh.plant_id,
                    sh.audit_name AS schedularName,
                    auditType.Audit_Name,
                    mp.plant_name
                    FROM ${TableName.Trn_audit_schedule_header} AS sh
                    JOIN ${TableName.Mst_Digital_Audit_Type} AS auditType ON auditType.Audit_Id=sh.audit_type_id
                    JOIN ${TableName.mst_plant} AS mp ON mp.plant_id=sh.plant_id
                    WHERE schedule_id = @schedule_id
                `)

        const scheduleHeader = shResult?.recordset[0];

        const CORP_AdminResult = await pool.request()
            .input('role_id', '5')
            .query(`
                    SELECT 
                    * 
                    FROM ${TableName.mst_employees}
                    WHERE role_id=@role_id
                `)

        const plantHeadResult = await pool.request()
            .input('role_id', '6')
            .input('plant_id', scheduleHeader?.plant_id)
            .query(`
                    SELECT 
                    * 
                    FROM ${TableName.mst_employees}
                    WHERE role_id = @role_id AND plant_id = @plant_id
                `)

        const CORP_Admin = CORP_AdminResult?.recordset;
        const plantHead = plantHeadResult?.recordset;

        console.log("Corp admin", CORP_Admin, "Plant head", plantHead)

        // Combine both arrays
        const allUsers = [...CORP_Admin, ...plantHead];

        // Use a Set to store unique emails
        const uniqueEmailsSet = new Set();

        // Map and filter unique emails
        const ccMails = allUsers
            .map(user => user?.email)
            .filter(email => {
                if (email && !uniqueEmailsSet.has(email)) {
                    uniqueEmailsSet.add(email);
                    return true;
                }
                return false;
            });

        const currentUserResult = await pool.request()
            .input('gen_id', userId)
            .query(`
                    SELECT
                    * 
                    FROM ${TableName.mst_employees}
                    WHERE gen_id = @gen_id
                `)

        const currentUser = currentUserResult?.recordset[0];

        console.log(currentUser);

        const htmlData = generateTemplate({
            variables: {
                audit_type_name: scheduleHeader?.Audit_Name,
                audit_name: scheduleHeader?.schedularName,
                fromDate: dateInfo.fromDate,
                toDate: dateInfo.toDate,
                mandays: `${dateInfo.mandays} ${dateInfo.mandays > 1 ? "Mandays" : "Manday"
                    }`,
                regardsBy: currentUser?.emp_name,
                auditorsList: auditorsList,
                auditeesList: auditeesList,
                applicationLink: AduitConstant.applicationLink //
            },
            fileName: 'scheduleSendMail.html'
        })

        console.log(scheduleHeader)
        const mailPayload = {
            from: "noreplyrml@ranegroup.com",
            to: toMails,
            cc: ccMails,
            // subject: `${scheduleHeader?.Audit_Name} _ ${scheduleHeader?.plant_id} - ${scheduleHeader?.schedularName}`,
            subject: `${scheduleHeader?.plant_name} _ ${scheduleHeader?.Audit_Name} _ ${scheduleHeader?.schedularName}`,
            html: htmlData
        }

        console.log("mailPayload", mailPayload)

        mailconfig.sendMail(mailPayload, async function (error, info) {
            if (error) {
                console.log('Error Sending Mail', error);
            } else {
                console.log("Email sent: " + info.response);

                // update is_email_sent status

                await pool.request()
                    .input('schedule_id', schedule_id)
                    .query(`
                            UPDATE ${TableName.Trn_audit_schedule_header}
                            SET is_email_sent = 1
                            WHERE schedule_id = @schedule_id
                        `)
            }
        })
        return res.status(200).json({ success: true, data: 'success' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})

auditSchedule.post('/details_insert', verifyJWT, async (req, res) => {
    try {
        const body = req.body;
        const {
            schedule_id, dept_id, audit_scope, shift, audit_date,
            auditors, auditees, plant_id, audit_type_id
        } = body;

        const userId = req.user;

        const pool = await poolPromise;

        if (!auditors || !auditees || auditors.length === 0 || auditees.length === 0) {
            return res.status(400).json({
                success: false,
                data: 'Auditors and auditees are required and cannot be empty.'
            });
        }

        if (!plant_id || !audit_type_id || !dept_id) {
            return res.status(400).json({
                success: false,
                body: req.body,
                data: 'Plant Id or Dept Id or Audit Type Id is missing'
            });
        }


        // If there is no checksheet then don't allow
        const checkSheetIsExist = await pool.request()
            .input("Audit_Id", audit_type_id)
            .input("Plant", plant_id)
            .input("Department", dept_id)
            .query(`
                    select * from Mst_Audit_Checksheet 
                    WHERE Audit_Id = @Audit_Id AND Plant=@Plant AND Department=@Department AND Active_Status = 1
                `)

        if (checkSheetIsExist?.recordset?.length === 0) {
            return res.status(400).json({
                success: false,
                body: req.body,
                data: "No active audit checksheet found for the selected audit type, plant, and department.",
            });
        }

        const auditorTable = new sql.Table("#auditorTable")
        auditorTable.create = true;
        auditorTable.columns.add('gen_id', sql.VarChar(10), { nullable: false });

        // data is int of gen_id
        for (var data of auditors) {
            auditorTable.rows.add(data)
        }
        await pool.request().bulk(auditorTable);

        const auditeeTable = new sql.Table("#auditeeTable")
        auditeeTable.create = true;
        auditeeTable.columns.add('gen_id', sql.VarChar(10), { nullable: false });
        // data is int of gen_id
        for (var data of auditees) {
            auditeeTable.rows.add(data)
        }
        await pool.request().bulk(auditeeTable);


        const result = await pool.request()
            .input('schedule_id', schedule_id)
            .input('dept_id', dept_id)
            .input('audit_scope', audit_scope)
            .input('shift', shift)
            .input('audit_date', audit_date)
            .input('created_by', userId)      // assumed variable exists
            .execute('trn_audit_schedule_details_INSERT');

        return res.status(201).json({ success: true, data: result?.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})

auditSchedule.put('/details_update', verifyJWT, async (req, res) => {
    try {
        const body = req.body;
        const {
            schedule_detail_id, dept_id, audit_scope, shift, audit_date,
            auditors, auditees
        } = body;

        const userId = req.user;

        const pool = await poolPromise;

        // 1. Get current status
        const checkResult = await pool.request()
            .input("schedule_detail_id", schedule_detail_id)
            .query(`
                    SELECT status FROM ${TableName.Trn_audit_schedule_details} 
                    WHERE schedule_detail_id = @schedule_detail_id
                `);

        const currentStatus = checkResult?.recordset[0]?.status;

        // 2. Validate status before updating
        if (currentStatus === scheduleStatusEnum.completed) {
            return res.status(400).json({
                success: false,
                data: "Cannot edit. Schedule is already completed."
            });
        }


        if (!auditors || !auditees || auditors.length === 0 || auditees.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Auditors and auditees are required and cannot be empty.'
            });
        }

        const auditorTable = new sql.Table("#auditorTable")
        auditorTable.create = true;
        auditorTable.columns.add('gen_id', sql.VarChar(10), { nullable: false });

        // data is int of gen_id
        for (var data of auditors) {
            auditorTable.rows.add(data)
        }
        await pool.request().bulk(auditorTable);

        const auditeeTable = new sql.Table("#auditeeTable")
        auditeeTable.create = true;
        auditeeTable.columns.add('gen_id', sql.VarChar(10), { nullable: false });
        // data is int of gen_id
        for (var data of auditees) {
            auditeeTable.rows.add(data)
        }
        await pool.request().bulk(auditeeTable);


        console.log("REACHED Auditees", auditeeTable?.rows)
        console.log("REACHED Auditors", auditorTable?.rows)
        // return res.status(500).json({ success: false, data: 'Internal server error' });

        const result = await pool.request()
            .input('schedule_detail_id', schedule_detail_id)
            .input('dept_id', dept_id)
            .input('audit_scope', audit_scope)
            .input('shift', shift)
            .input('audit_date', audit_date)
            .input('modify_by', userId)      // assumed variable exists
            .execute('trn_audit_schedule_details_UPDATE');
        return res.status(200).json({ success: true, data: result?.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})

// Cancelling the audit schedule detials
auditSchedule.put('/remarks-update', verifyJWT, async (req, res) => {
    try {
        const body = req.body;
        const userId = req.user;

        const remarks = body?.remarks;
        const schedule_detail_id = body?.schedule_detail_id;

        const pool = await poolPromise;

        // 1. Get current status
        const checkResult = await pool.request()
            .input("schedule_detail_id", schedule_detail_id)
            .query(`
                    SELECT status FROM ${TableName.Trn_audit_schedule_details} 
                    WHERE schedule_detail_id = @schedule_detail_id
                `);

        const currentStatus = checkResult?.recordset[0]?.status;

        // 2. Validate status before updating
        if (currentStatus === scheduleStatusEnum.completed) {
            return res.status(400).json({
                success: false,
                data: "Cannot cancel. Schedule is already completed."
            });
        }

        const result = await pool.request()
            .input('remarks', remarks)
            .input("status", scheduleStatusEnum.cancelled)
            .input("schedule_detail_id", schedule_detail_id)
            .input("modify_by", userId)
            .input("modify_on", sql.DateTime, new Date())
            .query(`
                    UPDATE ${TableName.Trn_audit_schedule_details} 
                    SET 
                    remarks = @remarks,
                    status = @status,
                    modify_by = @modify_by,
                    modify_on = @modify_on
                    WHERE schedule_detail_id = @schedule_detail_id
                `)
        return res.status(200).json({ success: true, data: result?.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})

// ==== View checkpoints based on checksheet

auditSchedule.get("/view-checkpoints", verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const auditId = req.query?.auditId;
        const plantId = req.query?.plantId;
        const deptId = req.query?.deptId;

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
                    WHERE Audit_Id = @Audit_Id AND Plant = @Plant AND Department = @Department AND Active_Status = 1
                `)

        // console.log(result?.recordset);

        if (result?.recordset?.length <= 0) {
            return res.status(200).json({ success: true, data: [], message: "Checksheet is empty for this Audit_Id, Plant, Department" });
        }

        const checksheet = result?.recordset[0];

        const checkpointResult = await pool
            .request()
            .input('Audit_Checksheet_Id', checksheet?.Audit_Checksheet_Id)
            .query(`
                    SELECT
                    *
                    FROM ${TableName.Mst_Audit_Checkpoint} 
                    WHERE Audit_Checksheet_Id = @Audit_Checksheet_Id AND Active_Status = 1
                `)

        console.log(checkpointResult?.recordset?.length, "checkpointResult")

        return res.status(200).json({ success: true, data: checkpointResult?.recordset, checksheetData: checksheet });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})

export default auditSchedule;