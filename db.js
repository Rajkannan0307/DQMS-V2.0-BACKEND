import * as dotenv from "dotenv";
import sqlDb from "mssql";

dotenv.config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER,
  requestTimeout: 0,
  pool: { min: 5, max: 1000 },

  options: {
    port: 1433,
    enableArithAbort: false,
    encrypt: false,
    database: process.env.DB_NAME,
    instance: process.env.DB_INSTANCE,
    rowCollectionOnDone: true,
    arrayRowMode: false,
    trustServerCertificate: false,
  },
};

export const sql = sqlDb;

export const poolPromise = new sqlDb.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log(
      `Connected to MSSQL ${process.env.DB_SERVER} with DB ${process.env.DB_NAME} `
    );
    // console.log(`Application Running in ${process.env.HOSTNAME}:${ process.env.PORT}`)
    return pool;
  })
  .catch((err) => console.log("Database Connection Failed! Bad Config: ", err));

export default poolPromise;
