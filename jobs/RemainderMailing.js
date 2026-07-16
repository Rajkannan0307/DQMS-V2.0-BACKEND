import cron from 'node-cron'
import poolPromise from "../db.js";
import { mailconfig, mailTriggerFrom } from '../utils/mailConfig.js';

/*
    Running at every Week Monday 8:00AM
    Testing : every 10 seconds
    Sample out put = [
        {
        company_id: 1000,
        plant_id: 1190,
        dept_id: 13,
        dept_name: 'QUALITY',
        emp_name: 'Soundarrajan P',
        level: 1,
        email: 'p.soundarrajan@ranegroup.com',
        l3_user: null,
        l3_email: null,
        l4_user: null,
        l4_email: null,
        task_type: 'Effectiveness Review',
        task_name: 'Process Audit  - RACM _ Q4 2025',
        status: null,
        closed_on: '03-05-2026',
        aging_days: 37,
        aging_bucket: 1 // 1 - 7 Days, 2 - 8-14 Days, 3 - >14 Days
     }      
    ]
*/


/**
 * Groups an array of objects by a specific property/column name.
 * @param {Array} data - The response array from your database.
 * @param {string} columnName - The column you want to group by (e.g., 'email', 'dept_name').
 * @returns {Array} An array of [key, value] pairs.
 */

function groupByColumn(data, columnName) {
    const grpData = data.reduce((acc, item) => {
        const groupKey = item[columnName];
        // Safe check for missing keys or numerical keys (numbers don't have .trim)
        if (!groupKey) return acc;
        const stringKey = String(groupKey).trim();
        if (!stringKey) return acc;

        if (!acc[stringKey]) {
            acc[stringKey] = {
                to: stringKey,
                cc: [],
                data: []
            };
        }

        // Push the item to the data array
        acc[stringKey].data.push(item);
        return acc;
    }, {});

    // FIX HERE: Return Object.values directly
    return Object.values(grpData);
}


function RemainderMailTemplate(data) {

    let tableRow = data?.map(item => {
        const {
            task_type,
            plant_id,
            emp_name,
            dept_name,
            task_name,
            closed_on,
            aging_days
        } = item
        return `
            <tr style="background-color:#ffffff;;">
                <td style="padding:10px;border:1px solid #dbe3f0;">${task_type}</td>
                <td style="padding:10px;border:1px solid #dbe3f0;">${plant_id}</td>
                <td style="padding:10px;border:1px solid #dbe3f0;">${emp_name}</td>
                <td style="padding:10px;border:1px solid #dbe3f0;">${dept_name}</td>
                <td style="padding:10px;border:1px solid #dbe3f0;">${task_name}</td>
                <td style="padding:10px;border:1px solid #dbe3f0;text-align:center;">${closed_on}</td>
                <td style="padding:10px;border:1px solid #dbe3f0;text-align:center;color:#d32f2f;font-weight:bold;">
                    ${aging_days}
                </td>
            </tr>
        `
    }).join('')

    const htmlBody = `
        <div style="font-family: Arial, sans-serif; color: #333333; font-size: 10px;">
            <table
                cellpadding="0"
                cellspacing="0"
                border="0"
                width="100%"
                style="
                    border-collapse: collapse;
                    width: 100%;
                    border: 1px solid #dbe3f0;
                "
            >
                <thead>
                    <tr>
                        <th style="background:#091c66;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:left;">
                            Activity
                        </th>
                        <th style="background:#091c66;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:left;">
                            Plant
                        </th>
                        <th style="background:#091c66;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:left;">
                            User
                        </th>
                        <th style="background:#091c66;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:left;">
                            Department
                        </th>
                        <th style="background:#091c66;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:left;">
                            Task Details
                        </th>
                        <th style="background:#091c66;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:center;">
                            Target Date
                        </th>
                        <th style="background:#091c66;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:center;">
                            Delay Days
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRow}
                </tbody>
            </table>
            <div style="width: 100%; height: 1px; background: #b6b6b6; margin: 15px 0"></div>
            <div style="color: #db7272; margin: 0">
            <p>
                This is an automated notification from the DQMS. Don't reply to this
                sender mail id.
            </p>
            </div>
        </div>
    `
    return htmlBody
}


function buildEscalationGroups(
    data,
    {
        emailField,
        includeLevels,
        extraCcField = null
    },
    level // 3 or 4
) {
    // Helper to safely split comma-separated emails into a clean array
    const parseEmails = (emailStr) => {
        if (!emailStr) return [];
        return emailStr.split(',').map(e => e.trim()).filter(Boolean);
    };

    const groups = Object.values(
        data.reduce((acc, row) => {
            const toEmails = parseEmails(row[emailField]);

            // Skip rows where TO email is null/empty
            if (toEmails.length === 0) {
                return acc;
            }

            // Sort emails so that "a@b.com, c@d.com" groups with "c@d.com, a@b.com"
            const toEmailKey = toEmails.sort().join(',');

            // --- FIXED: Conditional grouping based on level ---
            const key = level === 4
                ? `${row.company_id}_${row.plant_id}_${toEmailKey}` // L4: Company + Plant
                : `${row.company_id}_${row.plant_id}_${row.dept_id}_${toEmailKey}`; // L3: Company + Plant + Dept

            if (!acc[key]) {
                acc[key] = {
                    to: toEmailKey, // Keeping as a clean comma-separated string
                    cc: [],
                    data: []
                };
            }
            acc[key].data.push(row);
            return acc;
        }, {})
    );

    groups.forEach(group => {
        const cc = [];

        // 1. Extract CCs based on included levels (handling multiple emails per row)
        group.data
            .filter(x => includeLevels.includes(x.level))
            .forEach(x => {
                cc.push(...parseEmails(x.email));
            });

        // 2. Extract extra CCs (handling multiple emails per row)
        if (extraCcField) {
            group.data.forEach(x => {
                cc.push(...parseEmails(x[extraCcField]));
            });
        }

        // 3. Deduplicate CCs
        const uniqueCc = [...new Set(cc)];

        // Optional Best Practice: Remove anyone from CC who is already in the TO field
        const toArray = parseEmails(group.to);
        group.cc = uniqueCc.filter(email => !toArray.includes(email));
    });

    // Optional: remove groups with no data
    return groups.filter(g => g.data.length > 0);
}


function EscalationMailTemplateRev02(data, escalation_level) {
    // Logic: 
    // If escalation_level === 4 -> show ONLY Bucket 3 (>14 Days)
    // Else -> show Bucket 2 (8-14 Days) AND Bucket 3 (>14 Days)
    const showBucket2 = escalation_level !== 4;
    const showBucket3 = true; // Always shown based on the new requirement

    const tableRow = data?.map(item => `
        <tr>
            <td style="padding:10px;border:1px solid #dbe3f0;">
                ${item.plant_id}
            </td>

            <td style="padding:10px;border:1px solid #dbe3f0;">
                ${item.emp_name}
            </td>

            ${showBucket2
            ? `
                <td style="padding:10px;border:1px solid #dbe3f0;text-align:center;">
                    ${item.bucket2}
                </td>
            ` : ''}
            
            ${showBucket3
            ? `
                <td style="padding:10px;border:1px solid #dbe3f0;text-align:center;">
                    ${item.bucket3}
                </td>
            ` : ''}
        </tr>
    `).join('');

    const htmlBody = `
        <div style="font-family: Arial, sans-serif; color: #333333; font-size: 10px;">
            <table
                cellpadding="0"
                cellspacing="0"
                border="0"
                width="100%"
                style="
                    border-collapse: collapse;
                    width: 100%;
                    border: 1px solid #dbe3f0;
                "
            >
                <thead>
                    <tr>
                        <th style="background:#091c66;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:left;">
                            Plant
                        </th>
                        <th style="background:#091c66;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:left;">
                            User
                        </th>
                        
                        ${showBucket2
            ? `
                        <th style="background:#d48002;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:center;">
                            8-14 Days
                        </th>
                        ` : ''}

                        ${showBucket3
            ? `
                        <th style="background:#eb1410;color:#ffffff;padding:12px;border:1px solid #dbe3f0;text-align:center;">
                            >14 Days
                        </th>
                        ` : ''}   
                    </tr>
                </thead>

                <tbody>
                    ${tableRow}
                </tbody>
            </table>

            <div style="width: 100%; height: 1px; background: #b6b6b6; margin: 15px 0"></div>

            <div style="color: #db7272; margin: 0">
                <p>
                    This is an automated notification from the DQMS. Don't reply to this sender mail id.
                </p>
            </div>
        </div>
    `;

    return htmlBody;
}

function buildEscalationSummary(data = []) {
    // Failsafe: if data is undefined or not an array, return early
    if (!data || !Array.isArray(data)) {
        return [];
    }

    return Object.values(
        data.reduce((acc, row) => {
            const key = row?.email;

            // Failsafe: skip if there is no email on this row
            if (!key) return acc;

            if (!acc[key]) {
                acc[key] = {
                    plant_id: row?.plant_id,
                    emp_name: row?.emp_name,
                    dept_id: row?.dept_id,
                    bucket1: 0,
                    bucket2: 0,
                    bucket3: 0
                };
            }
            switch (row?.aging_bucket) {
                case 1:
                    acc[key].bucket1++;
                    break;
                case 2:
                    acc[key].bucket2++;
                    break;
                case 3:
                    acc[key].bucket3++;
                    break;
            }
            return acc;
        }, {})
    );
}


const remainderMailing = cron.schedule('0 10 * * 1', async () => {
    try {
        console.log('Remainder Mailing');

        const pool = await poolPromise;
        const request = pool.request();

        const result = await request.execute('ProcessRemainderMail');

        const response = result?.recordsets || [];
        const userResponse = response[0] || [];

        if (userResponse.length === 0) {
            console.log('No records found for mailing');
            return;
        }

        // ------------------------
        // User Reminder Mail
        // ------------------------
        try {
            const grpData = Object.values(groupByColumn(userResponse, 'email'));

            await Promise.all(
                grpData.map(async (item) => {
                    try {
                        const htmlBody = RemainderMailTemplate(item?.data || []);

                        const mailPayload = {
                            from: mailTriggerFrom,
                            to: item?.to,
                            subject: 'DQMS: Weekly Pending Summary',
                            html: htmlBody
                        };

                        console.log(
                            "mailPayload",
                            "from :", mailPayload.from,
                            "to :", mailPayload.to,
                            "subject :", mailPayload.subject
                        );

                        await mailconfig.sendMail(mailPayload);

                        console.log(`Reminder mail sent to ${item?.to}`);
                    } catch (err) {
                        console.error(`Failed to send reminder mail to ${item?.to}`, err);
                    }
                })
            );
        } catch (err) {
            console.error('Error while processing reminder mails', err);
        }

        // ------------------------
        // Build Escalation Groups
        // ------------------------
        // ADDED: Passed '3' as the level parameter
        const l3Groups = buildEscalationGroups(userResponse, {
            emailField: "l3_email",
            includeLevels: [1, 2, 3, 4]
        }, 3);

        // ADDED: Passed '4' as the level parameter for Plant-level grouping
        const l4Groups = buildEscalationGroups(userResponse, {
            emailField: "l4_email",
            includeLevels: [1, 2, 3, 4],
            extraCcField: "l3_email"
        }, 4);

        // ------------------------
        // L3 Escalation Mail
        // ------------------------
        // ADDED .flat() to ensure we are looping over objects, not a nested array
        for (const item of l3Groups.flat()) {
            try {
                // Failsafe: Ensure item is a valid object before destructuring
                if (!item || typeof item !== 'object') continue;

                const { to, cc, data } = item;

                const escalationData = buildEscalationSummary(data)
                    .filter((e) => e.bucket2 > 0);

                if (escalationData.length === 0) {
                    console.log(`No escalation data found for L3 (${to})`);
                    continue;
                }

                const htmlBody = EscalationMailTemplateRev02(escalationData, 3);

                const mailPayload = {
                    from: mailTriggerFrom,
                    to,
                    cc: [...new Set([...(cc || []), 'm.rajkumar@ranegroup.com'])], // Safe CC merge
                    subject: 'DQMS: Weekly Pending Summary',
                    html: htmlBody
                };

                await mailconfig.sendMail(mailPayload);
                console.log(`L3 escalation mail sent to ${to}`);
            } catch (err) {
                console.error(`Failed to send L3 escalation mail`, err);
            }
        }

        // ------------------------
        // L4 Escalation Mail
        // ------------------------
        // ADDED .flat() here as well
        for (const item of l4Groups.flat()) {
            try {
                if (!item || typeof item !== 'object') continue;

                const { to, cc, data } = item;

                const escalationData = buildEscalationSummary(data)
                    .filter((e) => e.bucket3 > 0);

                if (escalationData.length === 0) {
                    console.log(`No escalation data found for L4 (${to})`);
                    continue;
                }

                const htmlBody = EscalationMailTemplateRev02(escalationData, 4);

                // Clean up CQA emails
                const cqa_emails = (userResponse[0]?.cqa_emails || "")
                    .split(',')
                    .map(e => e.trim())
                    .filter(Boolean);

                const mailPayload = {
                    from: mailTriggerFrom,
                    to,
                    cc: [...new Set([...(cc || []), ...cqa_emails])], // Safe CC deduplication
                    subject: 'DQMS: Weekly Pending Summary',
                    html: htmlBody
                };

                await mailconfig.sendMail(mailPayload);
                console.log(`L4 escalation mail sent to ${to}`);
            } catch (err) {
                console.error(`Failed to send L4 escalation mail`, err);
            }
        }

        console.log('Remainder Mailing Completed Successfully');

    } catch (err) {
        console.error('Remainder Mailing Cron Failed', err);
    }
});



export default remainderMailing
