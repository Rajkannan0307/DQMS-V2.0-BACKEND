import { Router } from "express";
import verifyJWT from "../middleware/auth.js";
import poolPromise from "../db.js";
import { AduitConstant, NcActionType, TableName, trnAuditNcStatus, trnParticipantRoleEnum } from "./utils/utils.js";
import generateTemplate from "./mailTemplate/generateTemplate.js";
import nodemailer from "nodemailer";


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


const auditNc = Router();

// Listing the Unique NC Data
auditNc.get("/get", verifyJWT, async (req, res) => {
    try {
        const userId = req.user;
        const status = req.query.status
        const is_auditor = req.query.isAuditor
        console.log(status)
        const statusMap = {
            OPEN: [trnAuditNcStatus.OPEN, trnAuditNcStatus.QUERY, trnAuditNcStatus.SUBMITTED],
            CLOSED: [trnAuditNcStatus.APPROVED],
        };

        const groupStatus = statusMap[status] || [];
        console.log(groupStatus)

        const grpStatusQuery = groupStatus.map((e) => `'${e}'`).join(', ');
        console.log(grpStatusQuery)

        let whereClause = "";
        if (is_auditor === "true") {
            whereClause = "nc.nc_auditor = @userId";
        } else {
            whereClause = "nc.nc_auditee = @userId";
        }

        console.log(is_auditor, "whereClause", whereClause)

        const pool = await poolPromise;
        const result = await pool.request()
            .input("userId", userId)
            .input("is_auditor", is_auditor)
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
                    LEFT JOIN ${TableName.Trn_audit_schedule_header} AS sh ON sh.schedule_id = sd.schedule_id
                    LEFT JOIN ${TableName.mst_employees} AS auditor ON auditor.gen_id = nc.nc_auditor
                    LEFT JOIN ${TableName.mst_employees} AS auditee ON auditee.gen_id = nc.nc_auditee
                    LEFT JOIN ${TableName.trn_auditor_comments} AS tac ON tac.schedule_detail_id = nc.schedule_detail_id
                    LEFT JOIN ${TableName.mst_department} AS dept ON dept.dept_id = nc.dept_id
                    ---WHERE (nc.nc_auditor = @userId OR nc.nc_auditee = @userId) AND nc.nc_status IN (${grpStatusQuery})
                    WHERE ${whereClause} AND nc.nc_status IN (${grpStatusQuery})
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

        // TODO: pending 
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

        // Mail action
        // console.log(ncdataList)
        const audit_type_id = ncdataList[0]?.audit_type_id;
        const plant_id = ncdataList[0]?.plant_id;
        const dept_id = ncdataList[0]?.dept_id;
        const schedule_detail_id = ncdataList[0]?.schedule_detail_id;
        const nc_auditor = ncdataList[0]?.nc_auditor;
        const nc_auditee = ncdataList[0]?.nc_auditee;
        const userId = req.user;

        const mailDataResult = await pool.request()
            .input('audit_type_id', audit_type_id)
            .input('plant_id', plant_id)
            .input('dept_id', dept_id)
            .input('schedule_detail_id', schedule_detail_id)
            .input('userId', userId)
            .input('CORP_role_id', '5')
            .input('PLANT_role_id', '6')
            .input('nc_auditor', nc_auditor)
            .input('nc_auditee', nc_auditee)
            .query(`
                    SELECT 
                        MAT.Audit_Name,
                        MP.plant_name,
                        MD.dept_name,
                        sh.audit_name AS schedulerName,
                        emp.emp_name,

                         -- Auditors as nested JSON array
                        (
                            SELECT
                                p.gen_id,
                                e.emp_name,
                                e.email
                            FROM ${TableName.Trn_audit_participants} p
                            INNER JOIN ${TableName.mst_employees} e ON e.gen_id = p.gen_id
                            WHERE p.schedule_detail_id = @schedule_detail_id AND p.role = '${trnParticipantRoleEnum.Auditor}'
                            FOR JSON PATH
                        ) AS auditors,

                        -- Auditees as nested JSON array
                        (
                            SELECT 
                                p.gen_id,
                                e.emp_name,
                                e.email
                            FROM ${TableName.Trn_audit_participants} p
                            INNER JOIN ${TableName.mst_employees} e ON e.gen_id = p.gen_id
                            WHERE p.schedule_detail_id = @schedule_detail_id AND p.role = '${trnParticipantRoleEnum.Auditee}'
                            FOR JSON PATH
                        ) AS auditees,

                        -- CORP_ADMIN nested JSON Array
                        (
                            SELECT
                                gen_id,
                                emp_name,
                                email
                            FROM ${TableName.mst_employees}
                            WHERE role_id=@CORP_role_id AND del_status=0
                            FOR JSON PATH
                        ) as corp_admin,


                        -- PLANT HEAD nested JSON Array
                        (
                            SELECT
                                gen_id,
                                emp_name,
                                email
                            FROM ${TableName.mst_employees}
                            WHERE role_id=@PLANT_role_id AND del_status=0
                            FOR JSON PATH
                        ) as plant_head,

                    auditor.emp_name as auditor_name,
                    auditee.emp_name as auditee_name

                    FROM ${TableName.Mst_Digital_Audit_Type} AS MAT
                    LEFT JOIN ${TableName.mst_plant} AS MP ON MP.plant_id=@plant_id
                    LEFT JOIN ${TableName.mst_department} AS MD ON MD.dept_id=@dept_id
                    LEFT JOIN ${TableName.Trn_audit_schedule_details} AS sd ON sd.schedule_detail_id=@schedule_detail_id
                    LEFT JOIN ${TableName.Trn_audit_schedule_header} AS sh ON sh.schedule_id=sd.schedule_id
                    LEFT JOIN ${TableName.mst_employees} AS emp ON emp.gen_id=@userId
                    LEFT JOIN ${TableName.mst_employees} AS auditor ON auditor.gen_id = @nc_auditor
                    LEFT JOIN ${TableName.mst_employees} AS auditee ON auditee.gen_id = @nc_auditee
                    WHERE MAT.Audit_Id=@audit_type_id
                `)

        console.log(mailDataResult?.recordset[0])
        const auditMailInfo = mailDataResult?.recordset[0];

        // Safely parse all JSON fields
        const auditors = JSON.parse(auditMailInfo?.auditors || '[]');
        const auditees = JSON.parse(auditMailInfo?.auditees || '[]');
        const corpAdmins = JSON.parse(auditMailInfo?.corp_admin || '[]');
        const plantHeads = JSON.parse(auditMailInfo?.plant_head || '[]');

        // CC: corporate admins + plant heads
        const ccMailList = [
            ...corpAdmins.map(e => e?.email).filter(Boolean),
            ...plantHeads.map(e => e?.email).filter(Boolean)
        ];

        // Prepare TO list depending on action type
        let toMailList = [];
        if (actionType === NcActionType.auditee_submit) {
            // Send to all auditors except current user
            toMailList = auditors
                // .filter(a => a.email && a.gen_id !== req.user)
                ?.filter(a => a.email)
                ?.map(a => a.email);
        }
        else if ([NcActionType.auditor_approve, NcActionType.auditor_query].includes(actionType)) {
            // Send to all auditees except current user
            toMailList = auditees
                // .filter(a => a.email && a.gen_id !== req.user)
                .filter(a => a.email)
                .map(a => a.email);
        }


        let htmlData = "";
        let mailSub = "";

        if (actionType === NcActionType.auditee_submit) {
            mailSub = `${auditMailInfo?.plant_name || ""} _ ${auditMailInfo?.Audit_Name} _ ${auditMailInfo?.schedulerName} [${auditMailInfo?.dept_name?.trim()}] - NC Action Submitted`
            htmlData = generateTemplate({
                variables: {
                    auditor_name: auditMailInfo?.auditor_name || "Team",
                    audit_type_name: auditMailInfo?.Audit_Name || "",
                    dept_name: auditMailInfo?.dept_name?.trim() || "",
                    audit_name: auditMailInfo?.schedulerName || "",
                    applicationLink: AduitConstant.applicationLink, //,
                    regardsBy: auditMailInfo?.emp_name || "Rane"
                },
                fileName: 'submission_audit.html'
            })

        } else if (actionType === NcActionType.auditor_approve) {
            mailSub = `${auditMailInfo?.plant_name || ""} _ ${auditMailInfo?.Audit_Name} _ ${auditMailInfo?.schedulerName} [${auditMailInfo?.dept_name?.trim()}] - NC Action Approved`
            htmlData = generateTemplate({
                variables: {
                    auditee_name: auditMailInfo?.auditee_name || "Team",
                    audit_type_name: auditMailInfo?.Audit_Name || "",
                    dept_name: auditMailInfo?.dept_name?.trim() || "",
                    audit_name: auditMailInfo?.schedulerName || "",
                    applicationLink: AduitConstant.applicationLink, //
                    regardsBy: auditMailInfo?.emp_name || "Rane"
                },
                fileName: 'agree_audit.html'
            })
        } else if (actionType === NcActionType.auditor_query) {
            mailSub = `${auditMailInfo?.plant_name || ""} _ ${auditMailInfo?.Audit_Name} _ ${auditMailInfo?.schedulerName} [${auditMailInfo?.dept_name?.trim()}] - NC Action Rejected`
            htmlData = generateTemplate({
                variables: {
                    auditee_name: auditMailInfo?.auditee_name || "Team",
                    audit_type_name: auditMailInfo?.Audit_Name || "",
                    dept_name: auditMailInfo?.dept_name?.trim() || "",
                    audit_name: auditMailInfo?.schedulerName || "",
                    applicationLink: AduitConstant.applicationLink, //
                    regardsBy: auditMailInfo?.emp_name || "Rane"
                },
                fileName: 'reject_audit.html'
            })
        }

        console.log(actionType, htmlData, mailSub)
        // console.log(mailSub)

        const check = [NcActionType.auditee_submit, NcActionType.auditor_approve, NcActionType.auditor_query]
        if (check.find((e) => actionType === e)) {
            // console.log(scheduleHeader)
            const mailPayload = {
                from: "noreplyrml@ranegroup.com",
                to: toMailList,
                cc: ccMailList,
                subject: mailSub,
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
        }

        return res.status(200).json({ success: true, data: "Success" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' });
    }
})


export default auditNc