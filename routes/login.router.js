import express, { response } from "express";
import poolPromise from "../db.js";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
import verifyJWT from "../middleware/auth.js";
import ActiveDirectory from "activedirectory2";
dotenv.config();

const login = express.Router();
//ad
login.post("/", async (req, res) => {
  try {
    let { genid, password } = req.body;
    let pool = await poolPromise;
    let query = `select gen_id from mst_employees where gen_id='${genid}' and  del_status=0`;
    let result = await pool.request().query(query);
    if (result.rowsAffected[0] == 1) {
      const ad = new ActiveDirectory({
        url: "ldap://10.0.1.73",
        baseDN: "dc=RANE,dc=com",
      });
      ad.authenticate(`${genid}@rane.com`, password, (err, auth) => {
        if (auth) {
          res
            .status(200)
            .json({
              token: jwt.sign(genid, process.env.SECRET),
              gen_id: genid,
            });
        } else {
          res.status(401).send({ details: "Invalid Credentials" })
        }
      });
    } else {
      throw new Error({ details: "Invalid Credentials" });
    }
  } catch (error) {
    console.error(error);
    res.status(401).json(error);
  }
});
//db
// login.post("/", async (req, res) => {
//   try {
//     let { genid, password } = req.body;
//     let pool = await poolPromise;
//     let query = `select gen_id from mst_employees where gen_id='${genid}' and mobile_no='${password}' and  del_status=0`;
//     let result = await pool.request().query(query);
//     if (result.rowsAffected[0] == 1) {
//       res
//         .status(200)
//         .json({ token: jwt.sign(genid, process.env.SECRET), gen_id: genid });
//     } else {
//       throw new Error({ details: "Invalid Credentials" });
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(401).json(error);
//   }
// });

login.get("/userDetails", verifyJWT, async (req, res) => {
  try {
    let { genid } = req.query;
    let pool = await poolPromise;
    let userDetails = await pool.request()
      .query(`select e.*,p.plant_name,c.company_name,d.dept_name,c.company_id,role.role_name from mst_employees as e
        join mst_plant as p on p.plant_id = e.plant_id
        join mst_company as c on c.company_id=p.company_id
        join mst_department as d on d.dept_id=e.dept_id
        join mst_role as role on role.role_id = e.role_id
        where gen_id='${genid}' and e.del_status=0`);
    let menu_access = await pool
      .request()
      .query(
        `select distinct(menu_id) from mst_permission where role_id=${userDetails.recordset[0].role_id}`
      );
    let submenu_access = await pool
      .request()
      .query(
        `select distinct(sub_menu_id) from mst_permission where role_id=${userDetails.recordset[0].role_id}`
      );
    let menu_id = menu_access.recordset.map((element) => element.menu_id);
    let sub_menu_id = submenu_access.recordset.map(
      (element) => element.sub_menu_id
    );
    res.status(200).json({
      userDetails: userDetails.recordset[0],
      menu_access: menu_id,
      sub_menu_access: sub_menu_id,
    });
  } catch (error) {
    console.error(error);
    res.status(401).json(error);
  }
});

export default login;
