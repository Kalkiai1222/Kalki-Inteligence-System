const fs = require('fs');

function addDarkModeAndTheme(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('ThemeToggle')) {
    content = content.replace("import { useEffect, useState } from 'react';", "import { useEffect, useState } from 'react';\nimport { ThemeToggle } from '@/components/ThemeToggle';");
  }

  content = content.replace(/bg-gray-50/g, 'bg-gray-50 dark:bg-slate-950 transition-colors duration-300');
  content = content.replace(/text-gray-900/g, 'text-gray-900 dark:text-white');
  content = content.replace(/text-gray-800/g, 'text-gray-800 dark:text-gray-100');
  content = content.replace(/text-gray-700/g, 'text-gray-700 dark:text-gray-200');
  content = content.replace(/text-gray-600/g, 'text-gray-600 dark:text-gray-300');
  content = content.replace(/text-gray-500/g, 'text-gray-500 dark:text-gray-400');
  
  content = content.replace(/bg-white/g, 'bg-white dark:bg-slate-900 transition-colors');
  content = content.replace(/border-gray-200/g, 'border-gray-200 dark:border-slate-800');
  content = content.replace(/border-gray-300/g, 'border-gray-300 dark:border-slate-700');
  content = content.replace(/divide-gray-200/g, 'divide-gray-200 dark:divide-slate-800');
  
  content = content.replace(/text-indigo-600/g, 'text-indigo-600 dark:text-indigo-400');
  content = content.replace(/hover:text-indigo-800/g, 'hover:text-indigo-800 dark:hover:text-indigo-300');

  // Specific layout injection for project/company pages
  if (!content.includes('<ThemeToggle />')) {
      content = content.replace(
        '<div className="max-w-7xl mx-auto py-10 sm:px-6 lg:px-8">',
        '<div className="max-w-7xl mx-auto py-10 sm:px-6 lg:px-8 relative">\n        <div className="absolute top-4 right-4 sm:right-6 lg:right-8 z-10">\n          <ThemeToggle />\n        </div>'
      );
      content = content.replace(
        '<div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8">',
        '<div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 relative">\n        <div className="absolute top-4 right-4 z-10">\n          <ThemeToggle />\n        </div>'
      );
      content = content.replace(
        '<div className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">',
        '<div className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">\n        <div className="absolute top-4 right-4 z-10">\n          <ThemeToggle />\n        </div>'
      );
  }

  content = content.replace(/focus:ring-indigo-500 py-2 px-3 border/g, 'focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-slate-800 py-2 px-3 border');
  content = content.replace(/focus:ring-indigo-500 px-3/g, 'focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-slate-800 px-3');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated ' + filePath);
}

['src/app/dashboard/companies/[id]/page.tsx', 'src/app/dashboard/companies/[id]/projects/page.tsx', 'src/app/dashboard/companies/[id]/projects/[projectId]/page.tsx'].forEach(addDarkModeAndTheme);
