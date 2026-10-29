import * as XLSX from 'xlsx';
import { store } from '../data/store.js';

export function exportReleasesToExcel() {
  const releases = store.releases;
  const holidays = store.holidays;

  // Format releases for export matching the Excel columns
  const releaseRows = releases.map((r, idx) => ({
    '#': r.id || idx + 1,
    'Release Name': r.name,
    'RITM': r.ritm || '',
    'CR': r.cr || '',
    'Developer Name': r.developer || '',
    'Version / Tag': r.version || '',
    'Platform': r.platform || '',
    'Deployment Type': r.type || '',
    'Start Date': r.startDate || '',
    'Target Deploy': r.targetDeploy || '',
    'Current Stage': r.stage || '',
    'Stage Owner': r.owner || '',
    'Status': r.status || '',
    'DB Objects Changed': r.dbObjects || '',
    'Notes / Blockers': r.notes || '',
    'Email': r.email || '',
    'Holiday Conflict': r.holidayConflict || ''
  }));

  const holidayRows = holidays.map((h, idx) => ({
    '#': h.id || idx + 1,
    'Holiday Name': h.name,
    'Start Date': h.startDate || '',
    'End Date': h.endDate || '',
    'Notes': h.notes || ''
  }));

  const wb = XLSX.utils.book_new();

  // Add Release Calendar sheet
  const wsReleases = XLSX.utils.json_to_sheet(releaseRows);
  // Auto column width
  const colWidths = [
    { wch: 6 },  // #
    { wch: 36 }, // Release Name
    { wch: 14 }, // RITM
    { wch: 14 }, // CR
    { wch: 22 }, // Developer Name
    { wch: 14 }, // Version / Tag
    { wch: 12 }, // Platform
    { wch: 16 }, // Deployment Type
    { wch: 14 }, // Start Date
    { wch: 14 }, // Target Deploy
    { wch: 16 }, // Current Stage
    { wch: 16 }, // Stage Owner
    { wch: 14 }, // Status
    { wch: 28 }, // DB Objects Changed
    { wch: 28 }, // Notes
    { wch: 24 }, // Email
    { wch: 30 }  // Holiday Conflict
  ];
  wsReleases['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsReleases, 'Release Calendar');

  // Add Holidays sheet
  const wsHolidays = XLSX.utils.json_to_sheet(holidayRows);
  wsHolidays['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 32 }
  ];
  XLSX.utils.book_append_sheet(wb, wsHolidays, 'Holidays');

  const nowStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Teknosys-Release-Tracker_${nowStr}.xlsx`);
}

export function exportReleasesToCSV() {
  const releases = store.releases;
  const releaseRows = releases.map((r, idx) => ({
    'ID': r.id || idx + 1,
    'Release Name': r.name,
    'RITM': r.ritm || '',
    'CR': r.cr || '',
    'Developer': r.developer || '',
    'Version': r.version || '',
    'Platform': r.platform || '',
    'Deployment Type': r.type || '',
    'Start Date': r.startDate || '',
    'Target Deploy': r.targetDeploy || '',
    'Stage': r.stage || '',
    'Owner': r.owner || '',
    'Status': r.status || '',
    'DB Objects Changed': r.dbObjects || '',
    'Notes': r.notes || '',
    'Email': r.email || '',
    'Holiday Conflict': r.holidayConflict || ''
  }));

  const ws = XLSX.utils.json_to_sheet(releaseRows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Teknosys-Release-Tracker_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFile(file, mode = 'merge') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        let parsedReleases = [];
        let parsedHolidays = [];

        // Try to find Release Calendar sheet or first sheet
        const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('release')) || workbook.SheetNames[0];
        if (sheetName) {
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          // Find header row
          let headerIdx = -1;
          for (let i = 0; i < Math.min(10, rawRows.length); i++) {
            const row = rawRows[i] || [];
            if (row.some(c => typeof c === 'string' && c.toLowerCase().includes('release name'))) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx !== -1) {
            const headers = rawRows[headerIdx].map(h => String(h || '').trim());
            for (let i = headerIdx + 1; i < rawRows.length; i++) {
              const row = rawRows[i];
              if (!row || !row.length) continue;
              const rowObj = {};
              headers.forEach((h, colIdx) => {
                rowObj[h] = row[colIdx];
              });

              const name = rowObj['Release Name'] || rowObj['Name'];
              if (name) {
                parsedReleases.push({
                  id: parseInt(rowObj['#'] || rowObj['ID'] || parsedReleases.length + 1, 10),
                  name: String(name).trim(),
                  ritm: String(rowObj['RITM'] || '').trim(),
                  cr: String(rowObj['CR'] || '').trim(),
                  developer: String(rowObj['Developer Name'] || rowObj['Developer'] || '').trim(),
                  version: String(rowObj['Version / Tag'] || rowObj['Version'] || 'v1').trim(),
                  platform: String(rowObj['Platform'] || 'GSM').trim(),
                  type: String(rowObj['Deployment Type'] || rowObj['Type'] || 'Scheduled').trim(),
                  startDate: formatDate(rowObj['Start Date']),
                  targetDeploy: formatDate(rowObj['Target Deploy']),
                  stage: (function() {
                    const st = String(rowObj['Current Stage'] || rowObj['Stage'] || 'Development').trim();
                    if (st.toLowerCase() === 'on hold') return 'Development';
                    if (st === 'CAB / RFC' || st === 'CAB/RFC' || st.toLowerCase() === 'cab / rfc' || st.toLowerCase() === 'cab/rfc') return 'CAB';
                    if (st.toLowerCase() === 'code freeze') return 'CAB';
                    return st;
                  })(),
                  owner: String(rowObj['Stage Owner'] || rowObj['Owner'] || 'Dev Team').trim(),
                  status: (function() {
                    const rawStage = String(rowObj['Current Stage'] || rowObj['Stage'] || '').trim();
                    if (rawStage.toLowerCase() === 'on hold') return 'On Hold';
                    return String(rowObj['Status'] || 'On Track').trim();
                  })(),
                  dbObjects: String(rowObj['DB Objects Changed'] || '').trim(),
                  notes: String(rowObj['Notes / Blockers'] || rowObj['Notes'] || '').trim(),
                  email: String(rowObj['Email'] || '').trim()
                });
              }
            }
          }
        }

        // Check Holidays sheet
        const holSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('holiday'));
        if (holSheetName) {
          const sheet = workbook.Sheets[holSheetName];
          const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          let headerIdx = -1;
          for (let i = 0; i < Math.min(10, rawRows.length); i++) {
            const row = rawRows[i] || [];
            if (row.some(c => typeof c === 'string' && c.toLowerCase().includes('holiday name'))) {
              headerIdx = i;
              break;
            }
          }
          if (headerIdx !== -1) {
            const headers = rawRows[headerIdx].map(h => String(h || '').trim());
            for (let i = headerIdx + 1; i < rawRows.length; i++) {
              const row = rawRows[i];
              if (!row || !row.length) continue;
              const rowObj = {};
              headers.forEach((h, colIdx) => {
                rowObj[h] = row[colIdx];
              });
              const name = rowObj['Holiday Name'] || rowObj['Name'];
              if (name) {
                parsedHolidays.push({
                  id: parseInt(rowObj['#'] || parsedHolidays.length + 1, 10),
                  name: String(name).trim(),
                  startDate: formatDate(rowObj['Start Date']),
                  endDate: formatDate(rowObj['End Date'] || rowObj['Start Date']),
                  notes: String(rowObj['Notes'] || '').trim()
                });
              }
            }
          }
        }

        if (mode === 'replace') {
          if (parsedReleases.length > 0) store.releases = parsedReleases;
          if (parsedHolidays.length > 0) store.holidays = parsedHolidays;
        } else {
          // Merge
          for (const rel of parsedReleases) {
            const existingIdx = store.releases.findIndex(r => r.name.toLowerCase() === rel.name.toLowerCase());
            if (existingIdx !== -1) {
              store.releases[existingIdx] = { ...store.releases[existingIdx], ...rel };
            } else {
              store.releases.push(rel);
            }
          }
          if (parsedHolidays.length > 0) {
            for (const hol of parsedHolidays) {
              const exIdx = store.holidays.findIndex(h => h.name.toLowerCase() === hol.name.toLowerCase() && h.startDate === hol.startDate);
              if (exIdx === -1) store.holidays.push(hol);
            }
          }
        }

        store.recalculateAllHolidayConflicts();
        store.saveReleases();
        store.saveHolidays();
        store.notify();

        resolve({
          releasesImported: parsedReleases.length,
          holidaysImported: parsedHolidays.length
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function formatDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel date number
    const dt = new Date((val - (25567 + 2)) * 86400 * 1000);
    return dt.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return str;
}
