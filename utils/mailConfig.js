import nodemailer from "nodemailer";

export const mailconfig = nodemailer.createTransport({
    // host: "3.109.243.162",
    host: "10.101.0.10",
    port: 25,
    secure: false,
    auth: {
        // user: "noreplyrml@ranegroup.com",
        user: "DQMS@ranegroup.com",
        pass: "",
    },
    tls: {
        rejectUnauthorized: false,
    },
});


export const mailTriggerFrom = 'DQMS@ranegroup.com'