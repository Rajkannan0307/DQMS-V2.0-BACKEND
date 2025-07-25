import { Router } from "express";
import verifyJWT from "../middleware/auth.js";
import poolPromise, { sql } from "../db.js";

const TableName = {
    Trn_sudit_schedule_header: "trn_audit_schedule_header",
    Trn_audit_schedule_details: "trn_audit_schedule_details",
    Trn_audit_participants: "trn_audit_participants"
}

const auditSchedule = Router();


auditSchedule.get('/getHeader', verifyJWT, async (req, res) => {
    try {
        const audit_id = req.query.audit_id;
        const pool = await poolPromise;
        const result = await pool.request()
            .input("audit_type_id", audit_id)
            .query(`select * from ${TableName.Trn_sudit_schedule_header} where audit_type_id=@audit_type_id`)
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: true, data: 'Internal server error' });
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
        return res.status(500).json({ success: true, data: 'Internal server error' });
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
            .input('plant_id', plant_id)
            .input('audit_type_id', audit_type_id)
            .input('audit_name', audit_name)
            .input('audit_date', audit_date)
            .input('modify_by', userId)      // assumed variable exists
            .execute('trn_audit_schedule_header_UPDATE');
        return res.status(200).json({ success: true, data: result?.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: true, data: 'Internal server error' });
    }
})


// =============== Schedule details insert===============

auditSchedule.get('/getDetails', verifyJWT, async (req, res) => {
    try {
        const schedule_id = req.query.schedule_id;
        const pool = await poolPromise;
        const result = await pool.request()
            .input("schedule_id", schedule_id)
            // .query(`select * from ${TableName.Trn_audit_schedule_details} where schedule_id=@schedule_id`)
            .query(`
                    SELECT 
                    *,
                    -- Auditors as nested JSON array
                    (
                        SELECT 
                            p.gen_id,
                            e.emp_name
                        FROM trn_audit_participants p
                        INNER JOIN mst_employees e ON e.gen_id = p.gen_id
                        WHERE p.schedule_detail_id = sd.schedule_detail_id AND p.role = 'auditor'
                        FOR JSON PATH
                    ) AS auditors,

                    -- Auditees as nested JSON array
                    (
                        SELECT 
                            p.gen_id,
                            e.emp_name
                        FROM trn_audit_participants p
                        INNER JOIN mst_employees e ON e.gen_id = p.gen_id
                        WHERE p.schedule_detail_id = sd.schedule_detail_id AND p.role = 'auditee'
                        FOR JSON PATH
                    ) AS auditees

                    FROM trn_audit_schedule_details sd
                    WHERE schedule_id = @schedule_id
                `)

        const finalResult = result?.recordset?.map(row => ({
            ...row,
            auditors: JSON.parse(row.auditors || '[]'),
            auditees: JSON.parse(row.auditees || '[]')
        }));

        return res.status(200).json({ success: true, data: finalResult });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: true, data: 'Internal server error' });
    }
})


auditSchedule.post('/details_insert', verifyJWT, async (req, res) => {
    try {
        const body = req.body;
        const {
            schedule_id, dept_id, audit_scope, shift, audit_date,
            auditors, auditees
        } = body;

        const userId = req.user;

        const pool = await poolPromise;

        if (!auditors || !auditees || auditors.length === 0 || auditees.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Auditors and auditees are required and cannot be empty.'
            });
        }

        const auditorTable = new sql.Table("#auditorTable")
        auditorTable.create = true;
        auditorTable.columns.add('gen_id', sql.Int, { nullable: false });

        // data is int of gen_id
        for (var data of auditors) {
            auditorTable.rows.add(data)
        }
        await pool.request().bulk(auditorTable);

        const auditeeTable = new sql.Table("#auditeeTable")
        auditeeTable.create = true;
        auditeeTable.columns.add('gen_id', sql.Int, { nullable: false });
        // data is int of gen_id
        for (var data of auditors) {
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
        return res.status(500).json({ success: true, data: 'Internal server error' });
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

        if (!auditors || !auditees || auditors.length === 0 || auditees.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Auditors and auditees are required and cannot be empty.'
            });
        }

        const auditorTable = new sql.Table("#auditorTable")
        auditorTable.create = true;
        auditorTable.columns.add('gen_id', sql.Int, { nullable: false });

        // data is int of gen_id
        for (var data of auditors) {
            auditorTable.rows.add(data)
        }
        await pool.request().bulk(auditorTable);

        const auditeeTable = new sql.Table("#auditeeTable")
        auditeeTable.create = true;
        auditeeTable.columns.add('gen_id', sql.Int, { nullable: false });
        // data is int of gen_id
        for (var data of auditors) {
            auditeeTable.rows.add(data)
        }
        await pool.request().bulk(auditeeTable);


        console.log("REACHED")

        const result = await pool.request()
            .input('schedule_detail_id', schedule_detail_id)
            .input('dept_id', dept_id)
            .input('audit_scope', audit_scope)
            .input('shift', shift)
            .input('audit_date', audit_date)
            .input('modify_by', userId)      // assumed variable exists
            .execute('trn_audit_schedule_details_UPDATE');
        return res.status(201).json({ success: true, data: result?.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: true, data: 'Internal server error' });
    }
})

export default auditSchedule;