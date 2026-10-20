// Client video 2026-10-19 (approved 2026-10-20): the Reports home is laid out like their old
// ServiceWorks "Insights" page -- a Favorites column plus Financial / Jobs / Employee & Payroll /
// POS columns, some reports grouped in folders. `builtin` reports have their own UI in
// Reports.tsx; the rest are generic tables from GET /api/reports/catalog/:id (CatalogReport).
// `range`: which date control the report uses -- a from/to range, a single as-of date, or none.
export type ReportRange = "range" | "asof" | "none";
export type ReportDef = { id: string; label: string; description: string; range: ReportRange; builtin?: boolean };
export type ReportFolder = { folder: string; items: ReportDef[] };
export type ReportCategory = { id: string; label: string; entries: (ReportDef | ReportFolder)[] };

export const isFolder = (e: ReportDef | ReportFolder): e is ReportFolder => "folder" in e;

export const reportCategories: ReportCategory[] = [
  {
    id: "financial",
    label: "Financial Report",
    entries: [
      { id: "daily-deposit", label: "Daily Deposit", range: "range", description: "Money received each day by payment type: invoice payments plus Point of Sale." },
      { id: "earnings", label: "Earning Report", range: "range", description: "Sales earned each day before tax: invoices plus Point of Sale tickets." },
      {
        folder: "Accounts & Payments",
        items: [
          { id: "due", label: "Accounts Outstanding", range: "none", builtin: true, description: "Every customer with unpaid invoices, split into 0-30, 31-60, 61-90 and 90+ days." },
          { id: "payments-received", label: "Payments Received", range: "range", description: "Every payment received, with check # or card used." },
          { id: "deposits", label: "Deposits", range: "range", builtin: true, description: "Down payments taken on invoices." },
          { id: "vendor-bills-due", label: "Vendor Bills Due", range: "none", description: "Vendor bills that aren't paid yet and how overdue they are." },
        ],
      },
      {
        folder: "Profit & Loss",
        items: [
          { id: "profit-loss", label: "Profit & Loss", range: "range", description: "Income, cost of goods sold, gross profit, expenses and net profit." },
          { id: "job-profit", label: "Job Profit", range: "range", description: "Revenue, cost and profit for each completed job." },
        ],
      },
      {
        folder: "Sales & Revenue",
        items: [
          { id: "sales-analysis", label: "Sales Analysis", range: "range", builtin: true, description: "Every sale and payment in the date range, grouped by payment type." },
          { id: "sales-by-customer", label: "Sales by Customer", range: "range", description: "Invoice and Point of Sale sales per customer." },
          { id: "sales-by-category", label: "Sales by Category", range: "range", description: "Sales, cost and profit per inventory category." },
        ],
      },
      {
        folder: "Tax & Compliance",
        items: [
          { id: "sales-tax", label: "Sales Tax", range: "range", builtin: true, description: "Taxable and non-taxable sales and tax collected, accrual or cash basis." },
        ],
      },
      {
        folder: "Inventory",
        items: [
          { id: "current-inventory", label: "Current Inventory for All Locations", range: "none", description: "Stock on hand right now at the store and every vehicle." },
          { id: "valuation", label: "Inventory Valuation", range: "asof", builtin: true, description: "Total value of your stock as of any date." },
          { id: "inventory-adjustments", label: "Inventory Adjustments", range: "range", description: "Write-offs and stock-count variances." },
          { id: "movement", label: "Item Movement", range: "range", builtin: true, description: "Quantity sold, used on jobs and written off per item." },
        ],
      },
    ],
  },
  {
    id: "jobs",
    label: "Jobs",
    entries: [
      { id: "one-trip", label: "Call Completed in One Trip", range: "range", description: "Completed jobs and whether each was finished on the day it was scheduled." },
      { id: "dispatch-risk", label: "Dispatch Risk Board", range: "range", description: "Scheduled jobs whose parts aren't in stock or are still on order (\"in jeopardy\")." },
      { id: "estimate-summary", label: "Estimate Summary", range: "range", description: "Estimates in the date range with a total per status." },
      { id: "jobs-by-zip", label: "Jobs by Zip Code", range: "range", description: "Number of jobs and revenue per zip code." },
      { id: "tech-line-item-profit", label: "Tech Line Item Profit", range: "range", description: "Revenue, cost and profit of each line item per technician." },
      { id: "reminders", label: "Reminders", range: "none", builtin: true, description: "Every customer's service reminders (filter cleaning, salt cell...) and when they're due." },
    ],
  },
  {
    id: "employee",
    label: "Employee & Payroll",
    entries: [
      { id: "daily-hours", label: "Daily Hours with Cost", range: "range", description: "Clocked hours per employee per day and what they cost." },
      { id: "employee-list", label: "Employee List", range: "none", description: "Everyone on your team with role, contact info and hourly rate." },
      { folder: "Payroll", items: [
        { id: "payroll-summary", label: "Payroll Summary", range: "range", description: "Regular and overtime hours and gross pay per payroll week." },
      ] },
      { folder: "Performance & Productivity", items: [
        { id: "tech-performance", label: "Technician Performance", range: "range", description: "Jobs completed, revenue, time on site and one-trip rate per technician." },
      ] },
      { folder: "Time & Attendance", items: [
        { id: "time-detail", label: "Time Clock Detail", range: "range", description: "Every clock in / clock out with hours and notes." },
        { id: "time-off", label: "Time Off Requests", range: "range", description: "Time off and other requests with their status." },
      ] },
    ],
  },
  {
    id: "pos",
    label: "POS",
    entries: [
      { id: "pos-with-note", label: "Customer Order with Note", range: "range", description: "Point of Sale tickets that have a note." },
      { id: "customer-sales-by-item", label: "Customer Sales by Item #", range: "range", description: "What each customer bought at the register, per item." },
      { id: "sales-by-salesperson", label: "Customer Sales by Sales Person", range: "range", description: "Point of Sale sales per sales person and customer." },
      { id: "order-items", label: "Order Items", range: "range", description: "Every item sold at the register." },
      { id: "pos-daily", label: "POS Daily Usage", range: "range", description: "Tickets, returns, items sold and totals per day." },
      { id: "sales-pending-serial", label: "Sales Pending Serial", range: "range", description: "Serialized products sold without a serial # entered yet." },
      { id: "serialized-items", label: "Serialized Items in POS", range: "range", description: "Every sale with a serial #, to look up who bought which unit." },
    ],
  },
];

export const allReports: ReportDef[] = reportCategories.flatMap((c) => c.entries.flatMap((e) => (isFolder(e) ? e.items : [e])));
export const findReport = (id: string | null | undefined) => allReports.find((r) => r.id === id) ?? null;
