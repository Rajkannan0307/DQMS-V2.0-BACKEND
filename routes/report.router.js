import { response, Router } from "express";
import poolPromise from "../db.js";
import verifyJWT from "../middleware/auth.js";

let report = Router();

report.get('/Get_Inspection_Type', verifyJWT, async (req, res) => {
    console.log('Report Part Number', req.query);
    try {
        const From = req.query.from;
        const To = req.query.to;

        const pool = await poolPromise;
        const result = await pool.request()
            .input('From', From)
            .input('To', To)
            .execute('GetCheckType')

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(400).json(error);
    }
});

report.get('/Part_Number', verifyJWT, async (req, res) => {
    console.log('Report Part Number', req.query);
    try {
        const Plant = req.query.plant;
        const Insp = req.query.insp;
        const From = req.query.from;
        const To = req.query.to;

        const pool = await poolPromise;
        const result = await pool.request()
            .input('plant', Plant)
            .input('Insp', Insp)
            .input('From', From)
            .input('To', To)
            .execute('GetPartNumbers1')

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(400).json(error);
    }
});

report.get('/Check_Points', verifyJWT, async(req, res) => {
    console.log('Checkpoint Query', req.query);
    try {
        const part = req.query.part;
        const Insp = req.query.insp;
        const From = req.query.from;
        const To = req.query.to;

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Part', part)
            .input('Insp', Insp)
            .input('From', From)
            .input('To', To)
            .execute('GetCheckPoints')

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(400).json(error);
    }
});

report.get('/Get_Machine', verifyJWT, async (req, res) => {
    console.log('Machine Querys', req.query);
    try {
        const Part = req.query.part;
        const Insp = req.query.insp;
        const From = req.query.from;
        const To = req.query.to;
        const Item = req.query.item;

        const pool = await poolPromise;
        const result = await pool.request()
            .input('Part', Part)
            .input('Insp', Insp)
            .input('From', From)
            .input('To', To)
            .input('Item', Item)
            .execute('GetMachines')

        res.status(200).json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(400).json(error);
    }
});

report.get('/Get_Chart', verifyJWT, async(req, res) => {
    console.log('Chart Params', req.query);
    try {
        const pool = await poolPromise;
        const From = req.query.from;
        const To = req.query.to;
        const Check = req.query.check;
        const Item = req.query.item;
        const Insp = req.query.insp;
        const Part = req.query.part
        const result = await pool.request()
            .input('From', From)
            .input('To', To)
            .input('Check', Check)
            .input('Item', Item)
            .input('Part', Part)
            .input('Insp', Insp)
            .execute('GetBucketDataNew');

        const Histo = await pool.request()
            .input('From', From)
            .input('To', To)
            .input('Check', Check)
            .input('Item', Item)
            .input('Part', Part)
            .input('Insp', Insp)
            .execute('Histogram_Data');

        const CpCpk = await pool.request()
            .input('From', From)
            .input('To', To)
            .input('Check', Check)
            .input('Item', Item)
            .input('Part', Part)
            .input('Insp', Insp)
            .execute('GetCpCpk');

            // console.log('result', result.recordsets)

        res.status(200).json({
            Data: result.recordsets[0],
            Bucket: result.recordsets[1],
            Min: result.recordsets[2],
            Overall: result.recordsets[3],
            XChart: result.recordsets[4],
            RChart: result.recordsets[5],
            Histogram: Histo.recordsets[0],
            cp: CpCpk.recordsets[0]
        });
    } catch (error) {
        console.error(error);
        res.status(400).json(error);
    }
});


export default report;