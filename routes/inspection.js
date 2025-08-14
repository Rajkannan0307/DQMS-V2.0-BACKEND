import { Router } from "express";
import poolPromise, { sql } from "../db.js";
import nodemailer from "nodemailer";

let inspection = Router();

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

inspection.post("/saveInspection", async (req, res) => {
  try {
    console.log('part req body:', req.body);

    let {
      inspection_data,
      type,
      operator,
      check_list_id,
      reference,
      user,
      plant_id,
      samples,
      part_id,
      heatCode,
      inspec,
      sup,
      rem
    } = req.body;

    const pool = await poolPromise;
    if (type == "part") {
      let resp = await pool
        .request()
        .query(
          `select checklist_mapping_id from mst_checklist_mapping where part_id=${part_id} and checklist_id=${check_list_id}`
        );
      console.log('resp', resp);
      let id = resp.recordset[0].checklist_mapping_id;
      // check_list_id = id;
    }
    let query = `declare @pkey int
    insert into trn_checklist(checklist_id,operator,type,reference,plant_id,heatcode,created_on,created_by) values('${check_list_id}','${operator}','${type}','${reference}','${plant_id}','${heatCode}',CURRENT_TIMESTAMP,'${user}')
    SET @pkey = SCOPE_IDENTITY();
    select @pkey as pkey`;
    console.log('query', query);
    const response = await pool.request().query(query);
    let inserted_id;
    if (response.rowsAffected[0] == 1) {
      inserted_id = response.recordset[0].pkey;
      console.log(inserted_id);
    }
    const table = new sql.Table("#tempdata");
    table.create = true;
    table.columns.add("insp_id", sql.Int, { nullable: false });
    table.columns.add("checklist_item_id", sql.Int, { nullable: false });
    table.columns.add("sample1", sql.VarChar(10));
    table.columns.add("result1", sql.VarChar(10));
    table.columns.add("sample2", sql.VarChar(10));
    table.columns.add("result2", sql.VarChar(10));
    table.columns.add("sample3", sql.VarChar(10));
    table.columns.add("result3", sql.VarChar(10));
    table.columns.add("sample4", sql.VarChar(10));
    table.columns.add("result4", sql.VarChar(10));
    table.columns.add("sample5", sql.VarChar(10));
    table.columns.add("result5", sql.VarChar(10));
    table.columns.add("final_result", sql.VarChar(10));
    table.columns.add("Checklist_Id", sql.Int,);
    table.columns.add("Part_Id", sql.Int,);
    table.columns.add("Inspection_Id", sql.Int,);
    table.columns.add("Machine_Id", sql.Int,);
    table.columns.add("Supervisor", sql.VarChar(100));
    table.columns.add("Remarks", sql.VarChar(500));
    inspection_data.map((elemet) => {
      table.rows.add(
        inserted_id,
        elemet.checklist_item_id,
        elemet.sample1,
        elemet.result1,
        samples >= 3 ? elemet.sample2 : null,
        samples >= 3 ? elemet.result2 : null,
        samples >= 3 ? elemet.sample3 : null,
        samples >= 3 ? elemet.result3 : null,
        samples == 5 ? elemet.sample4 : null,
        samples == 5 ? elemet.result4 : null,
        samples == 5 ? elemet.sample5 : null,
        samples == 5 ? elemet.result5 : null,
        elemet.final_result,
        check_list_id,
        part_id,
        inspec,
        reference,
        sup,
        rem
      );
    });
    console.log('table', table);
    console.log('rows', table.rows);


    const insertData = await pool.request().bulk(table);

    const updateData = await pool.request().query(`exec update_inspection_new_1`);
    console.log('update Data', updateData)
    res.status(201).json({ message: "success" });
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.get("/getchecklists", async (req, res) => {
  try {
    console.log('getchecklistsby date:', req.query);

    let { from, to, type, inspection_id, plant_id } = req.query;
    let pool = await poolPromise;
    let query = `exec get_checklists '${type}','${from}','${to}','${inspection_id}','${plant_id}'`;
    console.log(query);
    let response = await pool.request().query(query);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.get("/getinspectiondetails", async (req, res) => {
  try {
    let { id, type } = req.query;
    console.log('getinspectiondetails=1', req.query)
    let pool = await poolPromise;
    let trn_details = await pool
      .request()
      .query(`exec get_checklist_details ${id},'${type}'`);

    let trn_inspection_data = await pool.request()
      .query(`select check_point,min,max,special_char,insp_method,type,sample1,sample2,sample3,sample4,sample5,result1,result2,result3,result4,result5,final_result,Supervisor, Remarks, cr.created_on   from trn_checklist_result as cr
    join mst_checklist_items as ci on ci.checklist_item_id=cr.checklist_item_id
    where trn_checklist=${id} order by trn_checklist`);
    res.status(200).json({
      trn_details: trn_details.recordset[0],
      check_list_data: trn_inspection_data.recordset,
    });
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.get("/getpedingnc", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool.request()
      .query(`select format(tcr.created_on,'dd-MM-yyy','en-US') as date,tcr.trn_checklist,check_point,check_list_name,tc.type,trn_checklist_result from trn_checklist_result as tcr
      join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
      join mst_checklist_items as ci on ci.checklist_item_id=tcr.checklist_item_id
      join mst_check_list as c on c.check_list_id=tc.checklist_id
      where tc.plant_id='${id}' and nc_created is null and nc_closed is null  and final_result='fail'order by tcr.created_on desc`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});


inspection.get("/getSubmittednc", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool.request()
      .query(`select check_list_name,mci.check_point,tc.checklist_id,tc.type,format(tc.created_on,'dd-MM-yyyy','en-US') as 'inspected_on',format(tnc.created_on,'dd-MM-yyyy','en-US') as assigned_on,nc_id,trn_checklist_id,isnull(status,'Open')as status,format(target_date,'dd-MM-yyyy','en-US') as 'target_date',format(submitted_on,'dd-MM-yyyy','en-US') as 'submitted_on',root_cause,corrective_action,m.emp_name as 'assigned_to' from trn_nc as tnc
      join trn_checklist_result as tcr  on tcr.trn_checklist_result=tnc.trn_checklist_result_id
	  join mst_employees as m on m.emp_id=tnc.emp_id
      join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
      join mst_checklist_items as mci on mci.checklist_item_id=tcr.checklist_item_id
      join mst_check_list as mc on mc.check_list_id=tc.checklist_id
	  join mst_employees as emp on emp.gen_id=tc.created_by
      where tc.plant_id=${id} and  status='submitted'
      order by tnc.created_on desc`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.get("/getclosed", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool.request()
      .query(` select check_list_name,mci.check_point,tc.checklist_id,tc.type,format(tc.created_on,'dd-MM-yyyy','en-US') as 'inspected_on',format(tnc.created_on,'dd-MM-yyyy','en-US') as assigned_on,nc_id,trn_checklist_id,isnull(status,'Open')as status,format(target_date,'dd-MM-yyyy','en-US') as 'target_date',format(submitted_on,'dd-MM-yyyy','en-US') as 'submitted_on',emp.emp_name as 'assigned_to' from trn_nc as tnc
      join trn_checklist_result as tcr  on tcr.trn_checklist_result=tnc.trn_checklist_result_id
	  join mst_employees as e on e.emp_id=tnc.emp_id
      join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
      join mst_checklist_items as mci on mci.checklist_item_id=tcr.checklist_item_id
      join mst_check_list as mc on mc.check_list_id=tc.checklist_id
	    join mst_employees as emp on emp.gen_id=tc.created_by
      where tc.plant_id=${id} and  status='closed'
      order by tnc.created_on desc`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.get("/assignednc", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool.request()
      .query(`select format(tcr.created_on,'dd-MM-yyyy','en-US') as date,tcr.trn_checklist,check_point,check_list_name,tc.type,trn_checklist_result,emp.emp_name,format(nc.created_on,'dd-MM-yyy','en-US') as created_on,isnull(status,'assigned') as status from trn_checklist_result as tcr
      join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
      join mst_checklist_items as ci on ci.checklist_item_id=tcr.checklist_item_id
      join mst_check_list as c on c.check_list_id=tc.checklist_id
	  join trn_nc as nc on nc.trn_checklist_result_id=trn_checklist_result
	  join mst_employees as emp on emp.emp_id=nc.emp_id
      where tc.plant_id=${id} and nc_created =1 and nc_closed is null and (status in ('pending','rejected','rejected') or status is null) order by tcr.created_on desc`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.get("/assigned", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool.request()
      .query(`select check_list_name,mci.check_point,tc.checklist_id,tc.type,format(tc.created_on,'dd-MM-yyyy','en-US') as 'inspected_on',format(tnc.created_on,'dd-MM-yyyy','en-US') as assigned_on,nc_id,trn_checklist_id,isnull(status,'Open')as status,comment from trn_nc as tnc
      join trn_checklist_result as tcr  on tcr.trn_checklist_result=tnc.trn_checklist_result_id
      join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
      join mst_checklist_items as mci on mci.checklist_item_id=tcr.checklist_item_id
      join mst_check_list as mc on mc.check_list_id=tc.checklist_id
      where emp_id=${id} and (status is null or status='rejected')
      order by tnc.created_on desc
      `);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.get("/pending", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool.request()
      .query(`select check_list_name,mci.check_point,tc.checklist_id,tc.type,format(tc.created_on,'dd-MM-yyyy','en-US') as 'inspected_on',format(tnc.created_on,'dd-MM-yyyy','en-US') as assigned_on,nc_id,trn_checklist_id,isnull(status,'Open')as status,format(target_date,'dd-MM-yyyy','en-US') as 'target_date',root_cause,corrective_action from trn_nc as tnc
      join trn_checklist_result as tcr  on tcr.trn_checklist_result=tnc.trn_checklist_result_id
      join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
      join mst_checklist_items as mci on mci.checklist_item_id=tcr.checklist_item_id
      join mst_check_list as mc on mc.check_list_id=tc.checklist_id
      where emp_id=${id} and  status='pending'
      order by tnc.created_on desc
      `);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.get("/submittednc", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool.request()
      .query(`select check_list_name,mci.check_point,tc.checklist_id,tc.type,format(tc.created_on,'dd-MM-yyyy','en-US') as 'inspected_on',format(tnc.created_on,'dd-MM-yyyy','en-US') as assigned_on,nc_id,trn_checklist_id,isnull(status,'Open')as status,format(target_date,'dd-MM-yyyy','en-US') as 'target_date',format(submitted_on,'dd-MM-yyyy','en-US') as 'submitted_on',root_cause,corrective_action from trn_nc as tnc
      join trn_checklist_result as tcr  on tcr.trn_checklist_result=tnc.trn_checklist_result_id
      join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
      join mst_checklist_items as mci on mci.checklist_item_id=tcr.checklist_item_id
      join mst_check_list as mc on mc.check_list_id=tc.checklist_id
      where emp_id=${id} and  status='submitted'
      order by tnc.created_on desc
      
      `);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.get("/closednc", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool.request()
      .query(`select check_list_name,mci.check_point,tc.checklist_id,tc.type,format(tc.created_on,'dd-MM-yyyy','en-US') as 'inspected_on',format(tnc.created_on,'dd-MM-yyyy','en-US') as assigned_on,nc_id,trn_checklist_id,isnull(status,'Open')as status,format(target_date,'dd-MM-yyyy','en-US') as 'target_date',format(submitted_on,'dd-MM-yyyy','en-US') as 'submitted_on' from trn_nc as tnc
      join trn_checklist_result as tcr  on tcr.trn_checklist_result=tnc.trn_checklist_result_id
      join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
      join mst_checklist_items as mci on mci.checklist_item_id=tcr.checklist_item_id
      join mst_check_list as mc on mc.check_list_id=tc.checklist_id
      where emp_id=${id} and  status='closed'
      order by tnc.created_on desc
      
      `);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.post("/createnc", async (req, res) => {
  try {
    let { id, emp_id } = req.body;
    let pool = await poolPromise;
    let response = await pool.request().query(`
    update trn_checklist_result set nc_created=1 where trn_checklist_result=${id}
    insert into trn_nc (trn_checklist_result_id,emp_id,created_on)values(${id},${emp_id},CURRENT_TIMESTAMP)
    `);
    let checklist_data = await pool.request()
      .query(`select ce.emp_name as creadted_by,format(tc.created_on,'dd-MM-yyyy','en-US') as created_on,ce.email as created_by_email,mci.check_point,mcl.check_list_name from trn_checklist_result as tcr
               join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
               join mst_checklist_items as mci on mci.checklist_item_id=tcr.checklist_item_id
               join mst_check_list as mcl on mcl.check_list_id=mci.check_list_id
               join mst_employees as ce on ce.gen_id=tc.created_by
               where trn_checklist_result=${id}`);

    let {
      creadted_by,
      created_on,
      created_by_email,
      check_point,
      check_list_name,
    } = checklist_data.recordset[0];

    let reciver_details = await pool
      .request()
      .query(`select email,emp_name from mst_employees where emp_id=${emp_id}`);
    let { email, emp_name } = reciver_details.recordset[0];

    let mailtext = `The belwo NC is generated from ${check_list_name} on ${created_on} by ${creadted_by}`;
    const mailOptions = {
      from: "noreplyrml@ranegroup.com",
      to: email,
      cc: ["g.kumar@ranegroup.com", created_by_email],
      subject: "DQMS-Inspection-NC-Action Request",
      html: `<p>Dear ${emp_name},</p><p style="margin-left:50px">${mailtext}</p>
      <p style="margin-left:50px">Kindly Login into DQMS and take required action.</p>
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; ">
  <p> 
    Thanks & Regards,<br />
    Auto Mail Notification From DQMS,<br />
    Note: Don’t reply to this sender mail id.
  </p>
</div>
      `,
    };

    console.log('mailbody', mailOptions);
    mailconfig.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log('Error Sending Mail', error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
    if (response.rowsAffected[0] == 1 && response.rowsAffected[1] == 1) {
      res.status(201).json({ status: "Success" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.post("/submitnc", async (req, res) => {
  console.log('submitnc', req.body);
  try {
    const { corrective_action, root_cause, status, date, id, usermail, username } = req.body;
    let pool = await poolPromise;
    let query;
    if (status == "pending") {
      query = `update trn_nc set root_cause='${root_cause}',corrective_action='${corrective_action}',status='${status}',target_date='${date}' where nc_id=${id}`
    } else if (status == 'submitted') {
      query = `update trn_nc set root_cause='${root_cause}',corrective_action='${corrective_action}',status='${status}',target_date='${date}',submitted_on=CURRENT_TIMESTAMP where nc_id=${id}`

      const reciver = await pool.request().query(`
        select tn.root_cause, tn.corrective_action, emp.emp_name, emp.email, emp.gen_id, mc.check_list_name
        from trn_nc as tn
        left join trn_checklist_result as tcr on tcr.trn_checklist_result = tn.trn_checklist_result_id
        left join trn_checklist as tc on tc.trn_checklist_id = tcr.trn_checklist
        left join mst_employees as emp on emp.gen_id = tc.created_by
        left join mst_check_list as mc on mc.check_list_id = tc.checklist_id
        where tn.nc_id=${id}
        `);

      const root = reciver.recordset[0].root;
      const action = reciver.recordset[0].action;
      const employee = reciver.recordset[0].emp_name;
      const mail = reciver.recordset[0].email;
      const checklist = reciver.recordset[0].check_list_name;
      const gen = reciver.recordset[0].gen_id;

      const mailbody = {
        from: "noreplyrml@ranegroup.com",
        to: mail,
        cc: ["g.kumar@ranegroup.com, k.rajamannar@ranegroup.com", usermail],
        subject: `CheckList-${checklist}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">     
    <p style="font-family: Verdana, sans-serif;font-weight: 600 ;">Dear ${employee}</p>
    <p>The Checklist ${checklist} and NC Action taken and Submitted by ${username}.</p> 
    <p> Kindly Review and do the Re-Inspection and Close the NC.</p> 
</div>

<div style="font-family: Arial, sans-serif; padding: 20px; color: #333; ">
  <p> 
    Thanks & Regards,<br />
    Auto Mail Notification From DQMS,<br />
    Note: Don’t reply to this sender mail id.
  </p>
</div>
        `
      };

      console.log('mailbody', mailbody);
      mailconfig.sendMail(mailbody, function (error, info) {
        if (error) {
          console.log('Error Sending Mail', error);
        } else {
          console.log("Email sent: " + info.response);
        }
      });
    }
    let response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(200).json({ status: "success" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

inspection.post("/handelncsubmit", async (req, res) => {
  console.log('status', req.body);
  try {
    const { status, id, user, remark } = req.body;
    const pool = await poolPromise;
    const query = `update trn_nc set verified_by='${user}',status='${status}',verified_on=CURRENT_TIMESTAMP,comment='${remark}' where nc_id=${id}`;

    if (status == 'rejected') {

      const rejectMail = await pool.request()
        .input('nc_id', id)
        .execute('GetRejectDetails')

      const Inspector = rejectMail.recordset[0].reviewed_by;
      const Attendby = rejectMail.recordset[0].action_taken_by;
      const Checklsit = rejectMail.recordset[0].check_list_name;
      const Checkpoint = rejectMail.recordset[0].check_point;
      const Inscomment = rejectMail.recordset[0].comment;
      const Root = rejectMail.recordset[0].root_cause;
      const Action = rejectMail.recordset[0].corrective_action;
      const Tomail = rejectMail.recordset[0].attend_by_email;
      const Ccmail = rejectMail.recordset[0].reviewed_by_mail;

      const mailbody = {
        from: "noreplyrml@ranegroup.com",
        to: Tomail,
        cc: Ccmail,
        subject: 'DQMS-NC Action Rejected',
        html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">     
  <p>Dear <strong>${Attendby}</strong>,</p>
  <p>Your NC action is not accepted by Quality Inspector <strong>${Inspector}</strong>.<br />
  Please take the action and resubmit the NC ticket in DQMS.</p> 
</div>

<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
  <p>Checklist Name: <strong>${Checklsit}</strong>.</p>
  <p>Check Point: <strong>${Checkpoint}</strong>.</p>
  <p>Inspector Comment: <strong>${Inscomment}</strong>.</p>
</div>

<div style="font-family: Arial, sans-serif; padding: 20px; color: #333; ">
  <p> 
    Thanks & Regards,<br />
    Auto Mail Notification From DQMS,<br />
    Note: Don’t reply to this sender mail id.
  </p>
</div>
      `
      };

      console.log('mailbody', mailbody);
      mailconfig.sendMail(mailbody, function (error, info) {
        if (error) {
          console.log('Error Sending Mail', error);
        } else {
          console.log("Email sent: " + info.response);
        }
      });

    }

    let response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});


inspection.get("/getncDetails", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool
      .request()
      .query(`select format(nc.submitted_on,'dd-MM-yyyy','en-US') as submitted_on,format(nc.created_on,'dd-MM-yyyy','en-US') as assigned_on, format(nc.verified_on, 'dd-MM-yyyy  hh:mm') as verified_on,
      mci.check_point,check_list_name,root_cause,corrective_action,comment,e.emp_name as action_taken_by,pl.plant_address,c.company_name,emp.emp_name as revived_by,
	    format(nc.submitted_on, 'dd-MM-yyyy  hh:mm', 'en-US') as attended_on, tc.checklist_id, pl.plant_id, FORMAT (tcr.created_on , 'yyyy') as year
      from trn_nc as nc
      left join trn_checklist_result as tcr on tcr.trn_checklist_result=nc.trn_checklist_result_id
      left join trn_checklist as tc on tc.trn_checklist_id=tcr.trn_checklist
      left join mst_employees as e on e.emp_id=nc.emp_id
      left join mst_checklist_items as mci on mci.checklist_item_id=tcr.checklist_item_id
      left join mst_check_list mc on mc.check_list_id=mci.check_list_id
      left join mst_employees as emp on emp.gen_id=tc.created_by
      left join mst_plant as pl on pl.plant_id=tc.plant_id    
      left join mst_company as c on c.company_id=pl.company_id 
      where nc_id=${id}`);

    res.status(200).json(response.recordset[0]);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});


inspection.get('/Part_Number', async (req, res) => {
  console.log('part number inspection', req.query);
  try {
    const Plant = req.query.plant;
    const Insp = req.query.insp;

    const pool = await poolPromise;
    const result = await pool.request()
      .input('plant', Plant)
      .input('Insp', Insp)
      .execute('GetPartForInsp')

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

inspection.get('/Get_Machine', async(req, res) => {
  console.log('Machine Request Inspection', req.query);
  try {
    const Plant = req.query.plant;
    const Insp = req.query.insp;

    const pool = await poolPromise;
    const result = await pool.request()
      .input('plant', Plant)
      .execute('GetMachinesForInspec')

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

export default inspection;
