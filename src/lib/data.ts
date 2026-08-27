// Mock data for ClearPool - realistic pool industry data

export const customers = [
  { id: "1", name: "James Thompson", type: "Residential", tags: ["VIP", "Seasonal"], address: "1428 Maple Ridge Dr, Austin, TX 78734", phone: "(512) 555-0142", email: "james.t@email.com", lastService: "2024-06-15", lifetimeValue: 8420, customerSince: "2021-03-12", lastContact: "2024-06-10", equipment: { pump: "Pentair IntelliFlo 3HP (2021)", heater: "Hayward H400FDN (2022)", filter: "DE 48 sqft (2021)", salt: "Pentair IC40 (2022)" }, gateCodes: { frontGate: "#4271", houseGate: "#4271", padlock: "", subdivisionEntrance: "open", notes: "Dog in backyard - friendly. Key padlock on side fence." } },
  { id: "2", name: "Sunset Country Club", type: "Commercial", tags: ["Commercial", "VIP"], address: "8900 Lakeview Pkwy, Austin, TX 78734", phone: "(512) 555-0298", email: "maintenance@sunsetcc.com", lastService: "2024-06-18", lifetimeValue: 48700, customerSince: "2019-01-08", lastContact: "2024-06-18", equipment: { pump: "2x Pentair 5HP (2020)", heater: "Hayward H500 (2020)", filter: "Sand 600lb (2020)", salt: "None" }, gateCodes: { frontGate: "", houseGate: "", padlock: "", subdivisionEntrance: "guard", notes: "Guard at main entrance - mention pool service. Service entrance on west side." } },
  { id: "3", name: "Maria & Carlos Rodriguez", type: "Residential", tags: ["Residential"], address: "3421 Hill Country Blvd, Austin, TX 78738", phone: "(512) 555-0376", email: "rodriguez.home@email.com", lastService: "2024-06-12", lifetimeValue: 5230, customerSince: "2022-07-20", lastContact: "2024-06-05", equipment: { pump: "Hayward Super Pump 1.5HP (2022)", heater: "Pentair Mastertemp 250 (2023)", filter: "Cartridge 200sqft (2022)", salt: "None" }, gateCodes: { frontGate: "#8892", houseGate: "#8892", padlock: "", subdivisionEntrance: "code", notes: "Gated community - keypad code at entrance. Pool access through side gate." } },
  { id: "4", name: "Austin Aquatic Center", type: "Commercial", tags: ["Commercial"], address: "1200 Shoal Creek Blvd, Austin, TX 78701", phone: "(512) 555-0455", email: "facilities@austinaquatic.org", lastService: "2024-06-17", lifetimeValue: 32100, customerSince: "2020-05-14", lastContact: "2024-06-17", equipment: { pump: "3x Commercial 7.5HP (2019)", heater: "Raypak 400k BTU (2019)", filter: "Commercial DE (2019)", salt: "None" } },
  { id: "5", name: "The Henderson Family", type: "Residential", tags: ["Residential", "VIP"], address: "5678 River Rd, Austin, TX 78746", phone: "(512) 555-0521", email: "hendersons@email.com", lastService: "2024-06-19", lifetimeValue: 12800, customerSince: "2020-11-03", lastContact: "2024-06-19", equipment: { pump: "Pentair WhisperFlo 2HP (2021)", heater: "Pentair Mastertemp 400 (2021)", filter: "DE 60sqft (2020)", salt: "Pentair IC60 (2021)" } },
  { id: "6", name: "Lake Travis Resort", type: "Commercial", tags: ["Commercial", "Seasonal"], address: "15000 FM 2769, Austin, TX 78734", phone: "(512) 555-0612", email: "ops@laketravisresort.com", lastService: "2024-06-14", lifetimeValue: 56200, customerSince: "2018-03-01", lastContact: "2024-06-14", equipment: { pump: "4x Pentair IntelliFlo (2018)", heater: "2x Hayward H500 (2018)", filter: "Sand 800lb (2018)", salt: "None" } },
  { id: "7", name: "Sarah Mitchell", type: "Residential", tags: ["Residential", "Lapsed"], address: "8901 Cypress Bend, Austin, TX 78759", phone: "(512) 555-0734", email: "sarah.m@email.com", lastService: "2024-03-22", lifetimeValue: 3900, customerSince: "2022-09-15", lastContact: "2024-03-22", equipment: { pump: "Hayward MaxFlo 1.5HP (2022)", heater: "None", filter: "Cartridge 150sqft (2022)", salt: "None" } },
  { id: "8", name: "Barton Springs Apartments", type: "Commercial", tags: ["Commercial"], address: "2000 Barton Springs Rd, Austin, TX 78704", phone: "(512) 555-0819", email: "mgmt@bartonapt.com", lastService: "2024-06-16", lifetimeValue: 21500, customerSince: "2021-06-10", lastContact: "2024-06-16", equipment: { pump: "2x Pentair 3HP (2021)", heater: "Hayward H300 (2021)", filter: "Cartridge 400sqft (2021)", salt: "None" } },
  { id: "9", name: "Michael Chen", type: "Residential", tags: ["Residential", "VIP"], address: "4567 Terraza Oaks, Austin, TX 78735", phone: "(512) 555-0927", email: "mchen@email.com", lastService: "2024-06-20", lifetimeValue: 15600, customerSince: "2019-08-22", lastContact: "2024-06-20", equipment: { pump: "Pentair IntelliFlo VSF (2020)", heater: "Pentair Mastertemp 400 (2020)", filter: "DE 60sqft (2019)", salt: "Pentair IC60 (2020)" } },
  { id: "10", name: "Westlake Hills HOA", type: "Commercial", tags: ["Commercial", "VIP"], address: "3000 Westlake Dr, Austin, TX 78746", phone: "(512) 555-1033", email: "board@westlakehoa.org", lastService: "2024-06-13", lifetimeValue: 38900, customerSince: "2017-04-01", lastContact: "2024-06-13", equipment: { pump: "3x Pentair IntelliFlo (2017)", heater: "2x Raypak 400k (2017)", filter: "Sand 600lb (2017)", salt: "None" } },
  { id: "11", name: "Jennifer Walsh", type: "Residential", tags: ["Residential", "Seasonal"], address: "1234 Bluebonnet Ln, Austin, TX 78704", phone: "(512) 555-1145", email: "jenwalsh@email.com", lastService: "2024-06-11", lifetimeValue: 7100, customerSince: "2021-05-18", lastContact: "2024-06-11", equipment: { pump: "Hayward Super Pump 2HP (2021)", heater: "Hayward H250 (2022)", filter: "Cartridge 250sqft (2021)", salt: "None" } },
  { id: "12", name: "Robert & Linda Kim", type: "Residential", tags: ["Residential"], address: "7890 Pecan Grove, Austin, TX 78731", phone: "(512) 555-1256", email: "rkim@email.com", lastService: "2024-06-09", lifetimeValue: 4500, customerSince: "2023-02-28", lastContact: "2024-06-09", equipment: { pump: "Pentair SuperFlo 1.5HP (2023)", heater: "None", filter: "Cartridge 200sqft (2023)", salt: "Pentair IC40 (2023)" } },
  { id: "13", name: "Cedar Park Rec Center", type: "Commercial", tags: ["Commercial"], address: "1430 Main St, Cedar Park, TX 78613", phone: "(512) 555-1367", email: "recreation@cedarpark.gov", lastService: "2024-06-08", lifetimeValue: 27800, customerSince: "2020-01-15", lastContact: "2024-06-08", equipment: { pump: "2x Pentair 5HP (2020)", heater: "Hayward H400 (2020)", filter: "DE 72sqft (2020)", salt: "None" } },
  { id: "14", name: "David Foster", type: "Residential", tags: ["Residential", "Lapsed"], address: "2345 Mesa Dr, Austin, TX 78733", phone: "(512) 555-1478", email: "dfoster@email.com", lastService: "2024-01-30", lifetimeValue: 2100, customerSince: "2023-04-10", lastContact: "2024-01-30", equipment: { pump: "Hayward MaxFlo 1HP (2023)", heater: "None", filter: "Cartridge 100sqft (2023)", salt: "None" } },
  { id: "15", name: "Emily & Tom Brooks", type: "Residential", tags: ["Residential", "VIP"], address: "6789 Summit Ridge, Austin, TX 78736", phone: "(512) 555-1589", email: "ebrooks@email.com", lastService: "2024-06-21", lifetimeValue: 9800, customerSince: "2020-07-05", lastContact: "2024-06-21", equipment: { pump: "Pentair IntelliFlo 3HP (2020)", heater: "Pentair Mastertemp 400 (2021)", filter: "DE 60sqft (2020)", salt: "Pentair IC60 (2021)" } },
  { id: "16", name: "Round Rock Fitness Club", type: "Commercial", tags: ["Commercial"], address: "3000 Gattis School Rd, Round Rock, TX 78664", phone: "(512) 555-1690", email: "facilities@rrfitness.com", lastService: "2024-06-07", lifetimeValue: 19500, customerSince: "2021-09-20", lastContact: "2024-06-07", equipment: { pump: "2x Pentair 3HP (2021)", heater: "Hayward H300 (2021)", filter: "Cartridge 400sqft (2021)", salt: "None" } },
  { id: "17", name: "Patricia Nguyen", type: "Residential", tags: ["Residential"], address: "8902 Oak Hollow, Austin, TX 78758", phone: "(512) 555-1701", email: "pnguyen@email.com", lastService: "2024-06-06", lifetimeValue: 3200, customerSince: "2023-08-12", lastContact: "2024-06-06", equipment: { pump: "Hayward Super Pump 1.5HP (2023)", heater: "None", filter: "Cartridge 200sqft (2023)", salt: "None" } },
  { id: "18", name: "Gregory & Amanda Stone", type: "Residential", tags: ["Residential", "Seasonal"], address: "3456 Canyon View, Austin, TX 78732", phone: "(512) 555-1812", email: "gstone@email.com", lastService: "2024-06-05", lifetimeValue: 6700, customerSince: "2021-11-30", lastContact: "2024-06-05", equipment: { pump: "Pentair WhisperFlo 2HP (2021)", heater: "Hayward H250 (2022)", filter: "DE 48sqft (2021)", salt: "Pentair IC40 (2022)" } },
  { id: "19", name: "Pflugerville Community Pool", type: "Commercial", tags: ["Commercial"], address: "500 W Pflugerville Pkwy, Pflugerville, TX 78660", phone: "(512) 555-1923", email: "parks@pflugervilletx.gov", lastService: "2024-06-04", lifetimeValue: 24500, customerSince: "2019-05-01", lastContact: "2024-06-04", equipment: { pump: "2x Pentair 5HP (2019)", heater: "Raypak 400k (2019)", filter: "Sand 600lb (2019)", salt: "None" } },
  { id: "20", name: "Steven & Rebecca Clark", type: "Residential", tags: ["Residential", "VIP"], address: "1122 Windy Ridge, Austin, TX 78734", phone: "(512) 555-2034", email: "sclark@email.com", lastService: "2024-06-22", lifetimeValue: 11400, customerSince: "2020-02-14", lastContact: "2024-06-22", equipment: { pump: "Pentair IntelliFlo VSF (2020)", heater: "Pentair Mastertemp 400 (2020)", filter: "DE 60sqft (2020)", salt: "Pentair IC60 (2020)" } },
  { id: "21", name: "Angela Torres", type: "Residential", tags: ["Residential"], address: "4455 Spanish Oaks, Austin, TX 78737", phone: "(512) 555-2145", email: "atorres@email.com", lastService: "2024-06-03", lifetimeValue: 4100, customerSince: "2023-01-20", lastContact: "2024-06-03", equipment: { pump: "Hayward MaxFlo 2HP (2023)", heater: "Hayward H250 (2023)", filter: "Cartridge 250sqft (2023)", salt: "None" } },
  { id: "22", name: "Bee Cave Ranch Resort", type: "Commercial", tags: ["Commercial", "Seasonal"], address: "15000 Hamilton Pool Rd, Bee Cave, TX 78738", phone: "(512) 555-2256", email: "operations@beecaveranch.com", lastService: "2024-06-02", lifetimeValue: 42100, customerSince: "2018-07-01", lastContact: "2024-06-02", equipment: { pump: "4x Pentair IntelliFlo (2018)", heater: "2x Hayward H500 (2018)", filter: "Sand 800lb (2018)", salt: "None" } },
  { id: "23", name: "Daniel Park", type: "Residential", tags: ["Residential", "Lapsed"], address: "6677 Balcones Woods, Austin, TX 78759", phone: "(512) 555-2367", email: "dpark@email.com", lastService: "2024-02-15", lifetimeValue: 1800, customerSince: "2023-06-05", lastContact: "2024-02-15", equipment: { pump: "Hayward Super Pump 1.5HP (2023)", heater: "None", filter: "Cartridge 150sqft (2023)", salt: "None" } },
  { id: "24", name: "Karen & Mark Lewis", type: "Residential", tags: ["Residential"], address: "9988 Lost Creek, Austin, TX 78735", phone: "(512) 555-2478", email: "klewis@email.com", lastService: "2024-06-01", lifetimeValue: 5600, customerSince: "2022-04-18", lastContact: "2024-06-01", equipment: { pump: "Pentair SuperFlo 2HP (2022)", heater: "Hayward H250 (2023)", filter: "DE 48sqft (2022)", salt: "Pentair IC40 (2023)" } },
  { id: "25", name: "Hyatt Regency Lost Pines", type: "Commercial", tags: ["Commercial", "VIP"], address: "575 Hyatt Lost Pines Rd, Cedar Creek, TX 78612", phone: "(512) 555-2589", email: "engineering@lostpines.hyatt.com", lastService: "2024-06-23", lifetimeValue: 67800, customerSince: "2016-01-01", lastContact: "2024-06-23", equipment: { pump: "6x Pentair IntelliFlo (2016)", heater: "4x Hayward H500 (2016)", filter: "Sand 1200lb (2016)", salt: "None" } },
];

export const customerNotes = {
  "1": [
    { id: "n1", text: "Customer prefers afternoon appointments. Has two dogs - keep gate closed.", date: "2024-06-10", author: "Bryan" },
    { id: "n2", text: "Salt cell reading low. Recommend IC40 upgrade next season.", date: "2024-05-22", author: "Mike" },
  ],
  "5": [
    { id: "n3", text: "VIP customer - always go above and beyond. Tip generously.", date: "2024-06-19", author: "Bryan" },
  ],
  "9": [
    { id: "n4", text: "Very particular about water chemistry. Test every visit.", date: "2024-06-20", author: "Mike" },
  ],
};

export const customerServiceHistory = {
  "1": [
    { id: "sh1", date: "2024-06-15", type: "Weekly Maintenance", tech: "Mike T.", amount: 145, status: "Completed" },
    { id: "sh2", date: "2024-06-08", type: "Filter Cleaning", tech: "Mike T.", amount: 185, status: "Completed" },
    { id: "sh3", date: "2024-05-30", type: "Weekly Maintenance", tech: "Mike T.", amount: 145, status: "Completed" },
  ],
  "5": [
    { id: "sh4", date: "2024-06-19", type: "Heater Repair", tech: "Bryan", amount: 420, status: "Completed" },
    { id: "sh5", date: "2024-06-12", type: "Weekly Maintenance", tech: "Mike T.", amount: 145, status: "Completed" },
    { id: "sh6", date: "2024-06-05", type: "Salt Cell Check", tech: "Bryan", amount: 95, status: "Completed" },
  ],
};

export const customerInvoices = {
  "1": [
    { id: "inv1", number: "INV-240615-001", date: "2024-06-15", amount: 145, status: "Paid" },
    { id: "inv2", number: "INV-240608-002", date: "2024-06-08", amount: 185, status: "Paid" },
  ],
  "5": [
    { id: "inv3", number: "INV-240619-003", date: "2024-06-19", amount: 420, status: "Paid" },
    { id: "inv4", number: "INV-240612-004", date: "2024-06-12", amount: 145, status: "Paid" },
  ],
};

export const jobs = [
  { id: "j1", customerId: "1", customerName: "James Thompson", type: "Maintenance", address: "1428 Maple Ridge Dr, Austin, TX", tech: "Mike T.", techAvatar: "MT", status: "Completed", stage: "completed", date: "2024-06-15", time: "10:00 AM", amount: 145, description: "Weekly maintenance service - skim, vacuum, brush, test and balance chemicals." },
  { id: "j2", customerId: "5", customerName: "The Henderson Family", type: "Repair", address: "5678 River Rd, Austin, TX", tech: "Bryan", techAvatar: "BR", status: "Completed", stage: "completed", date: "2024-06-19", time: "2:00 PM", amount: 420, description: "Heater not firing - diagnosed faulty igniter, replaced with OEM part." },
  { id: "j3", customerId: "9", customerName: "Michael Chen", type: "Maintenance", address: "4567 Terraza Oaks, Austin, TX", tech: "Jose", techAvatar: "JO", status: "In Progress", stage: "in_progress", date: "2024-06-20", time: "9:00 AM", amount: 145, description: "Weekly maintenance service." },
  { id: "j4", customerId: "2", customerName: "Sunset Country Club", type: "Maintenance", address: "8900 Lakeview Pkwy, Austin, TX", tech: "Mike T.", techAvatar: "MT", status: "Dispatched", stage: "dispatched", date: "2024-06-18", time: "7:00 AM", amount: 890, description: "Commercial pool maintenance - full service, chemical balance, filter check." },
  { id: "j5", customerId: "15", customerName: "Emily & Tom Brooks", type: "Install", address: "6789 Summit Ridge, Austin, TX", tech: "Bryan", techAvatar: "BR", status: "Booked", stage: "booked", date: "2024-06-24", time: "8:00 AM", amount: 2800, description: "Install new Pentair IntelliFlo VSF pump and upgrade to IC60 salt cell." },
  { id: "j6", customerId: "20", customerName: "Steven & Rebecca Clark", type: "Maintenance", address: "1122 Windy Ridge, Austin, TX", tech: "Jose", techAvatar: "JO", status: "Completed", stage: "completed", date: "2024-06-22", time: "11:00 AM", amount: 145, description: "Weekly maintenance." },
  { id: "j7", customerId: "7", customerName: "Sarah Mitchell", type: "Repair", address: "8901 Cypress Bend, Austin, TX", tech: "Mike T.", techAvatar: "MT", status: "Lead", stage: "lead", date: "2024-06-25", time: "3:00 PM", amount: 350, description: "Pump making loud noise - needs diagnosis and likely seal replacement." },
  { id: "j8", customerId: "11", customerName: "Jennifer Walsh", type: "Maintenance", address: "1234 Bluebonnet Ln, Austin, TX", tech: "Jose", techAvatar: "JO", status: "Booked", stage: "booked", date: "2024-06-24", time: "1:00 PM", amount: 145, description: "Weekly maintenance - seasonal restart." },
  { id: "j9", customerId: "3", customerName: "Maria & Carlos Rodriguez", type: "Repair", address: "3421 Hill Country Blvd, Austin, TX", tech: "Bryan", techAvatar: "BR", status: "In Progress", stage: "in_progress", date: "2024-06-20", time: "4:00 PM", amount: 275, description: "Filter leaking from clamp - inspect and replace O-ring." },
  { id: "j10", customerId: "6", customerName: "Lake Travis Resort", type: "Maintenance", address: "15000 FM 2769, Austin, TX", tech: "Mike T.", techAvatar: "MT", status: "Completed", stage: "completed", date: "2024-06-14", time: "6:00 AM", amount: 1200, description: "Resort pool maintenance - all 4 pools, chemical balance, filter backwash." },
  { id: "j11", customerId: "4", customerName: "Austin Aquatic Center", type: "Repair", address: "1200 Shoal Creek Blvd, Austin, TX", tech: "Bryan", techAvatar: "BR", status: "Dispatched", stage: "dispatched", date: "2024-06-21", time: "8:00 AM", amount: 1850, description: "Main pump motor failure - replace 7.5HP commercial pump motor." },
  { id: "j12", customerId: "14", customerName: "David Foster", type: "Maintenance", address: "2345 Mesa Dr, Austin, TX", tech: "Jose", techAvatar: "JO", status: "Lead", stage: "lead", date: "2024-06-26", time: "10:00 AM", amount: 145, description: "Customer reactivation - lapsed since January. Need to confirm appointment." },
];

export const technicians = [
  { id: "t1", name: "Mike T.", avatar: "MT", status: "On a job", currentJob: "j4", jobsToday: 2, phone: "(512) 555-3001", role: "Technician" },
  { id: "t2", name: "Bryan", avatar: "BR", status: "Available", currentJob: null, jobsToday: 1, phone: "(512) 555-3002", role: "Owner" },
  { id: "t3", name: "Jose", avatar: "JO", status: "On a job", currentJob: "j3", jobsToday: 3, phone: "(512) 555-3003", role: "Technician" },
  { id: "t4", name: "Sarah", avatar: "SA", status: "Available", currentJob: null, jobsToday: 0, phone: "(512) 555-3004", role: "Technician" },
  { id: "t5", name: "Dave", avatar: "DA", status: "Off", currentJob: null, jobsToday: 0, phone: "(512) 555-3005", role: "Technician" },
];

export const recurringRoutes = [
  { id: "r1", name: "Westlake Route", frequency: "Weekly", day: "Tuesday", tech: "Mike T.", customers: 8, avgTime: "6 hrs" },
  { id: "r2", name: "Lake Travis Route", frequency: "Bi-weekly", day: "Monday", tech: "Bryan", customers: 5, avgTime: "5 hrs" },
  { id: "r3", name: "Downtown Commercial", frequency: "Weekly", day: "Wednesday", tech: "Jose", customers: 4, avgTime: "4 hrs" },
  { id: "r4", name: "Cedar Park Route", frequency: "Weekly", day: "Thursday", tech: "Sarah", customers: 6, avgTime: "5 hrs" },
];

export const inventory = [
  { id: "p1", name: "3\" Chlorine Tablets", sku: "CHL-TAB-3IN", category: "Chemicals", storeQty: 48, v1Qty: 12, v2Qty: 8, v3Qty: 6, total: 74, reorder: 20, unitCost: 2.50, status: "In Stock" },
  { id: "p2", name: "Liquid Chlorine 1gal", sku: "CHL-LIQ-1G", category: "Chemicals", storeQty: 32, v1Qty: 6, v2Qty: 4, v3Qty: 4, total: 46, reorder: 15, unitCost: 4.75, status: "In Stock" },
  { id: "p3", name: "Muriatic Acid 1gal", sku: "CHEM-MA-1G", category: "Chemicals", storeQty: 18, v1Qty: 3, v2Qty: 2, v3Qty: 2, total: 25, reorder: 12, unitCost: 8.25, status: "In Stock" },
  { id: "p4", name: "Pentair IC40 Salt Cell", sku: "PEN-IC40", category: "Parts", storeQty: 3, v1Qty: 0, v2Qty: 0, v3Qty: 0, total: 3, reorder: 2, unitCost: 425.00, status: "Low" },
  { id: "p5", name: "Pentair IntelliFlo 3HP", sku: "PEN-IF3HP", category: "Equipment", storeQty: 2, v1Qty: 0, v2Qty: 0, v3Qty: 0, total: 2, reorder: 1, unitCost: 1850.00, status: "Low" },
  { id: "p6", name: "Hayward Super Pump 1.5HP", sku: "HAY-SP15", category: "Equipment", storeQty: 4, v1Qty: 1, v2Qty: 1, v3Qty: 0, total: 6, reorder: 2, unitCost: 495.00, status: "In Stock" },
  { id: "p7", name: "Filter Cartridge 200sqft", sku: "FIL-C200", category: "Parts", storeQty: 8, v1Qty: 2, v2Qty: 1, v3Qty: 1, total: 12, reorder: 5, unitCost: 85.00, status: "In Stock" },
  { id: "p8", name: "DE Filter Grids (set)", sku: "FIL-DESET", category: "Parts", storeQty: 6, v1Qty: 1, v2Qty: 1, v3Qty: 0, total: 8, reorder: 3, unitCost: 120.00, status: "In Stock" },
  { id: "p9", name: "Pump Seal Kit (generic)", sku: "SEAL-KIT-1", category: "Parts", storeQty: 15, v1Qty: 4, v2Qty: 3, v3Qty: 2, total: 24, reorder: 10, unitCost: 18.50, status: "In Stock" },
  { id: "p10", name: "O-Ring Assortment Box", sku: "ORING-BOX", category: "Parts", storeQty: 5, v1Qty: 1, v2Qty: 1, v3Qty: 1, total: 8, reorder: 4, unitCost: 35.00, status: "In Stock" },
  { id: "p11", name: "Taylor Test Kit K-2006", sku: "TEST-K2006", category: "Accessories", storeQty: 6, v1Qty: 1, v2Qty: 1, v3Qty: 1, total: 9, reorder: 3, unitCost: 65.00, status: "In Stock" },
  { id: "p12", name: "Hayward H250 Heater", sku: "HAY-H250", category: "Equipment", storeQty: 1, v1Qty: 0, v2Qty: 0, v3Qty: 0, total: 1, reorder: 1, unitCost: 2100.00, status: "Low" },
  { id: "p13", name: "Salt Cell Cleaning Stand", sku: "ACC-SCS", category: "Accessories", storeQty: 4, v1Qty: 1, v2Qty: 1, v3Qty: 0, total: 6, reorder: 2, unitCost: 22.00, status: "In Stock" },
  { id: "p14", name: "Pool Skimmer Net", sku: "ACC-SKIM", category: "Accessories", storeQty: 12, v1Qty: 3, v2Qty: 2, v3Qty: 2, total: 19, reorder: 6, unitCost: 14.00, status: "In Stock" },
  { id: "p15", name: "Chlorinator Lid O-Ring", sku: "ORING-CHL", category: "Parts", storeQty: 2, v1Qty: 0, v2Qty: 0, v3Qty: 0, total: 2, reorder: 5, unitCost: 3.50, status: "Low" },
  { id: "p16", name: "Algaecide 1qt", sku: "CHEM-ALG-1Q", category: "Chemicals", storeQty: 0, v1Qty: 0, v2Qty: 0, v3Qty: 0, total: 0, reorder: 8, unitCost: 12.00, status: "Out" },
  { id: "p17", name: "Pentair Mastertemp 400", sku: "PEN-MT400", category: "Equipment", storeQty: 1, v1Qty: 0, v2Qty: 0, v3Qty: 0, total: 1, reorder: 1, unitCost: 3200.00, status: "Low" },
  { id: "p18", name: "Heater Igniter Assembly", sku: "HAY-IGN-250", category: "Parts", storeQty: 3, v1Qty: 1, v2Qty: 0, v3Qty: 0, total: 4, reorder: 2, unitCost: 85.00, status: "In Stock" },
  { id: "p19", name: "Pool Vacuum Hose 50ft", sku: "ACC-VAC50", category: "Accessories", storeQty: 5, v1Qty: 1, v2Qty: 1, v3Qty: 1, total: 8, reorder: 3, unitCost: 45.00, status: "In Stock" },
  { id: "p20", name: "pH Down (pH Minus) 5lb", sku: "CHEM-PHD-5", category: "Chemicals", storeQty: 14, v1Qty: 3, v2Qty: 2, v3Qty: 2, total: 21, reorder: 8, unitCost: 9.50, status: "In Stock" },
];

export const suppliers = [
  { id: "s1", name: "Pentair Direct", contact: "sales@pentair.com", phone: "(800) 831-7133", products: 12, leadTime: "3-5 days" },
  { id: "s2", name: "Hayward Pool Products", contact: "orders@hayward.com", phone: "(908) 351-5400", products: 10, leadTime: "5-7 days" },
  { id: "s3", name: "Leslie's Pool Supplies", contact: " wholesale@lesliespool.com", phone: "(602) 341-5835", products: 25, leadTime: "2-3 days" },
  { id: "s4", name: "PoolCorp (SCP)", contact: "orders@poolcorp.com", phone: "(800) 284-4FUN", products: 40, leadTime: "1-2 days" },
  { id: "s5", name: "Taylor Technologies", contact: "support@taylorusa.com", phone: "(410) 472-4340", products: 4, leadTime: "7-10 days" },
];

export const purchaseOrders = [
  { id: "po1", number: "PO-2024-061", supplier: "PoolCorp (SCP)", status: "Received", total: 2840, items: 8, date: "2024-06-10", receivedDate: "2024-06-12" },
  { id: "po2", number: "PO-2024-062", supplier: "Pentair Direct", status: "Ordered", total: 5200, items: 3, date: "2024-06-18", receivedDate: null },
  { id: "po3", number: "PO-2024-063", supplier: "Hayward Pool Products", status: "Draft", total: 1650, items: 5, date: "2024-06-20", receivedDate: null },
  { id: "po4", number: "PO-2024-060", supplier: "Leslie's Pool Supplies", status: "Received", total: 890, items: 12, date: "2024-06-05", receivedDate: "2024-06-07" },
];

export const varianceData = [
  { id: "v1", product: "3\" Chlorine Tablets", expected: 74, actual: 68, variance: -8.1, flagged: false },
  { id: "v2", product: "Liquid Chlorine 1gal", expected: 46, actual: 42, variance: -8.7, flagged: false },
  { id: "v3", product: "Pentair IC40 Salt Cell", expected: 3, actual: 2, variance: -33.3, flagged: true },
  { id: "v4", product: "Hayward Super Pump 1.5HP", expected: 6, actual: 6, variance: 0, flagged: false },
  { id: "v5", product: "Filter Cartridge 200sqft", expected: 12, actual: 10, variance: -16.7, flagged: true },
  { id: "v6", product: "O-Ring Assortment Box", expected: 8, actual: 5, variance: -37.5, flagged: true },
  { id: "v7", product: "Algaecide 1qt", expected: 0, actual: 0, variance: 0, flagged: false },
  { id: "v8", product: "pH Down (pH Minus) 5lb", expected: 21, actual: 19, variance: -9.5, flagged: false },
];

export const vehicles = [
  { id: "v1", name: "Service Van 1", number: "TX-POOL-01", tech: "Mike T.", status: "Moving", location: "Lakeview Pkwy & FM 2769", speed: 35, mileage: 124, lastUpdate: "2 min ago" },
  { id: "v2", name: "Service Van 2", number: "TX-POOL-02", tech: "Bryan", status: "Parked", location: "5678 River Rd", speed: 0, mileage: 87, lastUpdate: "5 min ago" },
  { id: "v3", name: "Service Truck 3", number: "TX-POOL-03", tech: "Jose", status: "Moving", location: "I-35 N near exit 230", speed: 55, mileage: 156, lastUpdate: "1 min ago" },
  { id: "v4", name: "Service Van 4", number: "TX-POOL-04", tech: "Sarah", status: "Idle", location: "Shop - 1200 Warehouse Blvd", speed: 0, mileage: 0, lastUpdate: "12 min ago" },
];

export const tripHistory = [
  { id: "tr1", vehicle: "TX-POOL-01", start: "7:00 AM", end: "7:45 AM", startLoc: "Shop", endLoc: "Sunset Country Club", distance: 18.2, duration: "45 min" },
  { id: "tr2", vehicle: "TX-POOL-01", start: "8:15 AM", end: "8:30 AM", startLoc: "Sunset Country Club", endLoc: "Lake Travis Resort", distance: 6.4, duration: "15 min" },
  { id: "tr3", vehicle: "TX-POOL-02", start: "8:00 AM", end: "8:20 AM", startLoc: "Shop", endLoc: "Henderson Family", distance: 12.5, duration: "20 min" },
  { id: "tr4", vehicle: "TX-POOL-03", start: "7:30 AM", end: "8:05 AM", startLoc: "Shop", endLoc: "Austin Aquatic Center", distance: 14.8, duration: "35 min" },
  { id: "tr5", vehicle: "TX-POOL-03", start: "9:00 AM", end: "9:25 AM", startLoc: "Austin Aquatic Center", endLoc: "Rodriguez Residence", distance: 8.2, duration: "25 min" },
];

export const geofenceAlerts = [
  { id: "g1", vehicle: "TX-POOL-01", message: "Left service zone", time: "8:35 AM", severity: "warning" },
  { id: "g2", vehicle: "TX-POOL-03", message: "Entered restricted zone", time: "9:10 AM", severity: "warning" },
];

export const employees = [
  { id: "e1", name: "Bryan", role: "Owner", type: "Employee", phone: "(512) 555-3002", email: "bryan@poolbrayne.com", hourlyRate: 0, salary: 85000 },
  { id: "e2", name: "Mike T.", role: "Technician", type: "Employee", phone: "(512) 555-3001", email: "mike@poolbrayne.com", hourlyRate: 28, salary: 0 },
  { id: "e3", name: "Jose", role: "Technician", type: "Employee", phone: "(512) 555-3003", email: "jose@poolbrayne.com", hourlyRate: 26, salary: 0 },
  { id: "e4", name: "Sarah", role: "Technician", type: "Contractor", phone: "(512) 555-3004", email: "sarah@poolbrayne.com", hourlyRate: 32, salary: 0 },
  { id: "e5", name: "Dave", role: "Technician", type: "Employee", phone: "(512) 555-3005", email: "dave@poolbrayne.com", hourlyRate: 24, salary: 0 },
  { id: "e6", name: "Amanda", role: "Office Manager", type: "Employee", phone: "(512) 555-3006", email: "amanda@poolbrayne.com", hourlyRate: 22, salary: 0 },
];

export const timesheetData = [
  { id: "ts1", employeeId: "e2", name: "Mike T.", type: "Employee", mon: 8, tue: 8.5, wed: 9, thu: 8, fri: 7, sat: 4, sun: 0, total: 44.5, ot: 4.5, status: "Pending" },
  { id: "ts2", employeeId: "e3", name: "Jose", type: "Employee", mon: 8, tue: 8, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0, total: 40, ot: 0, status: "Pending" },
  { id: "ts3", employeeId: "e4", name: "Sarah", type: "Contractor", mon: 6, tue: 6, wed: 6, thu: 6, fri: 6, sat: 0, sun: 0, total: 30, ot: 0, status: "Pending" },
  { id: "ts4", employeeId: "e5", name: "Dave", type: "Employee", mon: 8, tue: 10, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0, total: 42, ot: 2, status: "Pending" },
  { id: "ts5", employeeId: "e6", name: "Amanda", type: "Employee", mon: 8, tue: 8, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0, total: 40, ot: 0, status: "Pending" },
  { id: "ts6", employeeId: "e1", name: "Bryan", type: "Employee", mon: 6, tue: 8, wed: 6, thu: 8, fri: 4, sat: 0, sun: 0, total: 32, ot: 0, status: "Approved" },
];

export const jobCosting = [
  { id: "jc1", tech: "Mike T.", job: "Sunset Country Club - Maintenance", hours: 4.5, laborCost: 126, date: "2024-06-18" },
  { id: "jc2", tech: "Mike T.", job: "Lake Travis Resort - Maintenance", hours: 5, laborCost: 140, date: "2024-06-14" },
  { id: "jc3", tech: "Bryan", job: "Henderson Family - Heater Repair", hours: 3, laborCost: 0, date: "2024-06-19" },
  { id: "jc4", tech: "Jose", job: "Chen Residence - Maintenance", hours: 2, laborCost: 52, date: "2024-06-20" },
  { id: "jc5", tech: "Jose", job: "Rodriguez - Filter Repair", hours: 1.5, laborCost: 39, date: "2024-06-20" },
  { id: "jc6", tech: "Mike T.", job: "Thompson - Filter Cleaning", hours: 1.5, laborCost: 42, date: "2024-06-08" },
];

export const invoices = [
  { id: "inv1", number: "INV-240615-001", customer: "James Thompson", customerId: "1", issueDate: "2024-06-15", dueDate: "2024-06-29", amount: 145, status: "Paid", paidDate: "2024-06-16", method: "Card", daysToPay: 1 },
  { id: "inv2", number: "INV-240608-002", customer: "James Thompson", customerId: "1", issueDate: "2024-06-08", dueDate: "2024-06-22", amount: 185, status: "Paid", paidDate: "2024-06-10", method: "ACH", daysToPay: 2 },
  { id: "inv3", number: "INV-240619-003", customer: "The Henderson Family", customerId: "5", issueDate: "2024-06-19", dueDate: "2024-07-03", amount: 420, status: "Paid", paidDate: "2024-06-20", method: "Card", daysToPay: 1 },
  { id: "inv4", number: "INV-240612-004", customer: "The Henderson Family", customerId: "5", issueDate: "2024-06-12", dueDate: "2024-06-26", amount: 145, status: "Paid", paidDate: "2024-06-14", method: "Card", daysToPay: 2 },
  { id: "inv5", number: "INV-240620-005", customer: "Michael Chen", customerId: "9", issueDate: "2024-06-20", dueDate: "2024-07-04", amount: 145, status: "Sent", paidDate: null, method: null, daysToPay: null },
  { id: "inv6", number: "INV-240618-006", customer: "Sunset Country Club", customerId: "2", issueDate: "2024-06-18", dueDate: "2024-07-02", amount: 890, status: "Sent", paidDate: null, method: null, daysToPay: null },
  { id: "inv7", number: "INV-240614-007", customer: "Lake Travis Resort", customerId: "6", issueDate: "2024-06-14", dueDate: "2024-06-28", amount: 1200, status: "Overdue", paidDate: null, method: null, daysToPay: null },
  { id: "inv8", number: "INV-240621-008", customer: "Austin Aquatic Center", customerId: "4", issueDate: "2024-06-21", dueDate: "2024-07-05", amount: 1850, status: "Draft", paidDate: null, method: null, daysToPay: null },
  { id: "inv9", number: "INV-240522-009", customer: "Sarah Mitchell", customerId: "7", issueDate: "2024-05-22", dueDate: "2024-06-05", amount: 145, status: "Overdue", paidDate: null, method: null, daysToPay: null },
  { id: "inv10", number: "INV-240510-010", customer: "David Foster", customerId: "14", issueDate: "2024-05-10", dueDate: "2024-05-24", amount: 145, status: "Overdue", paidDate: null, method: null, daysToPay: null },
  { id: "inv11", number: "INV-240605-011", customer: "Jennifer Walsh", customerId: "11", issueDate: "2024-06-05", dueDate: "2024-06-19", amount: 145, status: "Paid", paidDate: "2024-06-06", method: "Card", daysToPay: 1 },
  { id: "inv12", number: "INV-240601-012", customer: "Karen & Mark Lewis", customerId: "24", issueDate: "2024-06-01", dueDate: "2024-06-15", amount: 145, status: "Paid", paidDate: "2024-06-03", method: "ACH", daysToPay: 2 },
  { id: "inv13", number: "INV-240530-013", customer: "Barton Springs Apts", customerId: "8", issueDate: "2024-05-30", dueDate: "2024-06-13", amount: 2150, status: "Overdue", paidDate: null, method: null, daysToPay: null },
  { id: "inv14", number: "INV-240622-014", customer: "Steven & Rebecca Clark", customerId: "20", issueDate: "2024-06-22", dueDate: "2024-07-06", amount: 145, status: "Sent", paidDate: null, method: null, daysToPay: null },
  { id: "inv15", number: "INV-240623-015", customer: "Hyatt Regency Lost Pines", customerId: "25", issueDate: "2024-06-23", dueDate: "2024-07-07", amount: 3400, status: "Sent", paidDate: null, method: null, daysToPay: null },
];

export const recurringBilling = [
  { id: "rb1", customer: "James Thompson", frequency: "Weekly", amount: 145, nextCharge: "2024-06-29", status: "Active" },
  { id: "rb2", customer: "The Henderson Family", frequency: "Weekly", amount: 145, nextCharge: "2024-06-26", status: "Active" },
  { id: "rb3", customer: "Michael Chen", frequency: "Weekly", amount: 145, nextCharge: "2024-06-27", status: "Active" },
  { id: "rb4", customer: "Sunset Country Club", frequency: "Weekly", amount: 890, nextCharge: "2024-06-25", status: "Active" },
  { id: "rb5", customer: "Westlake Hills HOA", frequency: "Weekly", amount: 1200, nextCharge: "2024-06-27", status: "Active" },
  { id: "rb6", customer: "Lake Travis Resort", frequency: "Bi-weekly", amount: 1200, nextCharge: "2024-06-28", status: "Active" },
];

export const payments = [
  { id: "pay1", invoice: "INV-240615-001", customer: "James Thompson", amount: 145, date: "2024-06-16", method: "Card", status: "Success" },
  { id: "pay2", invoice: "INV-240608-002", customer: "James Thompson", amount: 185, date: "2024-06-10", method: "ACH", status: "Success" },
  { id: "pay3", invoice: "INV-240619-003", customer: "The Henderson Family", amount: 420, date: "2024-06-20", method: "Card", status: "Success" },
  { id: "pay4", invoice: "INV-240612-004", customer: "The Henderson Family", amount: 145, date: "2024-06-14", method: "Card", status: "Success" },
  { id: "pay5", invoice: "INV-240605-011", customer: "Jennifer Walsh", amount: 145, date: "2024-06-06", method: "Card", status: "Success" },
  { id: "pay6", invoice: "INV-240601-012", customer: "Karen & Mark Lewis", amount: 145, date: "2024-06-03", method: "ACH", status: "Success" },
];

export const invoiceLineItems = {
  "inv7": [
    { description: "Commercial maintenance - 4 pools", quantity: 1, rate: 800, amount: 800 },
    { description: "Chemicals (chlorine, pH adjuster)", quantity: 1, rate: 200, amount: 200 },
    { description: "Filter backwash service", quantity: 4, rate: 50, amount: 200 },
  ],
  "inv8": [
    { description: "Pump motor replacement - 7.5HP", quantity: 1, rate: 1200, amount: 1200 },
    { description: "Labor - 4 hours", quantity: 4, rate: 125, amount: 500 },
    { description: "O-ring and gasket kit", quantity: 1, rate: 150, amount: 150 },
  ],
};

export const automations = [
  { id: "a1", name: "Post-Service Follow-Up", description: "Send SMS and email after each completed service visit", trigger: "Job marked complete", channel: "SMS + Email", enrolled: 22, conversions: "94%", active: true, icon: "MessageSquare" },
  { id: "a2", name: "Lapsed Customer Win-Back", description: "Re-engage customers after 90 days of inactivity", trigger: "90 days since last service", channel: "SMS + Email", enrolled: 5, conversions: "40%", active: true, icon: "UserPlus" },
  { id: "a3", name: "Review Request", description: "Ask for Google/Facebook review after job completion", trigger: "Job complete + 24 hours", channel: "SMS", enrolled: 22, conversions: "32%", active: true, icon: "Star" },
  { id: "a4", name: "Seasonal Opening Reminder", description: "Remind seasonal customers to schedule pool opening", trigger: "March 1", channel: "Email", enrolled: 6, conversions: "85%", active: true, icon: "Calendar" },
  { id: "a5", name: "Payment Reminder", description: "Gentle reminder before invoice due date", trigger: "3 days before due", channel: "SMS", enrolled: 25, conversions: "78%", active: true, icon: "CreditCard" },
];

export const seasonalCampaigns = [
  { id: "c1", name: "Pool Opening Special", status: "Active", audience: 45, scheduledDate: "2024-03-01", sentDate: "2024-03-01", openRate: "68%", replyRate: "12%", bookings: 18, revenue: 8100 },
  { id: "c2", name: "Mid-Season Chemical Check-In", status: "Scheduled", audience: 60, scheduledDate: "2024-07-15", sentDate: null, openRate: null, replyRate: null, bookings: null, revenue: null },
  { id: "c3", name: "Pool Closing Special", status: "Draft", audience: 45, scheduledDate: "2024-09-15", sentDate: null, openRate: null, replyRate: null, bookings: null, revenue: null },
  { id: "c4", name: "Equipment Upgrade Promo", status: "Active", audience: 30, scheduledDate: "2024-06-15", sentDate: "2024-06-15", openRate: "52%", replyRate: "8%", bookings: 4, revenue: 11200 },
];

export const smsConversations = [
  {
    id: "conv1",
    customer: "James Thompson",
    customerId: "1",
    lastMessage: "Thanks for the great service today!",
    unread: 0,
    messages: [
      { id: "m1", from: "business", text: "Hi James, this is ClearPool confirming your maintenance appointment tomorrow at 10 AM.", time: "2024-06-14 4:00 PM" },
      { id: "m2", from: "customer", text: "Perfect, thanks for the reminder!", time: "2024-06-14 4:15 PM" },
      { id: "m3", from: "business", text: "Mike is on his way. ETA: 9:45 AM", time: "2024-06-15 9:30 AM" },
      { id: "m4", from: "customer", text: "Thanks for the great service today!", time: "2024-06-15 11:30 AM" },
    ],
  },
  {
    id: "conv2",
    customer: "The Henderson Family",
    customerId: "5",
    lastMessage: "Can you send the invoice?",
    unread: 1,
    messages: [
      { id: "m5", from: "business", text: "Your heater repair is complete. Everything is running perfectly.", time: "2024-06-19 3:00 PM" },
      { id: "m6", from: "customer", text: "Great! How much was it?", time: "2024-06-19 3:05 PM" },
      { id: "m7", from: "business", text: "Total is $420. Invoice is being sent to your email now.", time: "2024-06-19 3:10 PM" },
      { id: "m8", from: "customer", text: "Can you send the invoice?", time: "2024-06-19 3:12 PM" },
    ],
  },
  {
    id: "conv3",
    customer: "Sarah Mitchell",
    customerId: "7",
    lastMessage: "We miss you! Book your next service and get 10% off.",
    unread: 0,
    messages: [
      { id: "m9", from: "business", text: "Hi Sarah, we noticed it's been a while since your last service. Is everything ok with your pool?", time: "2024-05-15 10:00 AM" },
      { id: "m10", from: "customer", text: "I've been traveling a lot. Will schedule soon.", time: "2024-05-15 11:00 AM" },
      { id: "m11", from: "business", text: "We miss you! Book your next service and get 10% off.", time: "2024-06-15 10:00 AM" },
    ],
  },
  {
    id: "conv4",
    customer: "Michael Chen",
    customerId: "9",
    lastMessage: "Water looks perfect. Thanks!",
    unread: 0,
    messages: [
      { id: "m12", from: "business", text: "Jose completed your weekly service. Chemicals are balanced and water is crystal clear.", time: "2024-06-20 10:30 AM" },
      { id: "m13", from: "customer", text: "Water looks perfect. Thanks!", time: "2024-06-20 11:00 AM" },
    ],
  },
];

export const reviews = [
  { id: "rev1", customer: "James Thompson", platform: "Google", rating: 5, text: "ClearPool keeps our pool looking amazing every week. Professional and reliable.", date: "2024-06-16", response: "Thank you James!" },
  { id: "rev2", customer: "The Henderson Family", platform: "Facebook", rating: 5, text: "Bryan fixed our heater in one visit. Fair pricing and honest service.", date: "2024-06-20", response: "Thank you! We appreciate your trust." },
  { id: "rev3", customer: "Michael Chen", platform: "Google", rating: 4, text: "Great service. Would recommend to anyone in the Austin area.", date: "2024-06-21", response: "Thank you Michael!" },
  { id: "rev4", customer: "Jennifer Walsh", platform: "Google", rating: 5, text: "Seasonal opening was seamless. They even cleaned up leaves from the cover.", date: "2024-04-02", response: "So glad we could help!" },
];

export const campaignPerformance = [
  { id: "cp1", campaign: "Pool Opening Special", sent: 45, opened: 31, openRate: "68%", replies: 5, replyRate: "11%", bookings: 18, revenue: 8100 },
  { id: "cp2", campaign: "Equipment Upgrade Promo", sent: 30, opened: 16, openRate: "53%", replies: 2, replyRate: "7%", bookings: 4, revenue: 11200 },
  { id: "cp3", campaign: "Lapsed Win-Back", sent: 5, opened: 4, openRate: "80%", replies: 2, replyRate: "40%", bookings: 2, revenue: 290 },
];

export const dashboardKPIs = {
  revenue: 182400,
  revenueChange: 12.4,
  jobsCompleted: 247,
  jobsChange: 8.2,
  outstandingInvoices: 34900,
  outstandingCount: 12,
  outstandingChange: -3.1,
  newCustomers: 18,
  newCustomersChange: 28.6,
};

export const revenueByMonth = [
  { month: "Jul 23", revenue: 128000 },
  { month: "Aug 23", revenue: 135000 },
  { month: "Sep 23", revenue: 118000 },
  { month: "Oct 23", revenue: 95000 },
  { month: "Nov 23", revenue: 78000 },
  { month: "Dec 23", revenue: 72000 },
  { month: "Jan 24", revenue: 68000 },
  { month: "Feb 24", revenue: 75000 },
  { month: "Mar 24", revenue: 112000 },
  { month: "Apr 24", revenue: 138000 },
  { month: "May 24", revenue: 165000 },
  { month: "Jun 24", revenue: 182400 },
];

export const jobsPerWeek = [
  { week: "W1", jobs: 52 },
  { week: "W2", jobs: 58 },
  { week: "W3", jobs: 61 },
  { week: "W4", jobs: 55 },
  { week: "W5", jobs: 62 },
  { week: "W6", jobs: 59 },
  { week: "W7", jobs: 64 },
  { week: "W8", jobs: 60 },
  { week: "W9", jobs: 58 },
  { week: "W10", jobs: 63 },
  { week: "W11", jobs: 67 },
  { week: "W12", jobs: 247 },
];

export const revenueByService = [
  { name: "Maintenance", value: 45, color: "#0891B2" },
  { name: "Repair", value: 30, color: "#0E7490" },
  { name: "Install", value: 15, color: "#164E63" },
  { name: "Retail", value: 10, color: "#67E8F9" },
];

export const techPerformance = [
  { name: "Mike T.", jobsPerDay: 4.2, revenue: 38400, onTime: 98, avatar: "MT" },
  { name: "Bryan", jobsPerDay: 3.1, revenue: 31200, onTime: 95, avatar: "BR" },
  { name: "Jose", jobsPerDay: 3.8, revenue: 29800, onTime: 96, avatar: "JO" },
  { name: "Sarah", jobsPerDay: 3.5, revenue: 26400, onTime: 97, avatar: "SA" },
  { name: "Dave", jobsPerDay: 3.2, revenue: 24800, onTime: 94, avatar: "DA" },
];

export const inventoryAlerts = [
  { id: "p4", name: "Pentair IC40 Salt Cell", current: 3, threshold: 2, location: "Store" },
  { id: "p5", name: "Pentair IntelliFlo 3HP", current: 2, threshold: 1, location: "Store" },
  { id: "p12", name: "Hayward H250 Heater", current: 1, threshold: 1, location: "Store" },
  { id: "p15", name: "Chlorinator Lid O-Ring", current: 2, threshold: 5, location: "Store" },
  { id: "p16", name: "Algaecide 1qt", current: 0, threshold: 8, location: "Store" },
];

export const agedReceivables = [
  { bucket: "Current", amount: 8200, count: 4 },
  { bucket: "1-30", amount: 12300, count: 3 },
  { bucket: "31-60", amount: 8900, count: 3 },
  { bucket: "61-90", amount: 3200, count: 1 },
  { bucket: "90+", amount: 2300, count: 1 },
];

export const teamMembers = [
  { id: "u1", name: "Bryan", email: "bryan@poolbrayne.com", role: "Owner", avatar: "BR", status: "Active" },
  { id: "u2", name: "Amanda", email: "amanda@poolbrayne.com", role: "Manager", avatar: "AM", status: "Active" },
  { id: "u3", name: "Mike T.", email: "mike@poolbrayne.com", role: "Technician", avatar: "MT", status: "Active" },
  { id: "u4", name: "Jose", email: "jose@poolbrayne.com", role: "Technician", avatar: "JO", status: "Active" },
  { id: "u5", name: "Sarah", email: "sarah@poolbrayne.com", role: "Technician", avatar: "SA", status: "Active" },
  { id: "u6", name: "Dave", email: "dave@poolbrayne.com", role: "Technician", avatar: "DA", status: "Active" },
];

export const integrations = [
  { id: "int1", name: "QuickBooks Online", status: "Connected", description: "Two-way sync active. Last synced 4 min ago.", icon: "BookOpen" },
  { id: "int2", name: "Fleet/GPS Provider", status: "Connected", description: "Vendor-agnostic API layer. Live tracking active.", icon: "MapPin" },
  { id: "int3", name: "Gusto Payroll", status: "Connected", description: "Employee sync and payroll export ready.", icon: "Users" },
  { id: "int4", name: "Twilio (SMS)", status: "Connected", description: "SMS notifications and two-way messaging active.", icon: "MessageSquare" },
  { id: "int5", name: "SendGrid (Email)", status: "Connected", description: "Transactional and campaign emails active.", icon: "Mail" },
  { id: "int6", name: "Stripe (Billing)", status: "Connected", description: "Payment processing and subscription billing active.", icon: "CreditCard" },
];

export const billingHistory = [
  { id: "bh1", date: "2024-06-01", description: "ClearPool Pro - Monthly", amount: 299, status: "Paid" },
  { id: "bh2", date: "2024-05-01", description: "ClearPool Pro - Monthly", amount: 299, status: "Paid" },
  { id: "bh3", date: "2024-04-01", description: "ClearPool Pro - Monthly", amount: 299, status: "Paid" },
  { id: "bh4", date: "2024-03-01", description: "ClearPool Pro - Monthly", amount: 299, status: "Paid" },
];

export const subscriptionPlans = [
  { id: "plan1", name: "Starter", price: 149, description: "For small teams up to 3 users", features: ["Up to 3 technicians", "Basic dispatch", "Invoicing", "Email support"], recommended: false },
  { id: "plan2", name: "Pro", price: 299, description: "For growing businesses", features: ["Up to 10 technicians", "Advanced dispatch", "Fleet tracking", "SMS campaigns", "QuickBooks sync", "Priority support"], recommended: true },
  { id: "plan3", name: "Enterprise", price: 599, description: "For multi-location operations", features: ["Unlimited technicians", "Multi-location", "Custom workflows", "API access", "Dedicated account manager", "White-glove onboarding"], recommended: false },
];

// Additional Dashboard Data
export const burnRateData = [
  { week: "W1", chlorine: 24, acid: 12, deGrids: 3, oRings: 8 },
  { week: "W2", chlorine: 28, acid: 14, deGrids: 2, oRings: 6 },
  { week: "W3", chlorine: 22, acid: 10, deGrids: 4, oRings: 9 },
  { week: "W4", chlorine: 30, acid: 16, deGrids: 3, oRings: 7 },
  { week: "W5", chlorine: 26, acid: 13, deGrids: 2, oRings: 8 },
  { week: "W6", chlorine: 32, acid: 15, deGrids: 5, oRings: 10 },
  { week: "W7", chlorine: 20, acid: 11, deGrids: 3, oRings: 6 },
  { week: "W8", chlorine: 25, acid: 12, deGrids: 4, oRings: 8 },
];

export const topSellingProducts = [
  { id: "p1", name: "3\" Chlorine Tablets", sales: 142, revenue: 355, trend: "up" },
  { id: "p2", name: "Liquid Chlorine 1gal", sales: 98, revenue: 465, trend: "up" },
  { id: "p3", name: "Muriatic Acid 1gal", sales: 67, revenue: 552, trend: "flat" },
  { id: "p4", name: "Pump Seal Kit", sales: 45, revenue: 832, trend: "up" },
  { id: "p5", name: "Filter Cartridge 200sqft", sales: 38, revenue: 3230, trend: "down" },
  { id: "p6", name: "Taylor Test Kit", sales: 32, revenue: 2080, trend: "up" },
];

export const customerRetention = [
  { month: "Jan", new: 3, retained: 18, churned: 1, repeatRate: 94 },
  { month: "Feb", new: 2, retained: 19, churned: 1, repeatRate: 93 },
  { month: "Mar", new: 5, retained: 21, churned: 0, repeatRate: 95 },
  { month: "Apr", new: 4, retained: 22, churned: 2, repeatRate: 92 },
  { month: "May", new: 6, retained: 25, churned: 1, repeatRate: 94 },
  { month: "Jun", new: 18, retained: 28, churned: 2, repeatRate: 93 },
];

// POS Data
export const posProducts = [
  { id: "pos1", name: "3\" Chlorine Tablets (5lb)", sku: "CHL-TAB-3IN", category: "Chemicals", price: 24.99, cost: 12.50, taxable: true, inventory: 48, unit: "bag" },
  { id: "pos2", name: "Liquid Chlorine 1gal", sku: "CHL-LIQ-1G", category: "Chemicals", price: 8.99, cost: 4.75, taxable: true, inventory: 32, unit: "gal" },
  { id: "pos3", name: "Muriatic Acid 1gal", sku: "CHEM-MA-1G", category: "Chemicals", price: 14.99, cost: 8.25, taxable: true, inventory: 18, unit: "gal" },
  { id: "pos4", name: "pH Down 5lb", sku: "CHEM-PHD-5", category: "Chemicals", price: 17.99, cost: 9.50, taxable: true, inventory: 14, unit: "bag" },
  { id: "pos5", name: "pH Up 5lb", sku: "CHEM-PHU-5", category: "Chemicals", price: 16.99, cost: 8.75, taxable: true, inventory: 12, unit: "bag" },
  { id: "pos6", name: "Algaecide 1qt", sku: "CHEM-ALG-1Q", category: "Chemicals", price: 19.99, cost: 12.00, taxable: true, inventory: 0, unit: "qt" },
  { id: "pos7", name: "Pool Shock 1lb", sku: "CHEM-SHK-1", category: "Chemicals", price: 9.99, cost: 5.00, taxable: true, inventory: 22, unit: "lb" },
  { id: "pos8", name: "Stabilizer / CYA 4lb", sku: "CHEM-CYA-4", category: "Chemicals", price: 21.99, cost: 11.00, taxable: true, inventory: 16, unit: "bag" },
  { id: "pos9", name: "Taylor Test Kit K-2006", sku: "TEST-K2006", category: "Test Kits", price: 89.99, cost: 65.00, taxable: true, inventory: 6, unit: "ea" },
  { id: "pos10", name: "Test Strips (100ct)", sku: "TEST-STRIP-100", category: "Test Kits", price: 12.99, cost: 6.00, taxable: true, inventory: 20, unit: "pk" },
  { id: "pos11", name: "Pool Skimmer Net", sku: "ACC-SKIM", category: "Accessories", price: 24.99, cost: 14.00, taxable: true, inventory: 12, unit: "ea" },
  { id: "pos12", name: "Pool Brush 18\"", sku: "ACC-BRUSH18", category: "Accessories", price: 29.99, cost: 16.00, taxable: true, inventory: 8, unit: "ea" },
  { id: "pos13", name: "Vacuum Hose 50ft", sku: "ACC-VAC50", category: "Accessories", price: 69.99, cost: 45.00, taxable: true, inventory: 5, unit: "ea" },
  { id: "pos14", name: "O-Ring Assortment Box", sku: "ORING-BOX", category: "Parts", price: 54.99, cost: 35.00, taxable: true, inventory: 5, unit: "ea" },
  { id: "pos15", name: "Pump Seal Kit (generic)", sku: "SEAL-KIT-1", category: "Parts", price: 32.99, cost: 18.50, taxable: true, inventory: 15, unit: "ea" },
  { id: "pos16", name: "Pentair IC40 Salt Cell", sku: "PEN-IC40", category: "Equipment", price: 649.00, cost: 425.00, taxable: true, inventory: 3, unit: "ea" },
  { id: "pos17", name: "Hayward Super Pump 1.5HP", sku: "HAY-SP15", category: "Equipment", price: 749.00, cost: 495.00, taxable: true, inventory: 4, unit: "ea" },
  { id: "pos18", name: "Filter Cartridge 200sqft", sku: "FIL-C200", category: "Parts", price: 129.99, cost: 85.00, taxable: true, inventory: 8, unit: "ea" },
  { id: "pos19", name: "DE Filter Grids (set)", sku: "FIL-DESET", category: "Parts", price: 179.99, cost: 120.00, taxable: true, inventory: 6, unit: "ea" },
  { id: "pos20", name: "Heater Igniter Assembly", sku: "HAY-IGN-250", category: "Parts", price: 139.99, cost: 85.00, taxable: true, inventory: 3, unit: "ea" },
  // Services (non-inventory)
  { id: "pos21", name: "Weekly Maintenance", sku: "SVC-MAINT-W", category: "Services", price: 145.00, cost: 0, taxable: false, inventory: -1, unit: "visit" },
  { id: "pos22", name: "Bi-Weekly Maintenance", sku: "SVC-MAINT-BW", category: "Services", price: 120.00, cost: 0, taxable: false, inventory: -1, unit: "visit" },
  { id: "pos23", name: "Filter Clean & Backwash", sku: "SVC-FILTER", category: "Services", price: 185.00, cost: 0, taxable: false, inventory: -1, unit: "ea" },
  { id: "pos24", name: "Salt Cell Cleaning", sku: "SVC-SALT", category: "Services", price: 95.00, cost: 0, taxable: false, inventory: -1, unit: "ea" },
  { id: "pos25", name: "Pool Opening Service", sku: "SVC-OPEN", category: "Services", price: 350.00, cost: 0, taxable: false, inventory: -1, unit: "ea" },
  { id: "pos26", name: "Pool Closing Service", sku: "SVC-CLOSE", category: "Services", price: 300.00, cost: 0, taxable: false, inventory: -1, unit: "ea" },
  { id: "pos27", name: "Repair Labor (per hr)", sku: "SVC-LABOR", category: "Services", price: 125.00, cost: 0, taxable: false, inventory: -1, unit: "hr" },
];

export const posTransactions = [
  { id: "tx1", date: "2024-06-22", number: "POS-240622-001", customer: "Walk-in", items: 3, subtotal: 62.97, tax: 5.19, total: 68.16, payment: "Cash", status: "Complete" },
  { id: "tx2", date: "2024-06-22", number: "POS-240622-002", customer: "James Thompson", items: 2, subtotal: 33.98, tax: 2.80, total: 36.78, payment: "Card", status: "Complete" },
  { id: "tx3", date: "2024-06-21", number: "POS-240621-001", customer: "Walk-in", items: 1, subtotal: 89.99, tax: 7.42, total: 97.41, payment: "Card", status: "Complete" },
  { id: "tx4", date: "2024-06-21", number: "POS-240621-002", customer: "Michael Chen", items: 4, subtotal: 128.96, tax: 10.64, total: 139.60, payment: "Card", status: "Complete" },
  { id: "tx5", date: "2024-06-20", number: "POS-240620-001", customer: "Walk-in", items: 2, subtotal: 47.98, tax: 3.96, total: 51.94, payment: "Cash", status: "Complete" },
  { id: "tx6", date: "2024-06-20", number: "POS-240620-002", customer: "Steven Clark", items: 1, subtotal: 649.00, tax: 53.54, total: 702.54, payment: "Card", status: "Complete" },
  { id: "tx7", date: "2024-06-19", number: "POS-240619-001", customer: "Walk-in", items: 3, subtotal: 74.97, tax: 6.18, total: 81.15, payment: "Cash", status: "Complete" },
  { id: "tx8", date: "2024-06-19", number: "POS-240619-002", customer: "Emily Brooks", items: 2, subtotal: 44.98, tax: 3.71, total: 48.69, payment: "Card", status: "Complete" },
];

export const seasonalTrends = [
  { month: "Jan", revenue: 68000, jobs: 180, label: "Off-season" },
  { month: "Feb", revenue: 75000, jobs: 195, label: "Late winter" },
  { month: "Mar", revenue: 112000, jobs: 280, label: "Opening rush" },
  { month: "Apr", revenue: 138000, jobs: 340, label: "Spring peak" },
  { month: "May", revenue: 165000, jobs: 410, label: "Peak season" },
  { month: "Jun", revenue: 182400, jobs: 247, label: "Mid-season" },
  { month: "Jul", revenue: 178000, jobs: 450, label: "Summer peak" },
  { month: "Aug", revenue: 165000, jobs: 420, label: "Late summer" },
  { month: "Sep", revenue: 135000, jobs: 350, label: "Fall start" },
  { month: "Oct", revenue: 95000, jobs: 240, label: "Closing" },
  { month: "Nov", revenue: 78000, jobs: 190, label: "Off-season" },
  { month: "Dec", revenue: 72000, jobs: 175, label: "Off-season" },
];

// Job Settings data (from client PDF spec)
export const jobTypes = [
  { id: "maintenance", label: "Maintenance", color: "#0891B2" },
  { id: "repair", label: "Repair", color: "#F59E0B" },
  { id: "install", label: "Install / New Build", color: "#8B5CF6" },
  { id: "open_close", label: "Pool Open / Close", color: "#0E7490" },
  { id: "inspection", label: "Inspection", color: "#F97316" },
  { id: "estimate", label: "Estimate / Quote", color: "#6366F1" },
  { id: "consultation", label: "Consultation", color: "#EC4899" },
  { id: "equipment", label: "Equipment Service", color: "#14B8A6" },
  { id: "renovation", label: "Renovation / Remodel", color: "#D97706" },
];

export const jobStatuses = [
  { id: "new", label: "New", color: "#6366F1" },
  { id: "scheduled", label: "Scheduled", color: "#0891B2" },
  { id: "assigned", label: "Assigned", color: "#0E7490" },
  { id: "en_route", label: "En Route", color: "#F59E0B" },
  { id: "on_site", label: "On Site", color: "#F97316" },
  { id: "in_progress", label: "In Progress", color: "#3B82F6" },
  { id: "parts_ordered", label: "Parts Ordered", color: "#A855F7" },
  { id: "on_hold", label: "On Hold", color: "#D97706" },
  { id: "completed", label: "Completed", color: "#16A34A" },
  { id: "invoiced", label: "Invoiced", color: "#0E7490" },
  { id: "paid", label: "Paid", color: "#15803D" },
  { id: "cancelled", label: "Cancelled", color: "#DC2626" },
  { id: "rescheduled", label: "Rescheduled", color: "#F59E0B" },
  { id: "no_answer", label: "No Answer / Customer Not Available", color: "#EF4444" },
  { id: "callback", label: "Needs Callback", color: "#EC4899" },
];

export const estimateStatuses = [
  { id: "draft", label: "Draft", color: "#64748B" },
  { id: "pending_review", label: "Pending Review", color: "#F59E0B" },
  { id: "sent", label: "Sent to Customer", color: "#0891B2" },
  { id: "viewed", label: "Viewed", color: "#0E7490" },
  { id: "accepted", label: "Accepted", color: "#16A34A" },
  { id: "declined", label: "Declined", color: "#DC2626" },
  { id: "expired", label: "Expired", color: "#94A3B8" },
  { id: "revised", label: "Revised", color: "#6366F1" },
  { id: "approved_work", label: "Approved — Work Scheduled", color: "#15803D" },
  { id: "partially_approved", label: "Partially Approved", color: "#F97316" },
  { id: "on_hold", label: "On Hold", color: "#D97706" },
];

export const cancellationReasons = [
  "Called on call ahead — customer cancelled",
  "Customer cancelled at door",
  "Customer not home / not available",
  "Weather — rain / storm",
  "Equipment failure / truck breakdown",
  "Parts not delivered",
  "Customer rescheduled",
  "Duplicate job / already serviced",
  "Customer moved / cancelled account",
];

export const callTypes = [
  "Inbound — Customer Call",
  "Outbound — Sales Call",
  "Outbound — Service Follow-up",
  "Outbound — Collection Call",
  "Inbound — Estimate Request",
  "Inbound — Complaint",
  "Referral Call",
];

export const callSources = [
  "Website",
  "Google Ads",
  "Referral — Existing Customer",
  "Yelp",
  "Angi / HomeAdvisor",
  "Facebook",
  "Repeat Customer",
  "Drive-by / Signage",
];

export const rescheduleTypes = [
  "Customer Request",
  "Weather",
  "Technician Unavailable",
  "Parts Delay",
  "Customer Not Home",
  "Company Error — Missed Schedule",
];

export const contentCategories = [
  { id: "trip_details", label: "Trip Details", icon: "Truck" },
  { id: "documents", label: "Documents", icon: "FileText" },
  { id: "customer_not_available", label: "Customer Not Available", icon: "UserX" },
  { id: "known_issue", label: "Known Issue", icon: "AlertCircle" },
  { id: "private", label: "Private", icon: "Lock" },
  { id: "customer_portal", label: "Customer Portal", icon: "ExternalLink" },
  { id: "before_after", label: "Before / After Photos", icon: "Camera" },
  { id: "model_serial", label: "Model & Serial Numbers", icon: "Barcode" },
  { id: "receipts", label: "Receipts", icon: "Receipt" },
  { id: "extra_job_info", label: "Extra Job Info", icon: "Info" },
];

export const estimateAgreements = [
  "Liner Replacement Agreement",
  "Sand Change Agreement",
  "Filter Clean Agreement",
  "Equipment Install Agreement",
  "Salt Cell Replacement Agreement",
  "Pool Opening Agreement",
  "Pool Closing Agreement",
  "Renovation Contract",
];

export const inventoryUnits = [
  { unit: "ea", label: "Each" },
  { unit: "lb", label: "Pound" },
  { unit: "gal", label: "Gallon" },
  { unit: "qt", label: "Quart" },
  { unit: "bag", label: "Bag" },
  { unit: "case", label: "Case" },
  { unit: "box", label: "Box" },
  { unit: "pk", label: "Pack" },
  { unit: "roll", label: "Roll" },
  { unit: "set", label: "Set" },
  { unit: "hr", label: "Hour" },
  { unit: "visit", label: "Visit" },
];

// Inventory items with build/break units (buy in bulk, sell in smaller units)
export const inventoryBuildBreak = [
  { id: "bb1", name: "3\" Chlorine Tablets", sku: "CHL-TAB-3IN", purchaseUnit: "case", purchaseQty: 4, purchaseUnitLabel: "case of 24 bags", sellUnit: "bag", sellRatio: 24, currentStock: 48, sellUnitLabel: "bag" },
  { id: "bb2", name: "Liquid Chlorine", sku: "CHL-LIQ-1G", purchaseUnit: "case", purchaseQty: 6, purchaseUnitLabel: "case of 6 gal", sellUnit: "gal", sellRatio: 6, currentStock: 32, sellUnitLabel: "gal" },
  { id: "bb3", name: "Muriatic Acid", sku: "CHEM-MA-1G", purchaseUnit: "case", purchaseQty: 4, purchaseUnitLabel: "case of 4 gal", sellUnit: "gal", sellRatio: 4, currentStock: 18, sellUnitLabel: "gal" },
  { id: "bb4", name: "Pool Shock", sku: "CHEM-SHK-1", purchaseUnit: "case", purchaseQty: 12, purchaseUnitLabel: "case of 12 lb", sellUnit: "lb", sellRatio: 12, currentStock: 22, sellUnitLabel: "lb" },
  { id: "bb5", name: "pH Down", sku: "CHEM-PHD-5", purchaseUnit: "case", purchaseQty: 6, purchaseUnitLabel: "case of 6 bags", sellUnit: "bag", sellRatio: 6, currentStock: 14, sellUnitLabel: "bag" },
  { id: "bb6", name: "Test Strips", sku: "TEST-STRIP-100", purchaseUnit: "box", purchaseQty: 10, purchaseUnitLabel: "box of 10 packs", sellUnit: "pk", sellRatio: 10, currentStock: 20, sellUnitLabel: "pk" },
  { id: "bb7", name: "O-Rings", sku: "ORING-BOX", purchaseUnit: "box", purchaseQty: 1, purchaseUnitLabel: "box of 500", sellUnit: "ea", sellRatio: 500, currentStock: 5, sellUnitLabel: "ea" },
  { id: "bb8", name: "Pump Seal Kits", sku: "SEAL-KIT-1", purchaseUnit: "case", purchaseQty: 10, purchaseUnitLabel: "case of 10", sellUnit: "ea", sellRatio: 10, currentStock: 15, sellUnitLabel: "ea" },
];

export const spanishTranslations: Record<string, string> = {
  "Job Details": "Detalles del Trabajo",
  "Customer": "Cliente",
  "Scheduled": "Programado",
  "Assigned": "Asignado",
  "Address": "Dirección",
  "Description": "Descripción",
  "Line Items": "Artículos",
  "Photos": "Fotos",
  "Customer Signature": "Firma del Cliente",
  "Status Timeline": "Línea de Tiempo",
  "Automated Notifications": "Notificaciones Automáticas",
  "Quick Actions": "Acciones Rápidas",
  "Booking confirmed": "Reserva confirmada",
  "Technician en route": "Técnico en camino",
  "Job completed": "Trabajo completado",
  "Call Customer": "Llamar al Cliente",
  "Text Customer": "Enviar SMS al Cliente",
  "Email Customer": "Enviar Correo al Cliente",
  "View Invoice": "Ver Factura",
  "Mark Complete & Generate Invoice": "Marcar Completado y Generar Factura",
  "Trip Details": "Detalles del Viaje",
  "Documents": "Documentos",
  "Customer Not Available": "Cliente No Disponible",
  "Known Issue": "Problema Conocido",
  "Private": "Privado",
  "Customer Portal": "Portal del Cliente",
  "Before / After Photos": "Fotos Antes / Después",
  "Model & Serial Numbers": "Modelo y Números de Serie",
  "Receipts": "Recibos",
  "Extra Job Info": "Información Adicional",
};
