import ExcelJS from 'exceljs';

export class ExportService {
  /**
   * Export an array of tabular objects to an Excel (.xlsx) Buffer
   */
  public static async exportToExcel(
    sheetName: string,
    columns: { header: string; key: string; width?: number }[],
    data: Record<string, unknown>[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RetailPro System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 18,
    }));

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Dark slate
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add rows
    for (const item of data) {
      worksheet.addRow(item);
    }

    // Border styling
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Export array of objects to CSV string
   */
  public static exportToCsv(
    columns: { header: string; key: string }[],
    data: Record<string, unknown>[]
  ): string {
    const headerLine = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key];
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    );

    return [headerLine, ...rows].join('\r\n');
  }
}
