const fs = require('fs');
const path = require('path');

const departments = [
    { id: 'board', name: 'Protocol Governance', title: 'Board Architecture', navConst: 'BOARD_MENU' },
    { id: 'ceo', name: 'Executive Office', title: 'CEO Architecture', navConst: 'CEO_MENU' },
    { id: 'cpo', name: 'Product Department', title: 'CPO Architecture', navConst: 'CPO_MENU' },
    { id: 'cmo', name: 'Growth & Marketing', title: 'CMO Architecture', navConst: 'CMO_MENU' },
    { id: 'coo', name: 'Operations Department', title: 'COO Architecture', navConst: 'COO_MENU' },
    { id: 'chro', name: 'Human Resources', title: 'CHRO Architecture', navConst: 'CHRO_MENU' },
    { id: 'cfo', name: 'Finance Department', title: 'CFO Architecture', navConst: 'CFO_MENU' },
    { id: 'clo', name: 'Legal Department', title: 'CLO Architecture', navConst: 'CLO_MENU' },
    { id: 'cso', name: 'Strategy Department', title: 'CSO Architecture', navConst: 'CSO_MENU' },
    { id: 'cdo', name: 'Data Department', title: 'CDO Architecture', navConst: 'CDO_MENU' },
    { id: 'ciso', name: 'Security Department', title: 'CISO Architecture', navConst: 'CISO_MENU' },
];

const ctoPagePath = path.join(__dirname, '../src/app/nucleo/[entityId]/cto/page.tsx');
const ctoContent = fs.readFileSync(ctoPagePath, 'utf8');

// We need to extract the structure and replace layers, imports, and titles.
// Actually, it's easier to just build the file from a template string.

const navFilePath = path.join(__dirname, '../src/lib/department-nav.ts');
const navContent = fs.readFileSync(navFilePath, 'utf8');

departments.forEach(dep => {
    // 1. Extract menu items from navContent
    const regex = new RegExp(`export const ${dep.navConst} = \\[([\\s\\S]*?)\\];`);
    const match = navContent.match(regex);
    if (!match) {
        console.error(`Could not find ${dep.navConst}`);
        return;
    }
    
    const menuBlock = match[1];
    
    // Parse the menu items to extract icon and label and path
    const itemRegex = /href:\s*["']\/nucleo\/\{entity\}\/[^\/]+\/([^"']+)["'],\s*icon:\s*([A-Za-z0-9_]+),\s*label:\s*["']([^"']+)["']/g;
    
    let layersArray = [];
    let iconsToImport = new Set(['ArrowRight']); // From lucide-react
    
    let itemMatch;
    while ((itemMatch = itemRegex.exec(menuBlock)) !== null) {
        const pathSuffix = itemMatch[1];
        const iconName = itemMatch[2];
        const label = itemMatch[3];
        
        // id is the first part of pathSuffix if there are slashes
        const id = pathSuffix.split('/')[0];
        
        layersArray.push(`    { id: '${id}', label: '${label}', path: '${pathSuffix}', icon: ${iconName} },`);
        iconsToImport.add(iconName);
    }
    
    const layersString = `const layers = [\n${layersArray.join('\n')}\n];`;
    // Explicitly add 'X' since it's used by the WindowNode
    iconsToImport.add('X');
    const iconsImportString = `import {\n    ${Array.from(iconsToImport).join(', ')}\n} from 'lucide-react';`;
    
    // Now replace parts of ctoContent
    // 1. Replace lucide imports
    let newContent = ctoContent.replace(/import\s+\{[^{}]*\}\s+from\s+['"]lucide-react['"];/, iconsImportString);
    
    // 2. Replace layers definition
    newContent = newContent.replace(/const layers = \[[^\]]*\];/, layersString);
    
    // 3. Replace CTODashboard with {dep.id.toUpperCase()}Dashboard
    newContent = newContent.replace(/export default function CTODashboard\(\)/, `export default function ${dep.id.toUpperCase()}Dashboard()`);
    
    // 4. Replace router.push path
    newContent = newContent.replace(/\/nucleo\/\$\{entityId\}\/cto\//, `/nucleo/\${entityId}/${dep.id}/`);
    
    // 5. Replace Titles
    newContent = newContent.replace(/Technology Department/, dep.name);
    newContent = newContent.replace(/CTO Architecture/, dep.title);
    
    const targetDir = path.join(__dirname, `../src/app/nucleo/[entityId]/${dep.id}`);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = path.join(targetDir, 'page.tsx');
    fs.writeFileSync(targetPath, newContent);
    console.log(`Generated ${dep.id}`);
});
