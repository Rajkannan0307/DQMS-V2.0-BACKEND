import { Router, query } from "express";
import poolPromise from "../db.js";
import verifyJWT from "../middleware/auth.js";
import { sql } from "../db.js";

const operationMaster = Router();

operationMaster.get("/productGroup", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select pg.*,c.company_name from mst_product_group as pg
                join mst_company as c on c.company_id=pg.company_id`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/productlistbyplant", verifyJWT, async (req, res) => {
  try {
    let { plant_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select product_id,product_name from mst_product_group where company_id=(select company_id from mst_plant where plant_id=${plant_id}) and del_status=0`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.post("/productGroup", verifyJWT, async (req, res) => {
  try {
    const { user, product_name, company_id } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `insert into mst_product_group values('${product_name}',${company_id},'${user}',current_timestamp,null,null,0)`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.put("/productGroup", verifyJWT, async (req, res) => {
  try {
    const { user, product_name, company_id, product_id, deleted } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `update mst_product_group set product_name='${product_name}',company_id=${company_id},modified_by='${user}',modified_on=current_timestamp,del_status=${deleted == false ? 0 : 1
        } where product_id=${product_id}`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/part", verifyJWT, async (req, res) => {
  try {
    let { role_id, plant_id } = req.query;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select p.*,pl.plant_name,pg.product_name from mst_part as p
        join mst_product_group as pg on pg.product_id=p.product_id
        join mst_plant as pl on pl.plant_id=p.plant_id
        ${role_id == 1 ? "" : `where p.plant_id=${plant_id}`}
        order by del_status
        `);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/partcodevalidation", async (req, res) => {
  try {
    let { plant_id, code } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select * from mst_part where part_number='${code}' and plant_id=${plant_id}`
      );
    if (response.rowsAffected[0] == 0) {
      res.status(200).json({ valid: true });
    } else {
      res.status(200).json({ valid: false });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/partlistbyplant", verifyJWT, async (req, res) => {
  try {
    let { plant_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select part_id,part_name from mst_part where  plant_id='${plant_id}'`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/partlistbyproduct", verifyJWT, async (req, res) => {
  try {
    let { product_id, plant_id } = req.query;
    console.log('partlistbyproduct-1', req.query)
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select part_id,part_name,part_number from mst_part where del_status=0 and product_id='${product_id}' and plant_id=${plant_id}`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
operationMaster.post("/part", verifyJWT, async (req, res) => {
  try {
    const {
      part_name,
      part_number,
      part_desc,
      customer_partcode,
      model_name,
      product_id,
      customer_group_id,
      customer_id,
      plant_id,
      user,
    } = req.body;
    const pool = await poolPromise;

    const DuplicateCheck = await pool.request().query(
      `SELECT COUNT(*) AS DupPart FROM mst_part WHERE part_number ='${part_number}'`
    );

    const DupPart = DuplicateCheck.recordset[0].DupPart;
    if(DupPart > 0) {
      console.log("Part Number Already Available");
      res.status(200).json({ message: `${part_number} - Part Number Already Available`});
    } else {
      const response = await pool.request().query(
        `insert into mst_part(part_name,part_number,model_name,product_id,plant_id,created_by,created_on,del_status)
          values('${part_name}','${part_number}','${model_name}','${product_id}','${plant_id}','${user}',CURRENT_TIMESTAMP,0)`
      );
      if (response.rowsAffected[0] == 1) {
        res.status(201).json({ message: "Part Created Successfully" });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.put("/part", verifyJWT, async (req, res) => {
  try {
    const {
      part_name,
      part_number,
      part_desc,
      model_name,
      product_id,
      plant_id,
      user,
      deleted,
      part_id,
    } = req.body;

    const pool = await poolPromise;
    let query = `update mst_part  set part_name='${part_name}',part_number='${part_number}',model_name='${model_name}',
      product_id='${product_id}',plant_id='${plant_id}',modified_by='${user}',mondified_on=CURRENT_TIMESTAMP,del_status=${deleted == false ? 0 : 1
      } where part_id='${part_id}'`;

    const response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

// operationMaster.get("/productlistbyplant", verifyJWT, async (req, res) => {
//   try {
//     let { plant_id } = req.query;
//     const pool = await poolPromise;
//     const response = await pool
//       .request()
//       .query(
//         `select product_id,product_name from mst_product_group where company_id=(select company_id from mst_plant where plant_id=${plant_id})`
//       );
//     if (response.rowsAffected[0] == 1) {
//       res.status(201).json({ status: "success" });
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(400).json(error);
//   }
// });

operationMaster.get("/inspectiontype", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(`select * from mst_inspection_type`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.post("/inspectiontype", verifyJWT, async (req, res) => {
  try {
    let { inspection_name, inspection_type, user } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `insert into mst_inspection_type(inspection_name,inspection_type,created_by,created_on,del_status) values('${inspection_name}','${inspection_type}','${user}',CURRENT_TIMESTAMP,0)`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
operationMaster.put("/inspectiontype", verifyJWT, async (req, res) => {
  try {
    let { inspection_id, inspection_name, user, deleted, inspection_type } =
      req.body;
    const pool = await poolPromise;
    let query = `update mst_inspection_type set inspection_name='${inspection_name}',inspection_type='${inspection_type}',modified_by='${user}',modified_on=CURRENT_TIMESTAMP,del_status=${deleted == false ? 0 : 1
      } where inspection_id=${inspection_id}`;
    console.log(query);
    const response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/inspectiontypelist", async (req, res) => {
  console.log('query params type', req.query);
  try {
    let { type } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select inspection_id,inspection_name from mst_inspection_type where del_status=0 and inspection_type='${type}'`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
operationMaster.get("/checklist", verifyJWT, async (req, res) => {
  try {
    let { plant_id, role_id } = req.query;
    let pool = await poolPromise;
    let query = `exec checklist_master_data ${role_id == 1 ? "" : `${plant_id}`
      }`;
    let response = await pool.request().query(query);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/partchecklist", async (req, res) => {
  try {
    let { plant_id } = req.query;
    console.log('plantid checking for checklist', req.query);
    let pool = await poolPromise;
    let response = await pool
      .request()
      .query(
        `select check_list_id,check_list_name from mst_check_list where type='part' and  del_status=0 and plant_id=${plant_id}` 
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

operationMaster.post("/checklist", async (req, res) => {
  try {
    console.log(req.body);
    
    let {
      check_list_name,
      inspection_id,
      no_of_samples,
      plant_id,
      revision_no,
      user,
      type,
      reference_id,
      fileData,
    } = req.body;

    let pool = await poolPromise;

    const DuplicateCheck = await pool.request().query(
      `SELECT COUNT(*) AS DupliCOUNT FROM mst_check_list WHERE check_list_name = '${check_list_name}' AND plant_id=${plant_id} AND type='${type}' AND inspection_id=${inspection_id}`
    );

    const DupCount = DuplicateCheck.recordset[0].DupliCOUNT;
    console.log('count', DupCount);

    if (DupCount > 0) {
      console.log("Checklist Already Available")
      res.status(200).json({ Message: `${check_list_name} - Checklist Already Available.` });
    } else {
      if (type == "part") reference_id = 0;


    let query = `
    DECLARE @InsertedPrimaryKey INT;
    insert into mst_check_list(check_list_name,type,inspection_id,reference_id,no_of_samples,plant_id,revision_no,created_by,created_on,del_status)
    values('${check_list_name}','${type}','${inspection_id}','${reference_id}','${no_of_samples}','${plant_id}','${revision_no}','${user}',CURRENT_TIMESTAMP,0)
    SET @InsertedPrimaryKey = SCOPE_IDENTITY();
    SELECT @InsertedPrimaryKey AS InsertedPrimaryKey;`;

    let response = await pool.request().query(query);
    let inserted_id;
    if (response.rowsAffected[0] == 1) {
      inserted_id = response.recordset[0].InsertedPrimaryKey;
    }
    console.log('id', inserted_id);
    

    let invalidValues = ["", null, undefined];
    let filteredData = fileData.filter((item) => {
      if (item.insp_type === "VARIABLE") {
        return (
          !invalidValues.includes(item.insp_parameter_name) &&
          // !invalidValues.includes(item.special_char) &&
          !invalidValues.includes(item.insp_method) &&
          !invalidValues.includes(item.min_value) &&
          !invalidValues.includes(item.max_value)
        );
      } else if (item.insp_type === "ATTRIBUTE") {
        return (
          !invalidValues.includes(item.insp_parameter_name) &&
          // !invalidValues.includes(item.special_char) &&
          !invalidValues.includes(item.insp_method)
        );
      }
    });

    const table = new sql.Table("#tempdata");
    table.create = true;
    table.columns.add("checklist_id", sql.Int, { nullable: false });
    table.columns.add("check_point", sql.VarChar(250), { nullable: false });
    table.columns.add("type", sql.VarChar(10), { nullable: false });
    table.columns.add("special_char", sql.VarChar(50), { nullable : true});
    table.columns.add("min", sql.VarChar(10), { nullable: true });
    table.columns.add("max", sql.VarChar(10), { nullable: true });
    table.columns.add("insp_method", sql.VarChar(250), { nullable: false });
    table.columns.add("user_id", sql.Int, { nullable: false });
    filteredData.forEach((element) => {
      const minValue = element.insp_type === "ATTRIBUTE" ? null : element.min_value == undefined ? null : `${element.min_value}`;
      const maxValue = element.insp_type === "ATTRIBUTE" ? null : element.max_value == undefined ? null : `${element.max_value}`;
      table.rows.add(
        inserted_id,
        element.insp_parameter_name,
        element.insp_type,
        element.special_char == undefined ? null : `${element.special_char}`,
        minValue,
        maxValue,
        element.insp_method,
        user
      );
    });
    console.log('rows', table.rows);
    

    console.log('table',table);
    
    const insertData = await pool.request().bulk(table);
    let resp = await pool.request().query(`exec insert_checklist`);
    console.log('insertdata', insertData);
    console.log('resp', resp);
    
    

    res.status(201).json({ Message: 'Checklist Created Successfully' });
    }

    
  } catch (error) {
    console.log('error-error',error);
    res.status(400).json(error);
  }
});


operationMaster.get("/checklistDetails", async (req, res) => {
  try {
    let { id } = req.query;
    let pool = await poolPromise;
    let response = await pool
      .request()
      .query(`select * from mst_check_list where check_list_id=${id}`);
    res.status(200).json(response.recordset[0]);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});
operationMaster.put("/checklistitem", async (req, res) => {
  try {
    let { check_list_items, user } = req.body;

    let pool = await poolPromise;
    for await (const item of check_list_items) {
      let response = await pool
        .request()
        .query(
          `update mst_checklist_items set special_char='${item.special_char}',check_point='${item.check_point}',type='${item.type}',min='${item.min}',max='${item.max}',insp_method='${item.insp_method}',modified_by='${user}',modified_on=CURRENT_TIMESTAMP where checklist_item_id='${item.checklist_item_id}'`
        );
    }
    res.status(201).json({ status: "success" });
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

operationMaster.put("/checklist", async (req, res) => {
  try {
    let { check_list_name, deleted, user, check_list_id } = req.body;

    let pool = await poolPromise;
    let query = `update mst_check_list set check_list_name='${check_list_name}',modified_by='${user}',modified_on=CURRENT_TIMESTAMP,del_status=${deleted == false ? 0 : 1
      } where check_list_id=${check_list_id}`;
    let response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/checklistdata", async (req, res) => {
  try {
    console.log('checklist_data', req.query)
    let { type, reference_id, inspection_id, part_id, plant_id } = req.query;
    const pool = await poolPromise;

    let query =
      type == "part"
        ? `
        select check_list_id,check_list_name from mst_checklist_mapping as c
        join mst_check_list as m on m.check_list_id=c.checklist_id
        where inspection_id=${inspection_id} and part_id=${part_id} and c.del_status=0 and c.plant_id=${plant_id}`
        : `select check_list_id,check_list_name from mst_check_list where type='${type}' and reference_id=${reference_id} and inspection_id=${inspection_id} and del_status=0 and plant_id=${plant_id}`;
    console.log(query);
    const response = await pool.request().query(query);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
});
operationMaster.get("/checklistitem", async (req, res) => {
  try {
    let { id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select * from mst_checklist_items where del_status=0 and check_list_id=${id}`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.post("/addChecklistItem", async (req, res) => {
  try {
    let { id, special_char, insp_method, check_point, min, max, user, type } =
      req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `insert into mst_checklist_items (check_list_id,check_point,insp_method,special_char,type,min,max,created_by,created_on,del_status) values('${id}','${check_point}','${insp_method}','${special_char}','${type}','${min}','${max}','${user}',CURRENT_TIMESTAMP,0)`
      );
    if (response.rowsAffected == 1) {
      res.status(201).json({ status: "successfull" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.post("/checklistitem", async (req, res) => {
  try {
    let { id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `update mst_checklist_items set del_status=1 where checklist_item_id='${id}' `
      );
    if (response.rowsAffected[0] == 1) {
      res.status(204).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/checklistMapping", async (req, res) => {
  try {
    console.log(req.query);
    let { plant_id, role_id } = req.query;
    const pool = await poolPromise;
    const response = await pool.request().query(`
        select checklist_mapping_id,c.plant_id,p.part_name,p.part_id,part_number,c.check_list_name,c.check_list_id from mst_checklist_mapping as m
          join mst_part as p on p.part_id=m.part_id
          join mst_check_list as c on c.check_list_id=m.checklist_id
        where m.del_status=0 and c.del_status=0 and p.del_status=0 ${role_id == 1 ? "" : `and m.plant_id=${plant_id}`
      }`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.post("/checklistMapping", async (req, res) => {
  try {
    let { checklist_id, part_id, plant_id, user } = req.body;
    let pool = await poolPromise;

    const Insp_check = await pool.request()
      .query(`
         select inspection_id from mst_check_list where check_list_id=${checklist_id}  
      `);

      const Insp_Id = Insp_check.recordset[0].inspection_id;
      console.log('insp id', Insp_Id)
    let checkDuplicate = await pool
      .request()
      .query(
        `select m.* from mst_checklist_mapping m
left join mst_check_list c on c.check_list_id = m.checklist_id
 where m.part_id='${part_id}' and m.checklist_id='${checklist_id}' and m.plant_id='${plant_id}' and m.del_status=0 and c.inspection_id=${Insp_Id}`
      );

      console.log(`select m.* from mst_checklist_mapping m
left join mst_check_list c on c.check_list_id = m.checklist_id
 where m.part_id='${part_id}' and m.checklist_id='${checklist_id}' and m.plant_id='${plant_id}' and m.del_status=0 and c.inspection_id=${Insp_Id}`)
    if (checkDuplicate.rowsAffected >= 1) {
      return res
        .status(200)
        .json({ message: "Selected Checklist Alredy Mapped to this Part" });
    }
    let response = await pool.request()
      .query(`insert into mst_checklist_mapping (plant_id,checklist_id,part_id,created_by,created_on,del_status)
					values('${plant_id}','${checklist_id}','${part_id}','${user}',CURRENT_TIMESTAMP,0)`);
    if (response.rowsAffected == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.get("/partmapping", async (req, res) => {
  try {
    let { plant_id, role_id } = req.query;
    const pool = await poolPromise;
    let query = `
     select pm.*,cg.customer_group_name,c.customer_location,part_name,part_number,p.plant_id,pl.plant_name, cm.company_name, c.customer_group_id 
    from mst_part_mapping as pm
    join mst_part as p on p.part_id=pm.part_id
	  join mst_plant as pl on pl.plant_id = p.plant_id
    join mst_customer as c on c.customer_id = pm.customer_id
    join mst_customer_group as cg on cg.customer_group_id=c.customer_group_id
    join mst_company as cm on cm.company_id = pl.company_id
    ${role_id == 1 ? "" : `where pl.plant_id=${plant_id}`}
    order by del_status`;
    console.log(query);
    const response = await pool.request().query(query);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.post("/partmapping", async (req, res) => {
  try {
    let { part_id, customer_id, customer_part_no, user } = req.body;
    const pool = await poolPromise;
    const response = await pool.request().query(
      `
      insert into mst_part_mapping(part_id,customer_id,customer_part_code,created_by,created_on,del_status)
      values('${part_id}','${customer_id}','${customer_part_no}','${user}',CURRENT_TIMESTAMP,0) `
    );
    if (response.rowsAffected[0] == 1) {
      res.status(204).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

operationMaster.put("/partmapping", async (req, res) => {
  console.log('received data', req.body);
  try {
    const { id, user, deleted, customer_id, customer_part_number } = req.body;
    const pool = await poolPromise;

    const response = await pool.request()
      .input('modified_by', user)
      .input('customer_part_code', customer_part_number)
      .input('customer_id', customer_id)
      .input('del_status', deleted ? 1 : 0)
      .input('id', id)
      .execute('UpdatePrtMapping')

    console.log('Part Mapping Updated Successfully');
    res.status(200).json({ message: 'Part Mapping Updated Successfully' });
  } catch (error) {
    console.error('Error While Updating Part Mapping', error);
    res.status(400).json({ message: 'Error While Updating Part Mapping' });
  }
});

export default operationMaster;
