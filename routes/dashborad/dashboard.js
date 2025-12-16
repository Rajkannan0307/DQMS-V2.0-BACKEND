import { Router } from "express"
import verifyJWT from "../../middleware/auth.js";
import poolPromise from "../../db.js";
import { mailconfig } from "../../utils/mailConfig.js";


const dashboardTypeEnum = {
    BH: 'BH',
    PH: 'PH',
    FH: 'FH'
}

const dashboardRouter = Router()

dashboardRouter.get("/line", verifyJWT, async (req, res) => {
    try {
        const pool = await poolPromise;
        const response = await pool.request()
            .query(`SELECT * FROM mst_line WHERE del_status = 0`);
        return res.status(200).json({ success: false, data: response?.recordset })
    } catch (error) {
        console.error(error);
        return res.status(400).json({ success: false, error: error });
    }
});



dashboardRouter.post("/getDashboardData", verifyJWT, async (req, res) => {
    try {
        const body = req.body;

        const start_date = body?.start_date;
        const end_date = body?.end_date;
        const plant = body?.plant_id;
        const inspection = body?.inspection_id;
        console.log(body)
        const pool = await poolPromise;

        const ad_result = await pool.request()
            .input("start_date", start_date)
            .input("end_date", end_date)
            .input("plant", plant)
            .input("inspection", inspection)
            .execute('GetAdherenceDashboard')

        const nc_ad_result = await pool.request()
            .input("start_date", start_date)
            .input("end_date", end_date)
            .input("plant", plant)
            .input("inspection", inspection)
            .execute('GetNCAdherenceDashboard')

        console.log(ad_result?.recordset)

        return res.status(200).json({
            success: true, data: {
                ad: {
                    ad_all: ad_result?.recordsets[0],
                    ad_month: ad_result?.recordsets[1],
                    ad_plant: ad_result?.recordsets[2],
                },
                nc_ad: {
                    nc_ad_all: nc_ad_result?.recordsets[0],
                    nc_ad_month: nc_ad_result?.recordsets[1],
                    nc_ad_plant: nc_ad_result?.recordsets[2],
                },
                // NC Open Close Data
                nc_ad_oc: {
                    nc_ad_all: nc_ad_result?.recordsets[3],
                    nc_ad_month: nc_ad_result?.recordsets[4],
                    nc_ad_plant: nc_ad_result?.recordsets[5],
                }
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: "Internal server error" })
    }
})

dashboardRouter.post("/getInspectionStatus", verifyJWT, async (req, res) => {
    try {
        const body = req.body;
        const plant = body?.plant
        const date = body?.date

        const pool = await poolPromise;
        const response = await pool.request()
            .input('plant', plant)
            .input('date', date)
            .execute(`GetInspectionStatus`);
        return res.status(200).json({ success: false, data: response?.recordset })
    } catch (error) {
        console.error(error);
        return res.status(400).json({ success: false, error: error });
    }
});

dashboardRouter.post("/getBHDashboard", verifyJWT, async (req, res) => {
    try {
        const body = req.body;
        console.log(body)
        const company = body?.company
        const from_date = body?.from_date
        const to_date = body?.to_date
        const dashboardType = body?.dashboardType || dashboardTypeEnum.BH
        const dh_plant = body?.dh_plant || 1150
        const dh_module = body?.dh_module

        const pool = await poolPromise;
        const response = await pool.request()
            .input('company', company)
            .input('from_date', from_date)
            .input('to_date', to_date)
            .input('dashboardType', dashboardType)
            .input('dh_plant', dh_plant)
            .input('dh_module', dh_module)
            .execute(`GET_BH_FH_DASHBOARD`);
        return res.status(200).json({ success: false, data: response?.recordsets })
    } catch (error) {
        console.error(error);
        return res.status(400).json({ success: false, error: error });
    }
})

const sentInspectionStatusMail = async () => {
    try {
        const pool = await poolPromise;

        const handleMainAction = async (plant, date) => {
            const response = await pool.request()
                // const body = req.body;
                // const plant = body?.plant
                // const date = body?.date
                .input('plant', plant)
                .input('date', date)
                .execute(`GetInspectionStatus`);
            // console.log(response?.recordset)

            const inspectionTypeRes = await pool.request().query(`
                SELECT * FROM mst_inspection_type
            `)

            if (response?.recordset?.length <= 0) {
                console.log(`Checksheet length is empty : ${response?.recordset?.length}`)
                return;
            }

            // const inspectionColumnsIds = [4, 1, 2, 7]
            const inspectionColumnsIds = [1, 2, 3, 4, 5]
            const getRowData = async (resultData) => {
                const linesMap = {};

                resultData.forEach((item) => {

                    if (!linesMap[item.line_id]) {
                        linesMap[item.line_id] = {
                            id: item.line_id,
                            line_name: item.line_name,
                        };
                    }


                    // assign fields for that inspection
                    linesMap[item?.line_id][`inspection_${item?.inspection_id}`] = {
                        any_checklist_result: item?.any_checklist_result,
                        nc_ids: item?.nc_ids,
                        last_created_on: item?.last_created_on,
                        machines: item?.machines,
                        line_name: item?.line_name,
                        inspection_id: item?.inspection_id
                    };
                });

                // convert to array
                const rows = Object.values(linesMap);
                // console.log(rows);
                return rows;
            };

            const finalResult = await getRowData(response?.recordset)

            // console.log(finalResult)
            console.log(`Plant : ${plant} , Final Result length :  `, finalResult.length)
            // Helper to determine cell style based on checklist/NC
            const getCellStyle = (inspection) => {
                const chk = inspection?.any_checklist_result > 0;
                const nc = inspection?.nc_ids > 0;

                if (chk && nc) return { bg: '#EF4444', color: '#FFF' }; // Red: NC + checklist
                if (chk) return { bg: '#10B981', color: '#FFF' };        // Green: checklist only
                return { bg: '#E5E7EB', color: '#1F2937' };             // Gray: not executed
            };


            //  <div style="display:flex; gap:20px; font-family: Arial; margin-bottom:20px; font-size:10px">
            //     <div style="display:flex; align-items:center; gap:5px;">
            //         <div style="width:15px; height:15px; background:#10B981; border:1px solid #000;"></div>
            //         <span>Executed and OK</span>
            //     </div>
            //     <div style="display:flex; align-items:center; gap:5px;">
            //         <div style="width:15px; height:15px; background:#EF4444; border:1px solid #000;"></div>
            //         <span>Executed but NG observed</span>
            //     </div>
            //     <div style="display:flex; align-items:center; gap:5px;">
            //         <div style="width:15px; height:15px; background:#E5E7EB; border:1px solid #000;"></div>
            //         <span>Not Executed</span>
            //     </div>
            // </div>

            // Generate HTML
            const mailContentBody = `
            Dear User, <br>

            <p>Here attaching the line wise DQMS Inspection adherence status</p>
            <p>Please take necessary action to complains 100%</p>

              <div style="display:flex; font-family: Arial; margin-bottom:20px; font-size:10px">
                <div style="display:flex; align-items:center; margin-left:0px;">
                    <div style="width:15px; height:15px; background:#10B981; border:1px solid #000;"></div>
                    <span style="margin-left:5px;">Executed and OK</span>
                </div>
                <div style="display:flex; align-items:center; margin-left:15px;">
                    <div style="width:15px; height:15px; background:#EF4444; border:1px solid #000;"></div>
                    <span style="margin-left:5px;">Executed but NG observed</span>
                </div>
                <div style="display:flex; align-items:center; margin-left:15px;">
                    <div style="width:15px; height:15px; background:#E5E7EB; border:1px solid #000;"></div>
                    <span style="margin-left:5px;">Not Executed</span>
                </div>
             </div>

             <table style="border-collapse: collapse; width: 100%; font-family: Arial;">
                <thead>
                    <tr style="background:#1E3A8A;color:white;">
                        <th style="font-size:14px; padding:8px;">SI.No</th>
                        ${inspectionTypeRes?.recordset
                    ?.filter((e) => inspectionColumnsIds.includes(e?.inspection_id))
                    ?.map((e) => `<th style="font-size:12px; padding:8px;">${e?.inspection_name}</th>`).join("")}
                    </tr>
                </thead>
                <tbody>
            ${finalResult?.map((line, idx) => `
                <tr>
                    <td style="border:1px solid #ccc;padding:8px; text-align: center;">${idx + 1}</td>
                    ${inspectionColumnsIds.map((inspId) => {
                        // find inspection key for this line
                        const inspIndex = inspectionColumnsIds?.findIndex((e) => e === inspId);
                        // const inspIndex = inspectionColumnsIds?.find((e) => e === inspId);

                        const inspData = line[`inspection_${inspIndex + 1}`] || {};
                        const style = getCellStyle(inspData);
                        return `<td style="border:1px solid #ccc; padding:8px; text-align:center; background:${style.bg}; color:${style.color}; font-size:12px">
                                    ${inspData?.line_name || ""}
                                </td>`
                    }).join("")}
                </tr>
             `).join("")
                }
                </tbody>
           </table>

        `
            // console.log(mailContentBody)

            const currentUserRes = await pool.request()
                .input("plant", plant)
                .query(`
                SELECT * FROM mst_employees WHERE level IN (2,3,4) AND plant_id = @plant
            `)

            console.log(`Plant : ${plant}`, currentUserRes.recordset?.map((e) => e?.email))

            const toMail = currentUserRes.recordset?.map((e) => e?.email);

            const mailPayload = {
                from: "noreplyrml@ranegroup.com",
                to: toMail,
                // to: ["a.chandran@ranegroup.com"],
                cc: ["a.chandran@ranegroup.com", "m.rajkumar@ranegroup.com"],
                subject: `DQMS - Inspection Adherence Status`,
                html: mailContentBody
            }

            mailconfig.sendMail(mailPayload, async function (error) {
                if (error) {
                    console.log('Error Sending Mail', error);
                } else { }
            })
        }

        const plantRes = await pool.request()
            .query(`SELECT * FROM mst_plant WHERE del_status = 0`)
        const plantRecord = plantRes?.recordset || []

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000) // subtract 1 day
            .toISOString()
            .split('T')[0]; // note uppercase 'T'

        await Promise.all(
            plantRecord.map(async (e) => {
                await handleMainAction(e?.plant_id, yesterday);
            })
        );

        // return res.status(200).json({ success: false, data: [] })
    } catch (error) {
        console.error(error);
        // return res.status(400).json({ success: false, error: error });
    }
}

export { sentInspectionStatusMail }
export default dashboardRouter;