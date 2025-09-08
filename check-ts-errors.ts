// Run this to check TypeScript compilation errors
import { exec } from 'child_process';

exec('npx tsc --noEmit', (error, stdout, stderr) => {
  if (error) {
    console.log('TypeScript compilation errors:');
    console.log(stderr);
  } else {
    console.log('No TypeScript errors found!');
  }
});