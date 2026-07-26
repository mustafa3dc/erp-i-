const { spawn } = require('child_process');
const path = require('path');

const env = {
    ...process.env,
    PYTHONPATH: '/Users/mustafa/Desktop/test/backend:/Users/mustafa/Desktop/test/venv/lib/python3.14/site-packages',
    PATH: '/Users/mustafa/Desktop/test/venv/bin:/usr/local/bin:/usr/bin:/bin'
};

console.log('Starting Python backend via Node wrapper...');

const child = spawn('/Users/mustafa/Desktop/test/venv/bin/python', [
    '-m', 'uvicorn', 'app.main:app',
    '--host', '0.0.0.0',
    '--port', '8000'
], {
    cwd: '/Users/mustafa/Desktop/test/backend',
    env: env,
    stdio: 'inherit' // forward all stdout/stderr directly
});

child.on('exit', (code, signal) => {
    console.log(`Python backend exited with code ${code} and signal ${signal}`);
    process.exit(code || 0);
});
