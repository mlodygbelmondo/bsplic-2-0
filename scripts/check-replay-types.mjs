import path from 'node:path';
import ts from 'typescript';

// The repository has existing full-project TS errors. Check the complete program,
// but block this feature on diagnostics in Replay and its two integration files.
// This is explicitly a scoped gate, not a claim that the entire project is clean.
const config = ts.readConfigFile('tsconfig.app.json', ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
const scoped = diagnostics.filter((diagnostic) => {
  if (!diagnostic.file) return true;
  const file = path.relative(process.cwd(), diagnostic.file.fileName).replaceAll('\\', '/');
  return file.startsWith('src/features/replay/') || ['src/App.tsx', 'src/pages/ProfilePage.tsx'].includes(file);
});
const host = { getCanonicalFileName: (file) => file, getCurrentDirectory: process.cwd, getNewLine: () => '\n' };
console.log(`Replay type check: ${scoped.length} scoped diagnostics; ${diagnostics.length - scoped.length} outside scope. Full-project type checking is not clean.`);
if (scoped.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(scoped, host));
  process.exitCode = 1;
}
