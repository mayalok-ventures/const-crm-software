/**
 * Background Worker for Off-Heap XLSX Workbook Parsing
 *
 * Prevents synchronous xlsx.readFile / sheet_to_json CPU execution from
 * blocking the Node.js main event loop during bulk imports (5k, 20k, 50k rows).
 *
 * Enforces a strict 50,000 row safety limit, returning HTTP 413 code when exceeded.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const xlsx = require('xlsx');

if (!isMainThread) {
  try {
    const { filePath, buffer, maxRows = 50000 } = workerData;
    const workbook = filePath
      ? xlsx.readFile(filePath, { cellDates: true, dense: true })
      : xlsx.read(buffer, { type: 'buffer' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      parentPort.postMessage({ success: false, error: 'Uploaded file contains no worksheets' });
    } else {
      const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      if (rawRows.length > maxRows) {
        parentPort.postMessage({
          success: false,
          code: 'FILE_TOO_LARGE',
          error: `File exceeds maximum supported row limit of ${maxRows.toLocaleString()} rows (found ${rawRows.length.toLocaleString()} rows).`,
          rowCount: rawRows.length,
        });
      } else {
        parentPort.postMessage({ success: true, rows: rawRows, rowCount: rawRows.length });
      }
    }
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
  }
} else {
  /**
   * Spawns a dedicated worker thread to parse an XLSX file/buffer without event-loop blocking.
   * @param {Object} options - { filePath, buffer, maxRows }
   * @returns {Promise<{ success: boolean, rows?: any[], error?: string, code?: string, rowCount?: number }>}
   */
  function parseXlsxInWorker(options) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: options,
      });

      worker.on('message', (msg) => {
        resolve(msg);
      });

      worker.on('error', (err) => {
        reject(err);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`XLSX worker stopped with exit code ${code}`));
        }
      });
    });
  }

  module.exports = {
    parseXlsxInWorker,
  };
}

