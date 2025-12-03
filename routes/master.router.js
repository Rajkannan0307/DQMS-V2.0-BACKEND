import { response, Router } from "express";
import poolPromise from "../db.js";
import verifyJWT from "../middleware/auth.js";

let master = Router();
//get full company details
master.get("/company", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(`select * from mst_company order by company_id,del_status desc`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
//get comapany list
master.get("/companylist", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select company_id,company_name from mst_company where del_status=0`
      );
    console.log('resp', response);

    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
//new company
master.post("/company", verifyJWT, async (req, res) => {
  try {
    let { company_code, company_name, deleted, user } = req.body;
    const pool = await poolPromise;
    let query = `insert into mst_company(company_id,company_name,created_by,created_on,del_status)
        values(${company_code},'${company_name}','${user}',current_timestamp,${deleted == false ? 0 : 1
      })`;
    const response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

//update company
master.put("/company", verifyJWT, async (req, res) => {
  try {
    let { company_code, company_name, deleted, user } = req.body;
    const pool = await poolPromise;
    let query = `update mst_company set company_name='${company_name}',del_status=${deleted == false ? 0 : 1
      },modified_by='${user}',modified_on=current_timestamp where company_id=${company_code}`;
    const response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(202).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/companyvalidation", async (req, res) => {
  try {
    let { company_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(`select * from mst_company where company_id=${company_id}`);
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



// company ends...


// plant starts

master.get("/plantlist", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(`select plant_id,plant_name from mst_plant where del_status=0`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/plantlistbycompany", verifyJWT, async (req, res) => {
  try {
    let { company_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select plant_id,plant_name from mst_plant where del_status=0 and company_id=${company_id}`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
master.get("/plant", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select company_name,c.company_id,plant_id,plant_name,plant_address,p.del_status from mst_plant as p
      join mst_company as c on c.company_id=p.company_id
      order by del_status asc, plant_id asc`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/plant", verifyJWT, async (req, res) => {
  try {
    let { company_id, plant_id, plant_name, plant_address, deleted, user } =
      req.body;
    const pool = await poolPromise;
    let query = `insert into mst_plant(company_id,plant_id,plant_name,plant_address,created_by,created_on,del_status)
          values(${company_id},'${plant_id}','${plant_name}','${plant_address}','${user}',current_timestamp,${deleted == false ? 0 : 1
      })`;
    const response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.put("/plant", verifyJWT, async (req, res) => {
  try {
    let { company_id, plant_id, plant_name, plant_address, deleted, user } =
      req.body;
    const pool = await poolPromise;
    let query = `update mst_plant set company_id='${company_id}',plant_id=${plant_id},plant_name='${plant_name}',plant_address='${plant_address}',del_status=${deleted == false ? 0 : 1
      },modified_by='${user}',modified_on=current_timestamp where plant_id=${plant_id}`;
    console.log(query);
    const response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(202).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/plantvalidation", async (req, res) => {
  try {
    let { plant_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(`select * from mst_plant where plant_id=${plant_id}`);
    console.log(response.rowsAffected[0]);
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


// plant ends...



// department starts 


master.get("/department", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select p.plant_id,plant_name,dept_id,dept_name,d.del_status
        from mst_department as d
        join mst_plant as p on p.plant_id=d.plant_id`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/department", verifyJWT, async (req, res) => {
  try {
    let { dept_name, plant_id, deleted, user } = req.body;
    const pool = await poolPromise;
    let query = `insert into mst_department(dept_name,plant_id,created_by,created_on,del_status) values('${dept_name}','${plant_id}','${user}',CURRENT_TIMESTAMP,${deleted == false ? 0 : 1
      })`;
    const response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.put("/department", verifyJWT, async (req, res) => {
  try {
    let { dept_name, plant_id, deleted, user, dept_id } = req.body;
    const pool = await poolPromise;
    let query = `update mst_department set dept_name='${dept_name}',del_status=${deleted ? 1 : 0
      },modified_by='${user}',modified_on=CURRENT_TIMESTAMP where dept_id=${dept_id}`;
    const response = await pool.request().query(query);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
export default master;

master.get("/departmentlist", verifyJWT, async (req, res) => {
  try {
    let { plant_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select dept_id,dept_name from mst_department where plant_id=${plant_id} and del_status=0`
      );

    res.status(200).json(response.recordset);
  } catch (err) {
    console.error(err);
    res.status(400).json(err);
  }
});

// department ends...



// module starts


master.get("/module", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select p.plant_id,plant_name,d.dept_id,dept_name,m.module_id,module_name,m.del_status from mst_module as m
              join mst_plant as p on p.plant_id=m.plant_id
              join mst_department as d on d.dept_id=m.dept_id`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/module", verifyJWT, async (req, res) => {
  try {
    let { plant_id, dept_id, module_name, user } = req.body;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`insert into mst_module (module_name,plant_id,dept_id,created_by,created_on,del_status) 
      values('${module_name}','${plant_id}','${dept_id}','${user}',CURRENT_TIMESTAMP,0)`);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.put("/module", verifyJWT, async (req, res) => {
  try {
    let { module_name, user, id, deleted } = req.body;
    const pool = await poolPromise;
    console.log(
      `update mst_module set module_name='${module_name}',modified_by='${user}',modified_by=CURRENT_TIMESTAMP where module_id='${id}'`
    );
    const response = await pool
      .request()
      .query(
        `update mst_module set module_name='${module_name}',del_status=${deleted ? 1 : 0
        },modified_by='${user}',modified_on=CURRENT_TIMESTAMP where module_id='${id}'`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/modulelist", verifyJWT, async (req, res) => {
  try {
    let { dept_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select module_id,module_name from mst_module where dept_id='${dept_id}' and del_status=0`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/modulesbyplant", verifyJWT, async (req, res) => {
  try {
    let { plant_id } = req.query;
    console.log('plant', req.query);

    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select module_id,module_name from mst_module where plant_id='${plant_id}' and del_status=0`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

//module ends...



//line starts
master.get("/line", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request()
      // .query(`select l.line_id,l.line_name,l.module_id,m.module_name,l.dept_id,d.dept_name,l.plant_id,p.plant_name,l.del_status from mst_line as l
      //           join mst_plant as p on p.plant_id=l.plant_id
      //           join mst_department as d on d.dept_id=l.dept_id
      //           join mst_module as m on m.module_id=l.module_id`);
      // res.status(200).json(response.recordset);
      .query(`
          SELECT 
              l.line_id,
              l.line_name,
              l.module_id,
              m.module_name,
              l.dept_id,
              d.dept_name,
              l.plant_id,
              p.plant_name,
              l.del_status,
              (
                  SELECT inspection_type_id
                  FROM line_inspection_type_mapping 
                  WHERE line_id = l.line_id
                  FOR JSON PATH
              ) AS inspection_type_ids
          FROM mst_line AS l
          JOIN mst_plant AS p ON p.plant_id = l.plant_id
          JOIN mst_department AS d ON d.dept_id = l.dept_id
          JOIN mst_module AS m ON m.module_id = l.module_id;
        `)

    const result = response.recordset?.map((e) => {
      return {
        ...e,
        inspection_type_ids: JSON.parse(e?.inspection_type_ids)
      }
    })
    // console.log(result)
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.put("/line", async (req, res) => {
  try {
    let { line_name, user, id, deleted, inspection_type_ids } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `update mst_line set line_name='${line_name}',del_status=${deleted ? 1 : 0
        },modified_by='${user}',modified_on=CURRENT_TIMESTAMP where line_id='${id}'`
      );
    // if (response.rowsAffected[0] == 1) {
    //   res.status(201).json({ status: "success" });
    // }

    // If inspection_type_ids is provided, update mapping
    if (inspection_type_ids && inspection_type_ids.length > 0) {
      // 1. Remove old mappings
      await pool.request().query(`
        DELETE FROM line_inspection_type_mapping
        WHERE line_id='${id}'
      `);

      // 2. Insert new mappings
      for (const inspId of inspection_type_ids) {
        await pool.request().query(`
          INSERT INTO line_inspection_type_mapping (line_id, inspection_type_id, created_by, created_on)
          VALUES ('${id}', '${inspId}', '${user}', CURRENT_TIMESTAMP)
        `);
      }
    }

    if (response.rowsAffected[0] === 1) {
      return res.status(200).json({ status: "success" });
    } else {
      return res.status(404).json({ status: "not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
master.post("/line", verifyJWT, async (req, res) => {
  try {
    let { plant_id, dept_id, module_id, line_name, user, inspection_type_ids } = req.body;
    const pool = await poolPromise;
    const insertLineResult = await pool.request()
      .query(`
        insert into mst_line(line_name,plant_id,dept_id,module_id,created_by,created_on,del_status)
        OUTPUT INSERTED.line_id
			  values('${line_name}','${plant_id}','${dept_id}','${module_id}','${user}',CURRENT_TIMESTAMP,0)
      `);

    const lineId = insertLineResult.recordset[0].line_id;

    console.log(req.body, lineId)

    // Insert into mapping table
    for (const inspId of inspection_type_ids) {
      await pool.request()
        .query(`
          INSERT INTO line_inspection_type_mapping (line_id, inspection_type_id, created_by, created_on)
          VALUES ('${lineId}', '${inspId}', '${user}', CURRENT_TIMESTAMP)
        `);
    }

    // if (response.rowsAffected[0] == 1) {
    //   res.status(201).json({ status: "success" });
    // }

    return res.status(201).json({ status: "success", line_id: lineId });
  } catch (error) {
    console.error(error);
    return res.status(400).json(error);
  }
});

master.get("/linelist", async (req, res) => {

  try {
    const { dept_id, plant_id, module_id } = req.query;
    console.log('plant-line-list', req.query);
    const pool = await poolPromise;
    if (dept_id != undefined) {
      const response = await pool
        .request()
        .query(
          `select line_id,line_name from mst_line where dept_id='${dept_id}' and del_status=0`
        );
      res.status(200).json(response.recordset);
      return;
    }
    if (plant_id) {
      const response = await pool
        .request()
        .query(
          `select line_id,line_name from mst_line where plant_id=${plant_id} and del_status=0`
        );
      res.status(200).json(response.recordset);
      return;
    }
    if (module_id != undefined) {
      const response = await pool
        .request()
        .query(
          `select line_id,line_name from mst_line where module_id='${module_id}' and del_status=0`
        );
      res.status(200).json(response.recordset);
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

//line ends...


//machinetype starts
master.get("/machineType", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select machine_type_id,machine_type_name,m.company_id,company_name,m.del_status from mst_machine_type as m
      join mst_company as c on c.company_id=m.company_id
      `);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/machineType", verifyJWT, async (req, res) => {
  try {
    let { machine_type_name, user, company_id } = req.body;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`insert into mst_machine_type(machine_type_name,company_id,created_by,created_on,del_status)
      values('${machine_type_name}','${company_id}','${user}',CURRENT_TIMESTAMP,0)`);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.put("/machineType", verifyJWT, async (req, res) => {
  try {
    let { machine_type_name, user, id, deleted } = req.body;
    const pool = await poolPromise;

    const response = await pool
      .request()
      .query(
        `update mst_machine_type set machine_type_name='${machine_type_name}',del_status=${deleted ? 1 : 0
        },modified_by='${user}',modified_on=CURRENT_TIMESTAMP where machine_type_id='${id}'`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/machineTypeList", verifyJWT, async (req, res) => {
  try {
    const { plant_id, company_id } = req.query;
    const pool = await poolPromise;
    if (plant_id != undefined) {
      const response = await pool
        .request()
        .query(
          `select machine_type_id,machine_type_name from mst_machine_type where company_id=(select company_id from mst_plant  where plant_id=${plant_id}) and del_status=0`
        );
      res.status(200).json(response.recordset);
      return;
    }
    if (company_id != undefined) {
      const response = await pool
        .request()
        .query(
          `select machine_type_id,machine_type_name from mst_machine_type where company_id=${company_id} and del_status=0`
        );
      res.status(200).json(response.recordset);
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/machine", verifyJWT, async (req, res) => {
  try {
    let { plant_id, role_id } = req.query;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select m.plant_id,p.plant_name,m.dept_id,dept_name,m.line_id,line_name,m.machine_type_id,machine_type_name,m.sap_id,machine_name,machine_id,m.del_status from mst_machine as m
                 join mst_line as l on l.line_id=m.line_id
                 join mst_department as d on d.dept_id=m.dept_id
                 join mst_plant as p on p.plant_id=m.plant_id
                 join mst_machine_type as mt on mt.machine_type_id= m.machine_type_id
                ${(role_id == 1 || role_id == 5) ? "" : `where p.plant_id=${plant_id}`}
                 order by del_status
                 `);
    //  ${role_id == 1 ? "" : `where p.plant_id=${plant_id}`}
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/machinecodevalidation", async (req, res) => {
  try {
    let { company_id, code } = req.query;
    const pool = await poolPromise;
    const response = await pool.request().query(`select * from mst_machine as m
      join mst_plant as p on p.plant_id=m.plant_id
      join mst_company as c on c.company_id=p.company_id
      where c.company_id=${company_id} and m.sap_id = '${code}'`);
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

master.post("/machine", verifyJWT, async (req, res) => {
  try {
    let {
      plant_id,
      dept_id,
      line_id,
      machine_type_id,
      machine_name,
      user,
      sap_id,
    } = req.body;
    const pool = await poolPromise;

    const DuplicateCheck = await pool.request().query(
      `SELECT COUNT(*) AS DupMachine FROM mst_machine WHERE sap_id ='${sap_id}'`
    );

    const DupMachine = DuplicateCheck.recordset[0].DupMachine;

    if (DupMachine > 0) {
      console.log("Machine Already Available");
      res.status(201).json({ message: "Machine Already Available" });
    } else {
      const response = await pool.request().query(`
        insert into mst_machine (plant_id,dept_id,line_id,machine_type_id,sap_id,machine_name,created_by,created_on,del_status)
        values('${plant_id}','${dept_id}','${line_id}','${machine_type_id}','${sap_id}','${machine_name}','${user}',CURRENT_TIMESTAMP,0)`);
      if (response.rowsAffected[0] == 1) {
        res.status(201).json({ message: "Machine Created Successfully" });
      }
    }


  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.put("/machine", verifyJWT, async (req, res) => {
  try {
    let {
      plant_id,
      dept_id,
      line_id,
      machine_type_id,
      user,
      machine_id,
      machine_name,
      deleted,
    } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `update mst_machine set plant_id='${plant_id}',dept_id='${dept_id}',line_id='${line_id}',machine_type_id='${machine_type_id}',machine_name='${machine_name}',del_status=${deleted ? 1 : 0
        },modified_by='${user}',modified_on=CURRENT_TIMESTAMP where machine_id='${machine_id}'`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/machinelist", async (req, res) => {
  try {
    let { machine_type_id, line_id } = req.query;
    let pool = await poolPromise;
    let response = await pool
      .request()
      .query(
        `select machine_id,machine_name from mst_machine where machine_type_id=${machine_type_id} and line_id=${line_id} and del_status=0`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

// machine ends...


//menu starts

master.get("/menu", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request().query(`select * from mst_menus
      `);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/menulist", verifyJWT, async (req, res) => {
  try {
    let { role_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select menu_id,menu_name from mst_menus where  del_status=0 and menu_id not in (select distinct(menu_id) from mst_permission where role_id=${role_id})`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/menu", async (req, res) => {
  try {
    let { menu_name, user, link } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `insert into mst_menus values('${menu_name}','${link}','${user}',CURRENT_TIMESTAMP,null,null,0)`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/submenu", verifyJWT, async (req, res) => {
  try {
    let { main_menu } = req.query;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select s.*,m.menu_name from mst_sub_menus as s
    join mst_menus as m on m.menu_id=s.menu_id
    where s.menu_id='${main_menu}'
      `);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/submenulist", verifyJWT, async (req, res) => {
  try {
    let { menu_id, role_id } = req.query;
    console.log(menu_id, role_id);
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select sub_menu_id,sub_menu_name from mst_sub_menus where menu_id='${menu_id}' and  del_status=0 and  sub_menu_id not in (select distinct(sub_menu_id) from mst_permission where role_id=${role_id})`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/submenu", verifyJWT, async (req, res) => {
  try {
    let { menu_name, user, link, main_menu } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `insert into mst_sub_menus values('${menu_name}','${link}','${main_menu}','${user}',CURRENT_TIMESTAMP,null,null,0)`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

// menu ends...



// role starts

master.get("/role", verifyJWT, async (req, res) => {
  try {
    let { main_menu } = req.query;
    const pool = await poolPromise;
    const response = await pool.request().query(`select * from mst_role`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/rolelist", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(`select role_id,role_name from mst_role where del_status=0`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/role", verifyJWT, async (req, res) => {
  try {
    let { role_name, user } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `insert into mst_role values('${role_name}','${user}',CURRENT_TIMESTAMP,null,null,0)`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});


// role ends here...


// menu starts

master.get("/menu_permission", verifyJWT, async (req, res) => {
  try {
    let { role_id } = req.query;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select distinct(m.menu_id),m.menu_name from mst_permission as p
      join mst_menus as m on m.menu_id=p.menu_id
      where role_id=${role_id}`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/menu_permission", verifyJWT, async (req, res) => {
  try {
    let { role_id, menu_id, sub_menu_id, user } = req.body;
    const pool = await poolPromise;

    for (const item of sub_menu_id) {
      let response = await pool
        .request()
        .query(
          `insert into mst_permission values('${role_id}','${menu_id}','${item.sub_menu_id}','${user}',CURRENT_TIMESTAMP,null,null,0)`
        );

      console.log(response);
      console.log(item.sub_menu_id);
    }
    res.status(201).json({ status: "success" });
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.delete("/menu_permission", verifyJWT, async (req, res) => {
  try {
    let { role_id, menu_id } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `delete from mst_permission where role_id='${role_id}' and menu_id='${menu_id}' `
      );
    if (response.rowsAffected[0] >= 1) {
      res.status(204).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/submenu_permission", verifyJWT, async (req, res) => {
  try {
    let { role_id, menu_id } = req.query;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select distinct(m.sub_menu_id),m.sub_menu_name from mst_permission as p
      join mst_sub_menus as m on m.sub_menu_id=p.sub_menu_id
      where role_id=${role_id} and m.menu_id=${menu_id}`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.delete("/submenu_permission", verifyJWT, async (req, res) => {
  try {
    let { role_id, sub_menu_id } = req.body;
    console.log(req.body);
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `delete from mst_permission where role_id='${role_id}' and sub_menu_id='${sub_menu_id}' `
      );
    if (response.rowsAffected[0] >= 1) {
      res.status(204).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});


// menu ends here...


// employees starta

master.get("/employees", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select emp_id,gen_id,emp_name,mobile_no,email,plant_name,e.role_id,r.role_name,e.level,e.plant_id,dept_name,e.dept_id,line_name,e.line_id,designation,e.del_status,e.is_auditor from mst_employees as  e
              join mst_plant as p on p.plant_id = e.plant_id
              join mst_department as d on d.dept_id = e.dept_id
              join mst_line as l on l.line_id = e.line_id
              join mst_role as r on r.role_id=e.role_id
              order by e.del_status`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
master.get("/employeeslistbycompany", verifyJWT, async (req, res) => {
  try {
    const { company_id } = req.query;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select emp_id,emp_name from  mst_employees as e
      join mst_plant as p on p.plant_id=e.plant_id
      where p.plant_id='${company_id}' and e.del_status=0 and p.del_status=0`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/employeeslistbydept", verifyJWT, async (req, res) => {
  try {
    const { dept_id } = req.query;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select emp_id,gen_id,emp_name from  mst_employees as e
      where dept_id=${dept_id}`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/employees", verifyJWT, async (req, res) => {
  try {
    console.log('req.body', req.body);
    let {
      role_id,
      gen_id,
      emp_name,
      mobile_no,
      email,
      user,
      plant_id,
      dept_id,
      line_id,
      level,
      designation,
      is_auditor
    } = req.body;
    const pool = await poolPromise;
    const response = await pool.request().query(
      `insert into mst_employees (gen_id,emp_name,mobile_no,email,plant_id,dept_id,line_id,level,role_id,designation,created_by,created_on,del_status,is_auditor)
        values('${gen_id}','${emp_name}','${mobile_no}','${email}','${plant_id}','${dept_id}','${line_id}','${level}','${role_id}','${designation}','${user}',CURRENT_TIMESTAMP,0,${is_auditor})`
    );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});


master.post("/updateMobile", verifyJWT, async (req, res) => {
  try {
    let { mobile_no, id } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `update mst_employees set mobile_no='${mobile_no}' where emp_id=${id}
        `
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});
master.put("/employees", verifyJWT, async (req, res) => {
  try {
    let {
      role_id,
      emp_name,
      mobile_no,
      email,
      user,
      dept_id,
      line_id,
      level,
      designation,
      emp_id,
      deleted,
      is_auditor
    } = req.body;
    console.log(is_auditor, "is_auditor")
    const pool = await poolPromise;
    const response = await pool.request().query(
      `update mst_employees set  role_id='${role_id}',emp_name='${emp_name}',mobile_no='${mobile_no}',email='${email}',
      dept_id='${dept_id}',line_id='${line_id}',level='${level}',designation='${designation}',modified_by='${user}',
      modified_on=CURRENT_TIMESTAMP,del_status=${deleted ? 1 : 0
      }, is_auditor=${is_auditor} where emp_id='${emp_id}'`
    );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/genidvalidation", verifyJWT, async (req, res) => {
  try {
    let { gen_id } = req.query;
    console.log(gen_id);
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(`select gen_id from mst_employees where gen_id='${gen_id}'`);
    console.log(response.rowsAffected[0]);
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

master.get("/mst_employee_excel", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool
      .request()
      .execute('GetAllEmployee');
    return res.status(200).json({ success: true, data: response?.recordset || [] });
  } catch (error) {
    console.log(error)
    return res.status(500).json({ success: false, data: "Internal server error" });
  }
})

// employees ends here...


// customer group starts

master.get("/customergroup", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select cg.*,c.company_name from mst_customer_group as cg
              join mst_company as c on c.company_id=cg.company_id`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/customergroup", verifyJWT, async (req, res) => {
  try {
    let { company_id, customer_group_name, user } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `insert into mst_customer_group values('${customer_group_name}','${company_id}','${user}',CURRENT_TIMESTAMP,null,null,0)`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/customergrouplist", verifyJWT, async (req, res) => {
  try {
    const { company_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select customer_group_id,customer_group_name from mst_customer_group where company_id='${company_id}' and del_status=0`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/customergrouplistbyplant", verifyJWT, async (req, res) => {
  try {
    console.log('req.query--1', req.query);
    const { plant_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select customer_group_id,customer_group_name from mst_customer_group where company_id=(select company_id from mst_plant where plant_id=${plant_id}) and del_status=0`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.put("/customergroup", verifyJWT, async (req, res) => {
  try {
    let { customer_group_name, user, deleted, customer_group_id } = req.body;
    const pool = await poolPromise;
    const response = await pool.request().query(
      `update mst_customer_group set customer_group_name='${customer_group_name}',modified_by='${user}',
        modified_on=CURRENT_TIMESTAMP,del_status=${deleted ? 1 : 0
      } where customer_group_id=${customer_group_id}`
    );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

// customer group ends here...


// customer starts 

master.get("/customer", verifyJWT, async (req, res) => {
  try {
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select c.*,cg.customer_group_name,cg.company_id,company_name from mst_customer as c
      join mst_customer_group as cg on cg.customer_group_id=c.customer_group_id
      join mst_company as comp on comp.company_id=cg.company_id`);
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/customercodevalidation", async (req, res) => {
  try {
    let { company_id, code } = req.query;
    const pool = await poolPromise;
    const response = await pool.request()
      .query(`select * from mst_customer as mc
      join mst_customer_group as mcg on mcg.customer_group_id=mc.customer_group_id
      where company_id=${company_id} and mc.customer_code='${code}'`);
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

master.get("/customerlocatoin", verifyJWT, async (req, res) => {
  try {
    let { customer_id } = req.query;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `select customer_id,customer_location from mst_customer where customer_group_id=${customer_id} and del_status=0`
      );
    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.post("/customer", verifyJWT, async (req, res) => {
  try {
    let {
      customer_group_id,
      customer_code,
      customer_location,
      customer_spoc,
      customer_email,
      user,
    } = req.body;
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `insert into mst_customer values('${customer_group_id}','${customer_code}','${customer_location}','${customer_spoc}','${customer_email}','${user}',CURRENT_TIMESTAMP,null,null,0)`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.put("/customer", verifyJWT, async (req, res) => {
  try {
    let {
      customer_group_id,
      customer_code,
      customer_location,
      customer_spoc,
      customer_email,
      user,
      customer_id,
      deleted,
    } = req.body;
    console.log(
      `update mst_customer set customer_group_id='${customer_group_id}',customer_code='${customer_code}',customer_location='${customer_location}',customer_spoc='${customer_spoc}',customer_email='${customer_email}',modified_by='${user}',modified_on=CURRENT_TIMESTAMP,del_status=${deleted ? 1 : 0
      } where customer_id=${customer_id}`
    );
    const pool = await poolPromise;
    const response = await pool
      .request()
      .query(
        `update mst_customer set customer_group_id='${customer_group_id}',customer_code='${customer_code}',customer_location='${customer_location}',customer_spoc='${customer_spoc}',customer_email='${customer_email}',modified_by='${user}',modified_on=CURRENT_TIMESTAMP,del_status=${deleted ? 1 : 0
        } where customer_id=${customer_id}`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/report", verifyJWT, async (req, res) => {
  console.log(req.query);

  try {
    const plant = req.query.plant;
    const from = req.query.from;
    const to = req.query.to;
    const pool = await poolPromise;

    const response = await pool.request()
      .input('From', from)
      .input('To', to)
      .input('Plant', plant)
      .execute('Rpt_Checklist');

    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/single_report", verifyJWT, async (req, res) => {
  console.log(req.query);

  try {
    const plant = req.query.plant;
    const from = req.query.from;
    const to = req.query.to;
    const pool = await poolPromise;

    const response = await pool.request()
      .input('From', from)
      .input('To', to)
      .input('Plant', plant)
      .execute('GetSingleSampleReport');

    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/sample_report", verifyJWT, async (req, res) => {
  console.log(req.query);

  try {
    const plant = req.query.plant;
    const from = req.query.from;
    const to = req.query.to;
    const noOfSamples = req.query?.no_of_samples
    const pool = await poolPromise;

    let response;

    // if (!noOfSamples || parseInt(noOfSamples) === 1) {
    //   response = await pool.request()
    //     .input('From', from)
    //     .input('To', to)
    //     .input('Plant', plant)
    //     .execute('GetSingleSampleReport');
    // } else {
    response = await pool.request()
      .input('From', from)
      .input('To', to)
      .input('Plant', plant)
      .input('NoOfSamples', noOfSamples)
      .execute('GetSampleReport');
    // }

    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

master.get("/checklist_details", verifyJWT, async (req, res) => {
  console.log(req.query);

  try {
    const Id = req.query.checklist;
    const pool = await poolPromise;

    const response = await pool.request()
      .input('Id', Id)
      .execute('GetSingleChecksheetResult');

    res.status(200).json(response.recordset);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});


// customer ends here...

// NC Reassign used

master.get("/getUserByDelStatus", verifyJWT, async (req, res) => {
  try {
    const status = req.query.status;
    const plant = req.query.plant;
    const dept = req.query.dept;
    console.log(req.query)
    const pool = await poolPromise;


    let query = `
      SELECT * 
      FROM mst_employees
      WHERE plant_id = @plant
        AND del_status = @status
    `;

    // add dept filter only if status ≠ 0
    if (status !== "0") {
      query += ` AND dept_id = @dept`;
    }

    console.log(query)


    const result = await pool.request()
      .input("status", status)
      .input("plant", plant)
      .input("dept", dept)
      .query(query)
    // .query(`
    //   SELECT * FROM mst_employees where plant_id=@plant AND dept_id=@dept AND del_status = @status
    // `)
    return res.status(200).json({ success: true, data: result?.recordset });
  } catch (error) {
    console.error(error);
    return res.status(400).json(error?.message);
  }
})

