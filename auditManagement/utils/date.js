

export function getAuditDateInfo(scheduleDetails = []) {
    const auditDates = scheduleDetails
        .map(e => new Date(e.audit_date))
        .filter(d => !isNaN(d)); // filter out invalid dates

    if (!auditDates.length) return null;

    const minDate = new Date(Math.min(...auditDates));
    const maxDate = new Date(Math.max(...auditDates));

    const formatDate = (d) => d.toISOString().split('T')[0];

    const fromDate = formatDate(minDate);
    const toDate = formatDate(maxDate);
    const mandays = Math.floor((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;

    return { fromDate, toDate, mandays };
}