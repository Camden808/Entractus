// Dev/test seed for Entractus.
//
// Idempotent: deletes all system-default Industry rows and JobPosting rows
// created by the admin user, then re-creates them. The admin User is
// upserted by email so re-running won't duplicate it.
//
// Run with: npm --workspace apps/api run db:seed
// Or as part of: npm --workspace apps/api exec -- prisma migrate reset

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SYSTEM_INDUSTRIES = [
  'Construction',
  'Engineering',
  'Architecture',
  'Skilled Trades',
  'Project Management',
];

const ADMIN_EMAIL = 'admin@entractus.local';
const ADMIN_PASSWORD = 'changeme-in-prod';

const SAMPLE_JOBS = [
  {
    title: 'Senior Civil Engineer',
    state: 'CA',
    city: 'San Francisco',
    type: 'Direct Hire',
    company: 'Bay Bridge Builders',
    description:
      'Lead structural reviews on commercial highrise projects. PE license required; 7+ years in seismic-zone design.',
  },
  {
    title: 'Construction Project Manager',
    state: 'TX',
    city: 'Austin',
    type: 'Direct Hire',
    company: 'Lone Star Construction',
    description:
      'Run end-to-end multifamily builds: budgeting, subcontractor coordination, owner reporting. 5+ years PM experience.',
  },
  {
    title: 'Electrical Foreman',
    state: 'NY',
    city: 'New York',
    type: 'Temp To Perm',
    company: 'Empire Electric',
    description:
      'Lead a crew of 6 on commercial fit-outs. Must hold a Master Electrician license in NY.',
  },
  {
    title: 'Mechanical Engineer (HVAC)',
    state: 'IL',
    city: 'Chicago',
    type: 'Full Time',
    company: 'Lakefront Mechanical',
    description: 'Design HVAC systems for hospitals and labs. AutoCAD MEP + Revit. PE preferred.',
  },
  {
    title: 'Site Safety Coordinator',
    state: 'WA',
    city: 'Seattle',
    type: 'Temporary',
    company: 'Cascade Builders',
    description:
      '6-month contract on a downtown highrise. OSHA 30 required; bilingual EN/ES a plus.',
  },
];

async function main() {
  // --- Admin user ---
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, role: UserRole.admin },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      displayName: 'Entractus Admin',
      role: UserRole.admin,
    },
  });
  console.log(`✓ Admin user: ${admin.email} (${admin.id})`);

  // --- System-default industries (clear + recreate so reruns stay clean) ---
  const deletedIndustries = await prisma.industry.deleteMany({
    where: { userId: null },
  });
  await prisma.industry.createMany({
    data: SYSTEM_INDUSTRIES.map((name) => ({ name, client: true })),
  });
  console.log(
    `✓ Industries: deleted ${deletedIndustries.count} previous system defaults, inserted ${SYSTEM_INDUSTRIES.length}`,
  );

  // --- Sample job postings (clear admin's + recreate) ---
  const deletedJobs = await prisma.jobPosting.deleteMany({
    where: { createdById: admin.id },
  });
  await prisma.jobPosting.createMany({
    data: SAMPLE_JOBS.map((job) => ({ ...job, createdById: admin.id })),
  });
  console.log(
    `✓ Job postings: deleted ${deletedJobs.count} previous admin-owned postings, inserted ${SAMPLE_JOBS.length}`,
  );

  console.log('\nSeed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
