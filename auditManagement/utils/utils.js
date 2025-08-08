export const TableName = {
    // 
    Mst_Audit_Checkpoint: "Mst_Audit_Checkpoint",
    Mst_Audit_Checkpoint_Revision: "Mst_Audit_Checkpoint_Revision",
    Mst_Audit_Checksheet: "Mst_Audit_Checksheet",

    mst_department: "mst_department",
    mst_employees: "mst_employees",

    Mst_Digital_Audit_Type: "Mst_Digital_Audit_Type",
    mst_plant: "mst_plant",

    //Audit schedule
    Trn_sudit_schedule_header: "trn_audit_schedule_header",
    Trn_audit_schedule_details: "trn_audit_schedule_details",
    Trn_audit_participants: "trn_audit_participants",


    //=== Audite status
    trn_audit_result: "trn_audit_result",
    trn_auditor_comments: "trn_auditor_comments",

    //===== Audit NC
    trn_audit_nc: "trn_audit_nc"
}

export const scheduleStatusEnum = {
    scheduled: "scheduled",
    cancelled: "cancelled",
    completed: "completed"
}


export const trnParticipantRoleEnum = {
    Auditor: "Auditor",
    Auditee: "Auditee"
}



export const trnAuditNcStatus = {
    OPEN: "OPEN",
    QUERY: "QUERY",
    SUBMITTED: "SUBMITTED",
    APPROVED: "APPROVED",
}

export const NcActionType = {
    auditee_save: "auditee_save",
    auditee_submit: "auditee_submit",
    auditor_approve: "auditor_approve",
    auditor_query: "auditor_query",
    auditor_save: "auditor_save",
};

