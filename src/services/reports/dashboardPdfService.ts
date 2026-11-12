import { jsPDF } from 'jspdf';
import { DashboardKPIs, MonthlyFinancialData, LeadConversionStatusData } from '../dashboard/dashboardAnalyticsService';
import { ClientProfile } from '../../types/client';
import { Project } from '../../types/project';
import { TrackingAsset } from '../../types/asset';
import { Invoice, Expense, Payment } from '../../types/finance';
import { Deliverable } from '../../types/deliverable';

export interface DashboardPdfExportOptions {
  reportTitle?: string;
  notes?: string;
  currency?: 'BDT' | 'USD';
  includeKPIs?: boolean;
  includeMonthlyTrend?: boolean;
  includeClientRoster?: boolean;
  includeLeadFunnel?: boolean;
  includeTrackingAssets?: boolean;
  generatedByName?: string;
  generatedByEmail?: string;
}

export interface DashboardReportData {
  kpis: DashboardKPIs;
  monthlyChartData: MonthlyFinancialData[];
  leadConversion: {
    data: LeadConversionStatusData[];
    totalLeads: number;
    conversionRate: number;
  };
  clients: ClientProfile[];
  projects: Project[];
  assets: TrackingAsset[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
}

export interface DeliverablesReportData {
  deliverables: Deliverable[];
  clients: ClientProfile[];
  projects: Project[];
  generatedByName?: string;
}

/**
 * Format currency numbers safely for standard PDF fonts (avoids unicode glyph rendering issues)
 */
function formatPdfCurrency(amount: number, currency: 'BDT' | 'USD' = 'BDT'): string {
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = currency === 'BDT' ? 'BDT ' : '$';
  return amount < 0 ? `-${prefix}${formatted}` : `${prefix}${formatted}`;
}

/**
 * Generates an executive-grade Analytics & Performance PDF report from dashboard telemetry
 */
export async function exportDashboardPdfReport(
  data: DashboardReportData,
  options: DashboardPdfExportOptions = {}
): Promise<void> {
  const {
    reportTitle = 'Executive Analytics & Performance Report',
    notes,
    currency = 'BDT',
    includeKPIs = true,
    includeMonthlyTrend = true,
    includeClientRoster = true,
    includeLeadFunnel = true,
    includeTrackingAssets = true,
    generatedByName = 'Agency Administrator',
    generatedByEmail = 'founder@bouncegrowth.com',
  } = options;

  // Initialize jsPDF A4 portrait: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  let currentY = 14;

  const reportId = `BGR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const nowFormatted = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Helper to ensure space or trigger page break
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 22) {
      doc.addPage();
      currentY = 20;
      drawRunningHeader();
    }
  };

  const drawRunningHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('BOUNCE GROWTH AGENCY — EXECUTIVE PERFORMANCE TELEMETRY', marginX, 10);
    doc.text(reportId, pageWidth - marginX, 10, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, 12, pageWidth - marginX, 12);
  };

  // ==========================================
  // 1. COVER / HEADER BANNER
  // ==========================================
  // Header background card
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(marginX, currentY, contentWidth, 38, 2, 2, 'F');

  // Decorative accent line
  doc.setFillColor(37, 99, 235); // Blue 600
  doc.rect(marginX, currentY + 36, contentWidth, 2, 'F');

  // Brand Tag
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(96, 165, 250); // Blue 400
  doc.text('BOUNCE GROWTH AGENCY  •  TRACKING-FIRST PERFORMANCE ENGINE', marginX + 6, currentY + 8);

  // Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(reportTitle.toUpperCase(), marginX + 6, currentY + 16);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text(
    'Cloud Firestore Real-Time Synchronized Data  |  Server-Side Tracking, CAPI & Media Ops',
    marginX + 6,
    currentY + 22
  );

  // Header Metadata block (Right side)
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Report ID: ${reportId}`, pageWidth - marginX - 6, currentY + 8, { align: 'right' });
  doc.text(`Generated: ${nowFormatted}`, pageWidth - marginX - 6, currentY + 14, { align: 'right' });
  doc.text(`Generated By: ${generatedByName}`, pageWidth - marginX - 6, currentY + 20, { align: 'right' });
  doc.text(`Currency: ${currency} (Official Ledger)`, pageWidth - marginX - 6, currentY + 26, { align: 'right' });

  // Status Badge in Header
  doc.setFillColor(5, 150, 105); // Emerald 600
  doc.roundedRect(marginX + 6, currentY + 26, 32, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('VERIFIED AUDIT', marginX + 22, currentY + 30, { align: 'center' });

  currentY += 44;

  // Optional Executive Remarks / Notes
  if (notes && notes.trim()) {
    checkPageBreak(18);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(marginX, currentY, contentWidth, 14, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('EXECUTIVE BRIEF / CONTEXT:', marginX + 4, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(notes.trim(), contentWidth - 8);
    doc.text(splitNotes, marginX + 4, currentY + 10);
    currentY += 18;
  }

  // ==========================================
  // 2. FINANCIAL SCORECARD (4 KPI TILES)
  // ==========================================
  if (includeKPIs) {
    checkPageBreak(40);

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Executive Financial Performance Scorecard', marginX, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Real-time cashflow metrics collected through agency invoices and recorded disbursements', marginX, currentY + 4);

    currentY += 8;

    const boxWidth = (contentWidth - 9) / 4; // 4 boxes with 3mm gap
    const boxHeight = 26;

    // Tile 1: Gross Cash Collected
    const kpiBoxes = [
      {
        title: 'GROSS CASH COLLECTED',
        value: formatPdfCurrency(data.kpis.totalRevenue, currency),
        sub: `Collection Rate: ${data.kpis.collectionRate}%`,
        fillColor: [240, 253, 244] as [number, number, number], // Emerald 50
        borderColor: [167, 243, 208] as [number, number, number],
        valColor: [5, 150, 105] as [number, number, number],
      },
      {
        title: 'OUTSTANDING RECEIVABLES',
        value: formatPdfCurrency(data.kpis.totalReceivables, currency),
        sub: `${data.kpis.unpaidInvoicesCount} Invoices Pending Payment`,
        fillColor: [254, 242, 242] as [number, number, number], // Rose 50
        borderColor: [254, 202, 202] as [number, number, number],
        valColor: [225, 29, 72] as [number, number, number],
      },
      {
        title: 'TOTAL OPERATING EXPENSES',
        value: formatPdfCurrency(data.kpis.totalExpenses, currency),
        sub: `Agency Infrastructure & Media`,
        fillColor: [255, 251, 235] as [number, number, number], // Amber 50
        borderColor: [253, 230, 138] as [number, number, number],
        valColor: [217, 119, 6] as [number, number, number],
      },
      {
        title: 'NET OPERATING PROFIT',
        value: formatPdfCurrency(data.kpis.netProfit, currency),
        sub: `Profit Margin: ${data.kpis.profitMargin}%`,
        fillColor: [239, 246, 255] as [number, number, number], // Blue 50
        borderColor: [191, 219, 254] as [number, number, number],
        valColor: [37, 99, 235] as [number, number, number],
      },
    ];

    kpiBoxes.forEach((box, i) => {
      const bx = marginX + i * (boxWidth + 3);
      doc.setFillColor(...box.fillColor);
      doc.setDrawColor(...box.borderColor);
      doc.setLineWidth(0.3);
      doc.roundedRect(bx, currentY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

      // Top label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text(box.title, bx + 3, currentY + 5.5);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...box.valColor);
      doc.text(box.value, bx + 3, currentY + 14);

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(box.sub, bx + 3, currentY + 20.5);
    });

    currentY += boxHeight + 8;
  }

  // ==========================================
  // 3. 6-MONTH MONTHLY TREND BREAKDOWN
  // ==========================================
  if (includeMonthlyTrend && data.monthlyChartData.length > 0) {
    checkPageBreak(50);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('2. 6-Month Cashflow & Operating Margin Trend', marginX, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Monthly progression of cash receipts, operational expenditures, and monthly net margins', marginX, currentY + 4);

    currentY += 7;

    // Table Header
    const colWidths = [36, 36, 36, 36, 38];
    const headers = ['Month Period', `Revenue (${currency})`, `Expenses (${currency})`, `Net Profit (${currency})`, 'Margin / Status'];

    doc.setFillColor(241, 245, 249); // Slate 100
    doc.rect(marginX, currentY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    let colX = marginX;
    headers.forEach((h, i) => {
      const align = i === 0 ? 'left' : 'right';
      const textX = align === 'left' ? colX + 3 : colX + colWidths[i] - 3;
      doc.text(h, textX, currentY + 4.5, { align });
      colX += colWidths[i];
    });

    currentY += 6.5;

    // Table Rows
    data.monthlyChartData.forEach((row, idx) => {
      checkPageBreak(7);
      const isAlt = idx % 2 === 1;
      if (isAlt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, currentY, contentWidth, 6, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.15);
      doc.line(marginX, currentY + 6, marginX + contentWidth, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      const marginPct = row.revenue > 0 ? Math.round((row.netProfit / row.revenue) * 100) : 0;
      const statusLabel = row.netProfit >= 0 ? `+${marginPct}% Margin` : `${marginPct}% Deficit`;

      let curColX = marginX;
      // Col 1: Month
      doc.text(row.fullLabel || row.monthName, curColX + 3, currentY + 4.2);
      curColX += colWidths[0];

      // Col 2: Revenue
      doc.setTextColor(5, 150, 105);
      doc.text(formatPdfCurrency(row.revenue, currency), curColX + colWidths[1] - 3, currentY + 4.2, { align: 'right' });
      curColX += colWidths[1];

      // Col 3: Expenses
      doc.setTextColor(217, 119, 6);
      doc.text(formatPdfCurrency(row.expenses, currency), curColX + colWidths[2] - 3, currentY + 4.2, { align: 'right' });
      curColX += colWidths[2];

      // Col 4: Net Profit
      if (row.netProfit >= 0) {
        doc.setTextColor(37, 99, 235);
      } else {
        doc.setTextColor(225, 29, 72);
      }
      doc.text(formatPdfCurrency(row.netProfit, currency), curColX + colWidths[3] - 3, currentY + 4.2, { align: 'right' });
      curColX += colWidths[3];

      // Col 5: Margin / Status
      if (row.netProfit >= 0) {
        doc.setTextColor(5, 150, 105);
      } else {
        doc.setTextColor(225, 29, 72);
      }
      doc.text(statusLabel, curColX + colWidths[4] - 3, currentY + 4.2, { align: 'right' });

      currentY += 6;
    });

    currentY += 8;
  }

  // ==========================================
  // 4. CLIENT RETAINER PORTFOLIO
  // ==========================================
  if (includeClientRoster && data.clients.length > 0) {
    checkPageBreak(50);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Active Client Accounts & Retainer Roster', marginX, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Contracted organizations, assigned retainer values, account lifecycle and tracking health', marginX, currentY + 4);

    currentY += 7;

    // Header
    const clientColWidths = [45, 30, 30, 35, 42];
    const clientHeaders = ['Client Organization', 'Industry / Focus', 'Retainer / Mo', 'Status', 'Services Subscribed'];

    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, currentY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    let clX = marginX;
    clientHeaders.forEach((h, i) => {
      const align = i === 2 ? 'right' : 'left';
      const textX = align === 'right' ? clX + clientColWidths[i] - 3 : clX + 3;
      doc.text(h, textX, currentY + 4.5, { align });
      clX += clientColWidths[i];
    });

    currentY += 6.5;

    // Client rows (max 12 clients in summary)
    const displayClients = data.clients.slice(0, 12);
    displayClients.forEach((client, idx) => {
      checkPageBreak(6.5);
      const isAlt = idx % 2 === 1;
      if (isAlt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, currentY, contentWidth, 6, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.15);
      doc.line(marginX, currentY + 6, marginX + contentWidth, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      let curX = marginX;

      // Col 1: Business Name
      doc.setFont('helvetica', 'bold');
      doc.text(doc.splitTextToSize(client.businessName || 'Unnamed Account', 42)[0], curX + 3, currentY + 4.2);
      doc.setFont('helvetica', 'normal');
      curX += clientColWidths[0];

      // Col 2: Industry
      doc.setTextColor(100, 116, 139);
      doc.text(client.industry || 'E-Commerce / DTC', curX + 3, currentY + 4.2);
      curX += clientColWidths[1];

      // Col 3: Retainer
      doc.setTextColor(5, 150, 105);
      const retainerVal = client.monthlyRetainer ? formatPdfCurrency(client.monthlyRetainer, currency) : `${currency} 0.00`;
      doc.text(retainerVal, curX + clientColWidths[2] - 3, currentY + 4.2, { align: 'right' });
      curX += clientColWidths[2];

      // Col 4: Status
      doc.setTextColor(30, 41, 59);
      const statusTitle = (client.status || 'active').toUpperCase();
      doc.text(statusTitle, curX + 3, currentY + 4.2);
      curX += clientColWidths[3];

      // Col 5: Services Subscribed
      doc.setTextColor(100, 116, 139);
      const services = client.servicesSubscribed && client.servicesSubscribed.length > 0
        ? client.servicesSubscribed.join(', ')
        : 'Meta CAPI, GA4 Server GTM';
      doc.text(doc.splitTextToSize(services, 38)[0], curX + 3, currentY + 4.2);

      currentY += 6;
    });

    currentY += 8;
  }

  // ==========================================
  // 5. CRM PIPELINE & LEAD CONVERSION METRICS
  // ==========================================
  if (includeLeadFunnel) {
    checkPageBreak(35);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('4. CRM Pipeline & Acquisition Funnel', marginX, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Lead conversion velocity and agency retainer acquisition telemetry', marginX, currentY + 4);

    currentY += 8;

    const funnelCardWidth = (contentWidth - 6) / 3;
    const funnelCardHeight = 20;

    const cards = [
      {
        label: 'TOTAL PIPELINE ACCOUNTS',
        count: `${data.leadConversion.totalLeads} Organizations`,
        desc: 'Active, Onboarding & Inquiries',
      },
      {
        label: 'WON CONVERSION VELOCITY',
        count: `${data.leadConversion.conversionRate}% Win Rate`,
        desc: 'Inquiries Converted to Retainers',
      },
      {
        label: 'ACTIVE CLIENT PROJECTS',
        count: `${data.projects.filter((p) => p.status !== 'completed').length} In-Flight`,
        desc: `${data.projects.length} Total Engagements Recorded`,
      },
    ];

    cards.forEach((card, i) => {
      const cx = marginX + i * (funnelCardWidth + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.roundedRect(cx, currentY, funnelCardWidth, funnelCardHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(card.label, cx + 3, currentY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(card.count, cx + 3, currentY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(card.desc, cx + 3, currentY + 17);
    });

    currentY += funnelCardHeight + 8;
  }

  // ==========================================
  // 6. SERVER-SIDE TRACKING & ASSETS HEALTH
  // ==========================================
  if (includeTrackingAssets && data.assets.length > 0) {
    checkPageBreak(40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('5. Server-Side Tracking & Asset Infrastructure Audit', marginX, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Enterprise Meta Conversion API (CAPI), Google Tag Manager Server-Side containers, and GA4 telemetry', marginX, currentY + 4);

    currentY += 7;

    const assetColWidths = [45, 35, 45, 25, 32];
    const assetHeaders = ['Asset Name', 'Asset Type', 'Identifier / Container ID', 'Status', 'Client Access'];

    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, currentY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    let ax = marginX;
    assetHeaders.forEach((h, i) => {
      doc.text(h, ax + 3, currentY + 4.5);
      ax += assetColWidths[i];
    });

    currentY += 6.5;

    const displayAssets = data.assets.slice(0, 10);
    displayAssets.forEach((asset, idx) => {
      checkPageBreak(6.5);
      const isAlt = idx % 2 === 1;
      if (isAlt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, currentY, contentWidth, 6, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.15);
      doc.line(marginX, currentY + 6, marginX + contentWidth, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      let curAx = marginX;
      // Col 1: Name
      doc.setFont('helvetica', 'bold');
      doc.text(doc.splitTextToSize(asset.name, 42)[0], curAx + 3, currentY + 4.2);
      doc.setFont('helvetica', 'normal');
      curAx += assetColWidths[0];

      // Col 2: Type
      doc.setTextColor(100, 116, 139);
      doc.text(asset.assetType || 'meta_pixel', curAx + 3, currentY + 4.2);
      curAx += assetColWidths[1];

      // Col 3: Identifier
      const identifier =
        asset.measurementId ||
        asset.containerId ||
        asset.pixelId ||
        asset.serverContainerUrl ||
        '—';
      doc.setTextColor(30, 41, 59);
      doc.text(doc.splitTextToSize(identifier, 42)[0], curAx + 3, currentY + 4.2);
      curAx += assetColWidths[2];

      // Col 4: Status
      doc.setTextColor(5, 150, 105);
      doc.text((asset.status || 'active').toUpperCase(), curAx + 3, currentY + 4.2);
      curAx += assetColWidths[3];

      // Col 5: Access Level
      doc.setTextColor(100, 116, 139);
      doc.text(asset.accessLevel || 'shared', curAx + 3, currentY + 4.2);

      currentY += 6;
    });

    currentY += 8;
  }

  // ==========================================
  // 7. EXECUTIVE AUTHORIZATION / SIGNATURE BLOCK
  // ==========================================
  checkPageBreak(30);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('VERIFICATION & EXECUTIVE ATTESTATION', marginX, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This analytical document was compiled dynamically from live Cloud Firestore telemetry. All transactional records, receivables, and tracking metrics reflect state at time of export.',
    marginX,
    currentY + 4,
    { maxWidth: contentWidth }
  );

  currentY += 14;

  const signColWidth = (contentWidth - 6) / 2;
  // Left: Authorized signatory
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(marginX, currentY + 5, marginX + 60, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('AUTHORIZED AGENCY PRINCIPAL', marginX, currentY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${generatedByName} (${generatedByEmail})`, marginX, currentY + 13);

  // Right: Date & Verification seal
  doc.setDrawColor(148, 163, 184);
  doc.line(marginX + signColWidth + 3, currentY + 5, marginX + signColWidth + 63, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('SYSTEM TIMESTAMP & AUDIT DATE', marginX + signColWidth + 3, currentY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${nowFormatted} (Official Release)`, marginX + signColWidth + 3, currentY + 13);

  // ==========================================
  // RUNNING FOOTERS ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Decorative bottom border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'CONFIDENTIAL — For Authorized Agency Principals & Stakeholders Only. Unauthorized duplication prohibited.',
      marginX,
      pageHeight - 9
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 9,
      { align: 'right' }
    );
  }

  // Trigger browser download
  const cleanFileName = `BounceGrowth_Executive_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(cleanFileName);
}

/**
 * Generates Deliverables & Performance Audit PDF from ReportsAnalyticsPage
 */
export async function exportDeliverablesPdfReport(
  data: DeliverablesReportData
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let currentY = 14;

  const reportId = `DELIV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const nowFormatted = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(marginX, currentY, contentWidth, 34, 2, 2, 'F');
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.rect(marginX, currentY + 32, contentWidth, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(52, 211, 153);
  doc.text('BOUNCE GROWTH AGENCY  •  CLIENT DELIVERABLES & PERFORMANCE AUDIT', marginX + 6, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('ANALYTICS DELIVERABLES & AUDIT MANIFEST', marginX + 6, currentY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Published Looker Studio dashboards, tracking audits, and conversion telemetry records', marginX + 6, currentY + 22);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Manifest ID: ${reportId}`, pageWidth - marginX - 6, currentY + 8, { align: 'right' });
  doc.text(`Generated: ${nowFormatted}`, pageWidth - marginX - 6, currentY + 14, { align: 'right' });
  doc.text(`Author: ${data.generatedByName || 'Admin'}`, pageWidth - marginX - 6, currentY + 20, { align: 'right' });

  currentY += 40;

  // Overview stats
  const totalDeliverables = data.deliverables.length;
  const approved = data.deliverables.filter((d) => d.status === 'approved').length;
  const submitted = data.deliverables.filter((d) => d.status === 'submitted' || d.status === 'under_review').length;

  const statWidth = (contentWidth - 6) / 3;
  const statBox = [
    { label: 'TOTAL DELIVERABLES', val: `${totalDeliverables} Published` },
    { label: 'APPROVED BY CLIENTS', val: `${approved} Approved` },
    { label: 'UNDER REVIEW / SUBMITTED', val: `${submitted} Pending` },
  ];

  statBox.forEach((b, i) => {
    const bx = marginX + i * (statWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.roundedRect(bx, currentY, statWidth, 18, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(b.label, bx + 3, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(b.val, bx + 3, currentY + 12);
  });

  currentY += 24;

  // Deliverables table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Client Deliverables & Report Links', marginX, currentY);
  currentY += 6;

  const colWidths = [50, 42, 30, 25, 35];
  const headers = ['Deliverable Title', 'Client Account', 'Version', 'Status', 'External URL / Asset'];

  doc.setFillColor(241, 245, 249);
  doc.rect(marginX, currentY, contentWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);

  let curX = marginX;
  headers.forEach((h, i) => {
    doc.text(h, curX + 3, currentY + 4.5);
    curX += colWidths[i];
  });

  currentY += 6.5;

  data.deliverables.forEach((item, idx) => {
    if (currentY + 8 > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, currentY, contentWidth, 6, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.15);
    doc.line(marginX, currentY + 6, marginX + contentWidth, currentY + 6);

    const client = data.clients.find((c) => c.id === item.clientId);
    const clientName = client ? client.businessName : 'Direct Agency';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);

    let rowX = marginX;
    // Col 1: Title
    doc.text(doc.splitTextToSize(item.title, 48)[0], rowX + 3, currentY + 4.2);
    rowX += colWidths[0];

    // Col 2: Client
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(clientName, 40)[0], rowX + 3, currentY + 4.2);
    rowX += colWidths[1];

    // Col 3: Version
    doc.text(`Version ${item.version || 1}`, rowX + 3, currentY + 4.2);
    rowX += colWidths[2];

    // Col 4: Status
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.status === 'approved' ? 5 : 37, item.status === 'approved' ? 150 : 99, item.status === 'approved' ? 105 : 235);
    doc.text((item.status || 'draft').toUpperCase(), rowX + 3, currentY + 4.2);
    rowX += colWidths[3];

    // Col 5: URL
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(item.externalUrl ? doc.splitTextToSize(item.externalUrl, 32)[0] : 'Internal Document', rowX + 3, currentY + 4.2);

    currentY += 6;
  });

  // Running footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Bounce Growth Agency — Deliverables & Analytics Audit Manifest', marginX, pageHeight - 9);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 9, { align: 'right' });
  }

  doc.save(`BounceGrowth_Deliverables_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
