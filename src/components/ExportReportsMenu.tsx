'use client';
import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface ExportReportsMenuProps {
  version: any;
  projectName: string;
  blueprintName: string;
}

export default function ExportReportsMenu({ version, projectName, blueprintName }: ExportReportsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Extract structured data
  const takeoff = version?.takeoffResult;
  const geometryData = version?.geometryData;
  const parsedRooms = geometryData ? JSON.parse(geometryData.rooms || '[]') : [];

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(`Material Takeoff Report`, 14, 22);
      
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Project: ${projectName}`, 14, 30);
      doc.text(`Blueprint: ${blueprintName} (v${version?.versionNumber})`, 14, 36);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

      if (takeoff) {
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(`Space Metrics & Quantities`, 14, 55);
        
        const metricsBody = [
          ['Wall Surface Area', `${takeoff.wallSurfaceArea.toLocaleString()} SQFT`],
          ['Floor/Ceiling Bound', `${takeoff.floorCeilingArea.toLocaleString()} SQFT`],
          ['Total Volume', `${takeoff.volume.toLocaleString()} CUFT`],
          ['Drywall Panels (4x8)', `${takeoff.drywallPanels.toLocaleString()}`],
          ['Wooden Studs (16" OC)', `${takeoff.studs.toLocaleString()}`],
          ['Paint Gallons (1 Coat)', `${takeoff.paintGallons.toLocaleString()}`],
        ];

        autoTable(doc, {
          startY: 60,
          head: [['Metric', 'Value']],
          body: metricsBody,
          theme: 'striped',
          headStyles: { fillColor: [79, 70, 229] } // Indigo 600
        });
      }

      if (parsedRooms && parsedRooms.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(0);
        let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 60;
        doc.text(`Rooms & Classifications`, 14, finalY + 15);
        
        const roomsBody = parsedRooms.map((room: any, index: number) => [
          `Room ${index + 1}`,
          room.classification || 'Unclassified',
          `${room.area} px²`,
          `${room.perimeter ? room.perimeter.toFixed(2) : 0} px`
        ]);

        autoTable(doc, {
          startY: finalY + 20,
          head: [['ID', 'Classification', 'Area', 'Perimeter']],
          body: roomsBody,
          theme: 'grid',
          headStyles: { fillColor: [55, 65, 81] }
        });
      }

      doc.save(`Takeoff_Report_${projectName.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Failed to export PDF');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const prepareExcelData = () => {
    const summarySheet = [
      { Metric: "Project", Value: projectName },
      { Metric: "Blueprint", Value: blueprintName },
      { Metric: "Version", Value: version?.versionNumber },
      { Metric: "Generated On", Value: new Date().toLocaleString() },
      {},
      { Metric: "Wall Surface Area (SQFT)", Value: takeoff?.wallSurfaceArea || 0 },
      { Metric: "Floor/Ceiling Bound (SQFT)", Value: takeoff?.floorCeilingArea || 0 },
      { Metric: "Total Volume (CUFT)", Value: takeoff?.volume || 0 },
      { Metric: "Drywall Panels (4x8)", Value: takeoff?.drywallPanels || 0 },
      { Metric: "Wooden Studs (16\" OC)", Value: takeoff?.studs || 0 },
      { Metric: "Paint Gallons (1 Coat)", Value: takeoff?.paintGallons || 0 }
    ];

    const roomsSheet = parsedRooms.map((room: any, idx: number) => ({
      ID: `Room ${idx + 1}`,
      Classification: room.classification || 'Unclassified',
      Area_px2: room.area,
      Perimeter_px: room.perimeter || 0
    }));

    return { summarySheet, roomsSheet };
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const { summarySheet, roomsSheet } = prepareExcelData();
      
      const wb = XLSX.utils.book_new();
      
      const wsSummary = XLSX.utils.json_to_sheet(summarySheet);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary Overview");
      
      if (roomsSheet.length > 0) {
        const wsRooms = XLSX.utils.json_to_sheet(roomsSheet);
        XLSX.utils.book_append_sheet(wb, wsRooms, "Extracted Rooms");
      }
      
      XLSX.writeFile(wb, `Takeoff_Report_${projectName.replace(/\s+/g, '_')}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Failed to export Excel');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const { summarySheet, roomsSheet } = prepareExcelData();
      
      // We will export a generic flattened CSV combining them or zip them. Let's just create a flattened CSV for summary.
      // Or better yet, we can generate a CSV of the summary and rooms separately, but JS doesn't download multiple files easily. 
      // We will export a unified detailed view or the rooms, combined with the project name.
      const csvData = [
          ['Project', projectName],
          ['Blueprint', blueprintName],
          ['Timestamp', new Date().toISOString()],
          [],
          ['Metric', 'Value'],
          ['Wall Surface Area (SQFT)', takeoff?.wallSurfaceArea || 0],
          ['Drywall Panels', takeoff?.drywallPanels || 0],
          ['Wooden Studs', takeoff?.studs || 0],
          ['Paint Gallons', takeoff?.paintGallons || 0],
          [],
          ['Room ID', 'Classification', 'Area (px2)', 'Perimeter (px)']
      ];

      parsedRooms.forEach((r: any, idx: number) => {
          csvData.push([`Room ${idx + 1}`, r.classification || 'Unclassified', r.area, r.perimeter || 0]);
      });

      const csvContent = Papa.unparse(csvData);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Takeoff_Report_${projectName.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
      alert('Failed to export CSV');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const handleExportJSON = () => {
    setIsExporting(true);
    try {
      const exportObject = {
        meta: {
          project: projectName,
          blueprint: blueprintName,
          version: version?.versionNumber,
          generatedAt: new Date().toISOString(),
        },
        takeoff: takeoff || {},
        rooms: parsedRooms
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `Takeoff_Report_${projectName.replace(/\s+/g, '_')}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch(e) {
       console.error(e);
       alert('Failed to export JSON');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        disabled={!takeoff && (!parsedRooms || parsedRooms.length === 0)}
        className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExporting ? 'Generating...' : 'Generate Reports'}
        <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <button onClick={handleExportPDF} className="flex px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left" role="menuitem">
              <svg className="mr-3 h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              Export to PDF
            </button>
            <button onClick={handleExportExcel} className="flex px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left" role="menuitem">
              <svg className="mr-3 h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              Export as Excel (.xlsx)
            </button>
            <button onClick={handleExportCSV} className="flex px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left" role="menuitem">
              <svg className="mr-3 h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              Export as CSV
            </button>
            <button onClick={handleExportJSON} className="flex px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left" role="menuitem">
              <svg className="mr-3 h-5 w-5 text-gray-800" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              Export Raw Data (JSON)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
