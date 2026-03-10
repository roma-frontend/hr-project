/**
 * Export driver trips to Excel
 */

import { writeXLSX } from 'xlsx';

interface TripData {
  date: string;
  driver: string;
  passenger: string;
  from: string;
  to: string;
  purpose: string;
  distanceKm: number;
  durationMin: number;
  status: string;
}

export function exportTripsToExcel(trips: TripData[], filename: string = 'driver-trips.xlsx') {
  // Prepare data for Excel
  const data = trips.map(trip => ({
    'Date': trip.date,
    'Driver': trip.driver,
    'Passenger': trip.passenger,
    'From': trip.from,
    'To': trip.to,
    'Purpose': trip.purpose,
    'Distance (km)': trip.distanceKm,
    'Duration (min)': trip.durationMin,
    'Status': trip.status,
  }));

  // Create workbook and worksheet
  const wb = {
    Sheets: {
      'Trips': {
        data: [
          // Header row
          [
            { v: 'Date', s: { font: { bold: true } } },
            { v: 'Driver', s: { font: { bold: true } } },
            { v: 'Passenger', s: { font: { bold: true } } },
            { v: 'From', s: { font: { bold: true } } },
            { v: 'To', s: { font: { bold: true } } },
            { v: 'Purpose', s: { font: { bold: true } } },
            { v: 'Distance (km)', s: { font: { bold: true } } },
            { v: 'Duration (min)', s: { font: { bold: true } } },
            { v: 'Status', s: { font: { bold: true } } },
          ],
          ...data.map(row => Object.values(row)),
        ],
      },
    },
    SheetNames: ['Trips'],
  };

  // Write to file (in browser, this will trigger download)
  const excelBuffer = writeXLSX(wb, { bookType: 'xlsx', type: 'buffer' });
  
  // Create blob and download
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);

  return { success: true, message: 'Excel file downloaded' };
}

export function exportTripsToCSV(trips: TripData[], filename: string = 'driver-trips.csv') {
  const headers = ['Date', 'Driver', 'Passenger', 'From', 'To', 'Purpose', 'Distance (km)', 'Duration (min)', 'Status'];
  
  const csv = [
    headers.join(','),
    ...trips.map(trip => 
      [
        trip.date,
        trip.driver,
        trip.passenger,
        trip.from,
        trip.to,
        trip.purpose,
        trip.distanceKm,
        trip.durationMin,
        trip.status,
      ].join(',')
    ),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);

  return { success: true, message: 'CSV file downloaded' };
}
