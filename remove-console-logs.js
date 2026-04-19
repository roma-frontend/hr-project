const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'src/middleware.ts',
  'src/hooks/useAuthSync.ts',
  'src/hooks/useSyncOAuthUser.ts',
  'src/app/api/chat/route.ts',
  'src/components/layout/Providers.tsx',
  'src/components/chat/ChatWindow.tsx',
  'src/components/dashboard/DashboardClient.tsx',
  'src/app/api/profile/update/route.ts',
];

function removeConsoleLogs(content) {
  // Remove standalone console.log/error/warn/debug lines
  const lines = content.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith('console.log') &&
           !trimmed.startsWith('console.error') &&
           !trimmed.startsWith('console.warn') &&
           !trimmed.startsWith('console.debug');
  });
  
  return filtered.join('\n');
}

filesToProcess.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const cleaned = removeConsoleLogs(content);
    fs.writeFileSync(fullPath, cleaned, 'utf-8');
    console.log(`✅ Cleaned ${file}`);
  }
});

console.log('Done removing console logs from critical files');
