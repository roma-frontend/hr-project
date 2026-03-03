import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  const client = new ConvexHttpClient(deploymentUrl);

  console.log("\ní³Š All Organizations:");
  const orgs = await client.query(api.organizations.getAllOrganizations, {});
  orgs.forEach((org: any) => {
    console.log(`  - ${org.name} (${org.totalEmployees} employees)`);
  });

  console.log("\ní±¥ Users by Organization:");
  const allOrgUsers = await client.query(api.users.getAllUsers, { requesterId: (await client.query(api.users.getUserByEmail, { email: "romangulanyan@gmail.com" }))._id });
  
  const byOrg: Record<string, any[]> = {};
  allOrgUsers.forEach((user: any) => {
    const orgName = user.organizationId ? `org-${user.organizationId}` : 'no-org';
    if (!byOrg[orgName]) byOrg[orgName] = [];
    byOrg[orgName].push(user.name);
  });

  Object.entries(byOrg).forEach(([org, users]: [string, any]) => {
    console.log(`\n  ${org}:`);
    (users as string[]).forEach((name: string) => console.log(`    - ${name}`));
  });
}

main().catch(console.error);
