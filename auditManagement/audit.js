import { Router } from "express";
import verifyJWT from "../middleware/auth.js";
import poolPromise, { sql } from "../db.js";
import multer from 'multer';
import * as path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';
import xlsx from 'xlsx';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//---fileupload_location
const uploadPath = path.join(__dirname, 'uploads');


// Ensure directory exists
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'))
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const extension = path.extname(file.originalname);
        const uniqueFileName = file.fieldname + "-" + uniqueSuffix + extension;
        cb(null, uniqueFileName);
    }
});

// Uploading storage and validation option
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5 MB
});

// Memory keep file
const memoryUpload = multer({
    storage: multer.memoryStorage()
})


// API SECTION
const audit = Router();

audit.get('/get_audit_type', verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`select * from Mst_Digital_Audit_Type where Active_Status=1`)
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: true, data: 'Internal server error' });
    }
})


// used for add or edit audit types
audit.post('/insert_audit_type', upload.single('file'), verifyJWT, async (req, res) => {
    try {
        const userId = req.user;
        const file = req?.file;
        const auditType = req?.body;
        const Audit_Name = auditType?.Audit_Name;
        const ShortName = auditType?.ShortName;
        const FileName = file?.filename;
        const Active_Status = 1;
        const Created_By = userId;
        const Modify_By = userId;

        // console.log(req.body)
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Audit_Name', Audit_Name)
            .input('ShortName', ShortName)
            .input('FileName', FileName)
            .input('Active_Status', Active_Status)
            .input('Created_By', Created_By)
            .execute('Mst_Digital_Audit_Type_INSERT') //:TODO pending stored procedure
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: true, data: 'Internal server error' });
    }
})


audit.put('/update_audit_type/:id', upload.single('file'), verifyJWT, async (req, res) => {
    try {
        const auditId = req.params.id;
        const userId = req.user;
        const file = req?.file;
        const auditType = req?.body;



        console.log(auditId)
        // console.log(req.body)
        const pool = await poolPromise;

        const validation = await pool.request()
            .input('Audit_Id', auditId)
            .query('select * from Mst_Digital_Audit_Type where Audit_Id=@Audit_Id');

        console.log(validation?.recordset);
        if (validation?.recordset.length === 0) {
            console.log('Updating audit type not exist')
            return res.status(500).json({ success: true, data: 'Audit type not exit' });
        }

        const validData = validation.recordset[0];

        const Audit_Name = auditType?.Audit_Name || validData?.Audit_Name;
        const ShortName = auditType?.ShortName;
        const FileName = file?.filename || validData?.FileName;
        const Modify_By = userId;

        const result = await pool.request()
            .input('Audit_Id', auditId)
            .input('Audit_Name', Audit_Name)
            .input('ShortName', ShortName)
            .input('FileName', FileName)
            .input('Modify_By', Modify_By)
            .execute('Mst_Digital_Audit_Type_UPDATE') //:TODO pending stored procedure

        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error?.message);
        return res.status(500).json({ success: true, data: 'Internal server error' });
    }
})


//===========CHECKSHEET START==============

audit.get('/checksheet/get/:auditId', verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const activeStatus = req.query?.activeStatus || 1;
        const auditId = req.params.auditId;

        const result = await pool.request()
            .input('Audit_Id', auditId)
            .input('Active_Status', activeStatus)
            .query(`
                    SELECT 
                        ac.*, 
                        d.dept_id AS dept_id, 
                        d.dept_name AS dept_name
                    FROM Mst_Audit_Checksheet ac
                    LEFT JOIN mst_department d ON ac.Department = d.dept_id 
                    WHERE Audit_Id=@Audit_Id AND Active_Status=@Active_Status
                `);

        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})

audit.post('/checksheet/insert', memoryUpload.single('file'), verifyJWT, async (req, res) => {
    try {
        // console.log(req.file)
        const workbook = xlsx.read(req.file.buffer, { type: 'array' });

        // Step 1: Validate that the uploaded file has sheets
        if (workbook.SheetNames.length === 0) {
            return res.status(400).json({ error: 'No sheets in the uploaded file.' });
        }

        // Accessing the fisrt sheet by it's name
        const firstSheetName = workbook.SheetNames[0];
        const workSheet = workbook.Sheets[firstSheetName];

        // Validate that the sheet is not empty
        if (!workSheet) {
            return res.status(400).json({ message: 'The sheet is empty or missing data.' });
        }

        const jsonData = xlsx.utils.sheet_to_json(workSheet, { defval: '' });

        if (jsonData.length === 0) {
            return res.status(400).json({ message: 'No data found in the sheet.' });
        }

        // Validate expected columns in the sheet
        const expectedColumns = ['Major_Clause', 'Sub_Clause', 'Check_Point'];
        const actualColumns = Object.keys(jsonData[0]);

        const mismatchedColumns = expectedColumns.filter(col => !actualColumns.includes(col));

        if (mismatchedColumns.length > 0) {
            return res.status(400).json({
                message: `Invalid column names: ${mismatchedColumns.join(', ')}`
            });
        }

        const emptyData = [];
        const validData = [];

        console.log(jsonData);

        jsonData?.forEach((row) => {
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


        const body = req.body;
        const userId = req.user;

        // CHECK SHEET UPLAOD

        const Checksheet_Name = body?.Checksheet_Name;
        const Audit_Id = body?.Audit_Id;
        const Plant = body?.Plant;
        const Department = body?.Department;

        const pool = await poolPromise;


        const validation = await pool.request()
            .input('Audit_Id', Audit_Id)
            .input('Checksheet_Name', Checksheet_Name)
            .input('Plant', Plant)
            .input('Department', Department)
            .query(`
                select * from Mst_Audit_Checksheet 
                WHERE Audit_Id = @Audit_Id
                AND LOWER(Checksheet_Name) = LOWER(@Checksheet_Name)
		        AND Plant = @Plant
		        AND Department = @Department`
            )
        // .query(`
        //     select * from Mst_Audit_Checksheet 
        //     WHERE Audit_Id = @Audit_Id
        //     AND Checksheet_Name = @Checksheet_Name
        //     AND Plant = @Plant
        //     AND Department = @Department`
        // )

        console.log(validation.recordset, "VALIDATION")

        if (validation.recordset.length > 0) {
            return res.status(500).json({
                message: 'Checksheet already exists.',
            });
        }

        const checkSheetInsert = await pool.request()
            .input('Audit_Id', Audit_Id)
            .input('Checksheet_Name', Checksheet_Name)
            .input('Created_By', userId)
            .input('Modify_By', userId)
            .input('Rev_No', 1)
            .input('Plant', Plant)
            .input('Department', Department)
            .execute('Mst_Audit_Checksheet_INSERT')

        // console.log(checkSheetInsert, "CHECKSHEET DATA");
        console.log(body);


        if (!checkSheetInsert?.recordset) {
            return res.status(500).json({
                message: 'Failed to create the audit checksheet. Please try again.',
            });
        }

        console.log(checkSheetInsert?.recordset)

        // CHECK LIST BULK UPLAOD BASED ON CHECKLIST
        const checSheetRecordset = checkSheetInsert?.recordset[0]

        // const checkListRequest = pool.request();
        // const table = new sql.Table("#AuditCheckSheet");
        const table = new sql.Table('#AuditCheckList');
        table.create = true;
        table.columns.add('Audit_Checksheet_Id', sql.Int, { nullable: false });
        table.columns.add('Major_Clause', sql.VarChar(sql.MAX), { nullable: false });
        table.columns.add('Sub_Clause', sql.VarChar(sql.MAX), { nullable: false });
        table.columns.add('Check_Point', sql.VarChar(sql.MAX), { nullable: false });
        table.columns.add('Rev_No', sql.Int, { nullable: false });
        table.columns.add('Active_Status', sql.Bit, { nullable: false });
        table.columns.add('Created_By', sql.VarChar(50), { nullable: false });
        table.columns.add('Modify_By', sql.VarChar(50), { nullable: false });

        validData.forEach((element) => {
            table.rows.add(
                checSheetRecordset?.Audit_Checksheet_Id,
                element?.Major_Clause,
                element?.Sub_Clause,
                element?.Check_Point,
                checSheetRecordset?.Rev_No,
                1,
                userId,
                userId
            )
        })

        console.log('rows', table);
        // console.log('columns', table.columns);
        // console.log('table', table);
        const insertData = await pool.request().bulk(table);
        const resp = await pool.request()
            // .input('Checkpoints', table)
            .execute('Mst_Audit_Checkpoint_INSERT');
        console.log('insertdata', insertData);
        console.log('resp', resp);

        return res.status(200).json({
            success: true,
            Message: 'Checklist Created Successfully',
            checkSheetData: checkSheetInsert?.recordset || null,
            data: jsonData,
            checKListEmptyData: emptyData,
            checkListValidData: validData,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})

audit.put('/checksheet/update', verifyJWT, async (req, res) => {
    try {

        const validData = []
        const emptyData = []

        const body = req.body;
        console.log(body)

        const userId = req.user;
        const Checksheet_Name = body?.Checksheet_Name;
        const Audit_Checksheet_Id = body?.Audit_Checksheet_Id;
        const checkList = body?.checkList;

        const expectedColumns = ['Major_Clause', 'Sub_Clause', 'Check_Point'];

        console.log(checkList)
        checkList?.forEach((row) => {
            // const isEmpty = expectedColumns.every((field) => !row[field] || row[field].toString().trim() === '');
            const isInvalid = expectedColumns.some((field) => {
                const value = row[field];
                return (
                    value === null ||
                    value === undefined ||
                    (typeof value === 'string' && value.trim() === '') // catches spaces
                );
            });

            // console.log(isInvalid)

            if (isInvalid) {
                emptyData.push(row)
            } else {
                validData.push(row)
            }
        })

        if (emptyData.length > 0) {
            return res.status(500).json({
                message: 'Please complete all required fields before submitting.',
                invalidData: emptyData
            });
        }


        const pool = await poolPromise;


        const existNameValidation = await pool.request()
            .input('Audit_Checksheet_Id', Audit_Checksheet_Id)
            .query(`select * from Mst_Audit_Checksheet where Audit_Checksheet_Id = @Audit_Checksheet_Id`)

        const checkSheetNameValidation = existNameValidation?.recordset[0];
        const dbChecksheetName = checkSheetNameValidation?.Checksheet_Name?.trim().toLowerCase();
        const inputChecksheetName = Checksheet_Name?.trim().toLowerCase();

        if (dbChecksheetName !== inputChecksheetName) {
            const validation = await pool.request()
                .input('Audit_Id', checkSheetNameValidation?.Audit_Id)
                .input('Checksheet_Name', Checksheet_Name?.trim())
                .input('Plant', checkSheetNameValidation?.Plant)
                .input('Department', checkSheetNameValidation?.Department)
                .query(`
            SELECT * FROM Mst_Audit_Checksheet 
            WHERE Audit_Id = @Audit_Id
              AND LOWER(Checksheet_Name) = LOWER(@Checksheet_Name)
              AND Plant = @Plant
              AND Department = @Department
        `);

            console.log(validation.recordset, "VALIDATION");

            if (validation.recordset.length > 0) {
                return res.status(500).json({
                    message: 'A checksheet with this name already exists.',
                });
            }
        }

        const checkSheetUpdate = await pool.request()
            .input('Audit_Checksheet_Id', Audit_Checksheet_Id)
            .input('Checksheet_Name', Checksheet_Name)
            .input('Modify_By', userId)
            .execute('Mst_Audit_Checksheet_UPDATE')

        const result = await pool.request()
            .input('Audit_Checksheet_Id', Audit_Checksheet_Id)
            .query(`select * from Mst_Audit_Checksheet where Audit_Checksheet_Id = @Audit_Checksheet_Id`)
        const checkSheetRecordSet = result?.recordset[0];

        // UPDATE ISSUE NED TO FIX
        // Check point updating if new data then it will insert
        await Promise.all(
            validData.map(async (e) => {
                console.log(e)
                await pool.request()
                    .input('Audit_Checksheet_Id', Audit_Checksheet_Id)
                    .input('Audit_Checkpoint_Id', e?.Audit_Checkpoint_Id ? e.Audit_Checkpoint_Id : null)
                    .input('Major_Clause', e.Major_Clause)
                    .input('Sub_Clause', e.Sub_Clause)
                    .input('Check_Point', e.Check_Point)
                    .input('Rev_No', checkSheetRecordSet?.Rev_No)
                    .input('Active_Status', e?.Active_Status === true ? 1 : 0)
                    .input('Modify_By', userId)
                    .input('Created_By', userId)
                    .execute('Mst_Audit_Checkpoint_UPDATE');
            })
        );

        // // console.log(checkSheetInsert, "CHECKSHEET DATA");
        // console.log(body);


        // if (!checkSheetInsert?.recordset) {
        //     return res.status(500).json({
        //         message: 'Failed to create the audit checksheet. Please try again.',
        //     });
        // }

        // console.log(checkSheetInsert?.recordset)

        // // CHECK LIST BULK UPLAOD BASED ON CHECKLIST
        // const checSheetRecordset = checkSheetInsert?.recordset[0]

        // // const checkListRequest = pool.request();
        // // const table = new sql.Table("#AuditCheckSheet");
        // const table = new sql.Table('#AuditCheckList');
        // table.create = true;
        // table.columns.add('Audit_Checksheet_Id', sql.Int, { nullable: false });
        // table.columns.add('Major_Clause', sql.VarChar(sql.MAX), { nullable: false });
        // table.columns.add('Sub_Clause', sql.VarChar(sql.MAX), { nullable: false });
        // table.columns.add('Check_Point', sql.VarChar(sql.MAX), { nullable: false });
        // table.columns.add('Rev_No', sql.Int, { nullable: false });
        // table.columns.add('Active_Status', sql.Bit, { nullable: false });
        // table.columns.add('Created_By', sql.VarChar(50), { nullable: false });
        // table.columns.add('Modify_By', sql.VarChar(50), { nullable: false });

        // validData.forEach((element) => {
        //     table.rows.add(
        //         checSheetRecordset?.Audit_Checksheet_Id,
        //         element?.Major_Clause,
        //         element?.Sub_Clause,
        //         element?.Check_Point,
        //         checSheetRecordset?.Rev_No,
        //         1,
        //         userId,
        //         userId
        //     )
        // })

        // console.log('rows', table);
        // // console.log('columns', table.columns);
        // // console.log('table', table);
        // const insertData = await pool.request().bulk(table);
        // const resp = await pool.request()
        //     // .input('Checkpoints', table)
        //     .execute('Mst_Audit_Checkpoint_INSERT');
        // console.log('insertdata', insertData);
        // console.log('resp', resp);

        // return res.status(200).json({
        //     success: true,
        //     Message: 'Checklist Created Successfully',
        //     checkSheetData: checkSheetInsert?.recordset || null,
        //     data: jsonData,
        //     checKListEmptyData: emptyData,
        //     checkListValidData: validData,
        // });

        return res.status(200).json({ success: true, checSheet: checkSheetUpdate?.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})

audit.put('/checksheet/status_update', verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const body = req?.body;
        const Audit_Checksheet_Id = body?.Audit_Checksheet_Id;
        const Active_Status = body.Active_Status;

        console.log(req.body)
        await pool.request()
            .input("Active_Status", Active_Status)
            .input("Audit_Checksheet_Id", Audit_Checksheet_Id)
            .query(`
                    UPDATE Mst_Audit_Checksheet 
                    SET Active_Status = @Active_Status
                    WHERE Audit_Checksheet_Id = @Audit_Checksheet_Id
                `)

        await pool.request()
            .input("Active_Status", Active_Status)
            .input("Audit_Checksheet_Id", Audit_Checksheet_Id)
            .query(`
                    UPDATE Mst_Audit_Checkpoint
                    SET Active_Status = @Active_Status
                    WHERE Audit_Checksheet_Id = @Audit_Checksheet_Id
                `)

        return res.status(201).json({ success: true, data: "SUCCESS" })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ success: false, data: "Internal server error" })
    }
})

//=========CHECKSHEET END=============




//=========CHECKLIST START==========

audit.get('/checkList/get/:checkSheetId', verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const checkSheetId = req.params.checkSheetId;

        const result = await pool.request()
            .input('Audit_Checksheet_Id', checkSheetId)
            .query('select * from Mst_Audit_Checkpoint where Audit_Checksheet_Id = @Audit_Checksheet_Id');

        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})


//===============Plant and department===========


audit.get('/plant', verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .query('select * from mst_plant where del_status = 0');
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})

audit.get('/department/:plant_id', verifyJWT, async (req, res) => {
    try {
        const plantId = req.params?.plant_id;

        const pool = await poolPromise;
        const result = await pool.request()
            .input('plant_id', plantId)
            .query('select * from mst_department where plant_id = @plant_id AND del_status = 0');
        return res.status(200).json({ success: true, data: result.recordset });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: 'Internal server error' })
    }
})


export default audit;