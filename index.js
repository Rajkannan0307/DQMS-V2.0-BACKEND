import express from "express";
import * as dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import bodyParser from "body-parser";
import poolPromise from "./db.js";
import multer from "multer";
import * as path from "path";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

//routes import
import login from "./routes/login.router.js";
import master from "./routes/master.router.js";
import operationMaster from "./routes/operationMaster.router.js";
import inspection from "./routes/inspection.js";
import report from "./routes/report.router.js"
import audit from "./auditManagement/audit.js";
import auditSchedule from "./auditManagement/auditSchedule.js";
import auditStatus from "./auditManagement/auditStatus.js";
import auditNc from "./auditManagement/auditNC.js";
import auditReports from "./auditManagement/audit_report.js";
import dashboardRouter from "./routes/dashborad/dashboard.js";
import { startAllJobs } from "./jobs/index.js";

dotenv.config();
const app = express();

app.use(morgan("dev"));
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
  })
);
app.use(bodyParser.urlencoded({ limit: "1mb", extended: false }));
app.use(bodyParser.json({ limit: "1mb" }));

app.listen(process.env.PORT, () => {
  console.log(`Express App started on port:${process.env.PORT}`);
});

app.get("/", async (req, res) => {
  const pool = await poolPromise;
  const response = await pool.request().query(`select * from mst_employees`);
  res.send(response.recordset[0]);
});

app.use("/images", express.static("./uploads"));

app.use("/login", login);
app.use("/master", master);
app.use("/operationMaster", operationMaster);
app.use("/inspection", inspection);
app.use("/report", report);

//dashboard
app.use("/dashboard", dashboardRouter);

// Audit Management
app.use("/audit", audit);
app.use("/auditSchedule", auditSchedule)
app.use("/auditStatus", auditStatus)
app.use("/auditNc", auditNc)
app.use("/auditReports", auditReports)

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use('/auditManagement/uploads', express.static(path.join(__dirname, 'auditManagement/uploads')));
app.use('/auditManagement/template', express.static(path.join(__dirname, 'auditManagement/template')))


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const uniqueFileName = file.fieldname + "-" + uniqueSuffix + extension;
    cb(null, uniqueFileName);
  },
});


// export const upload = multer({ storage: storage });

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5 MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'));
  },
});


app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const name = req.file.filename;
    const id = req.body.id;
    let pool = await poolPromise;
    let response = await pool
      .request()
      .query(
        `update mst_checklist_items set image='${name}' where checklist_item_id='${id}'`
      );
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) { }
});

app.post("/uploadfile", upload.single("file"), async (req, res) => {
  try {
    const name = req.file.filename;
    const id = req.body.id;
    let pool = await poolPromise;
    let response = await pool
      .request()
      .query(`update mst_part set files='${name}' where part_id='${id}'`);
    if (response.rowsAffected[0] == 1) {
      res.status(201).json({ status: "success" });
    }
  } catch (error) { }
});

app.post("/uploadphoto", upload.single("file"), async (req, res) => {
  try {
    const name = req.file.filename;
    const id = req.body.id;
    console.log(name, id);
    let pool = await poolPromise;
    let response = await pool
      .request()
      .query(`update mst_employees set image='${name}' where emp_id='${id}'`);
    if (response.rowsAffected[0] == 1) {
      console.log(`response sent`);
      res.status(201).json({ status: "success" });
    }
  } catch (error) { }
});

app.post("/uploadlogo", upload.single("file"), async (req, res) => {
  try {
    console.log(req.body);

    // Check if the file is present
    if (!req.file) {
      return res.status(400).json({ status: "fail", message: "File not uploaded." });
    }

    const name = req.file.filename;
    const id = req.body.id;
    console.log(`Filename: ${name}, Company ID: ${id}`);

    let pool = await poolPromise;
    let response = await pool
      .request()
      .input('companyLogo', name)
      .input('companyId', id)
      .query(`UPDATE mst_company SET company_logo = @companyLogo WHERE company_id = @companyId`);

    if (response.rowsAffected[0] === 1) {
      console.log(`Response sent: success`);
      res.status(201).json({ status: "success" });
    } else {
      res.status(404).json({ status: "fail", message: "Company not found" });
    }
  } catch (error) {
    console.error(`Error occurred: ${error.message}`);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

// CronJob trigger
startAllJobs()
