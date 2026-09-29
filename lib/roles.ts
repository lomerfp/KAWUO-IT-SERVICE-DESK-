export const STAFF_ROLES = [
  "Staff", "Programme Officer", "M&E Officer", "Finance & Administration",
  "Finance and Admin Manager", "Executive Director", "Director of Programs",
  "Manager", "IT Support", "IT Officer", "IT Technician", "IT Manager",
  "Software Engineer", "Printer Specialist", "QuickBooks Manager",
] as const;

export const TECHNICAL_ROLES: readonly string[] = [
  "IT Support", "IT Officer", "IT Technician", "IT Manager",
  "Software Engineer", "Printer Specialist", "QuickBooks Manager",
];

export const REPORT_ROLES: readonly string[] = [
  ...TECHNICAL_ROLES, "Executive Director", "Director of Programs",
  "Finance and Admin Manager", "M&E Officer", "Manager",
];

export const ROLE_GROUPS = [
  { title: "IT & technical support", roles: ["Systems Administrator", ...TECHNICAL_ROLES] },
  { title: "Management & operations", roles: ["Executive Director", "Director of Programs", "Finance and Admin Manager", "Manager", "M&E Officer"] },
  { title: "Staff & programmes", roles: ["Programme Officer", "Finance & Administration", "Staff"] },
] as const;

export const KNOWN_JOB_TITLES: Record<string, string> = {
  "todelok@kawuo.org": "Executive Director",
  "cdorothy@kawuo.org": "Programs Officer – WEE",
  "aramathan@kawuo.org": "MEAL Officer",
  "kbetty@kawuo.org": "Program Officer – WAJ",
  "nregina@kawuo.org": "Project Officer – Nakapiripirit",
  "amark@kawuo.org": "Project Officer – Kaabong",
  "ajennifer@kawuo.org": "Procurement / Supply Chain Officer",
  "astella@kawuo.org": "Project Officer – Moroto",
  "glokut@kawuo.org": "MEAL Officer",
  "bbernard@kawuo.org": "MEAL Officer",
};
