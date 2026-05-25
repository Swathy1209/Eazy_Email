const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const SCOPE = 'python-bridge';

/**
 * Invokes the LangGraph Python workflow by writing JSON to stdin and parsing stdout.
 * @param {object} payload - The input data containing selected_leads, etc.
 * @returns {Promise<object>} The resulting JSON from the python script.
 */
function invokeLangGraphWorkflow(payload) {
  return new Promise((resolve, reject) => {
    const aiDir = path.resolve(__dirname, '../../../ai');
    
    // We assume the local .venv is used for dependencies.
    // 'uv run python' or direct path to '.venv/Scripts/python.exe' could be used.
    // Allow overriding the python executable (useful in environments where firewall rules block venv python).
    let pythonExecutable = process.env.AI_PYTHON_EXECUTABLE || 'python';
    
    // If not explicitly overridden, prefer the venv python when present.
    if (!process.env.AI_PYTHON_EXECUTABLE) {
      if (process.platform === 'win32') {
        pythonExecutable = path.join(aiDir, '.venv', 'Scripts', 'python.exe');
      } else {
        pythonExecutable = path.join(aiDir, '.venv', 'bin', 'python');
      }
      if (!fs.existsSync(pythonExecutable)) {
        pythonExecutable = 'python';
      }
    }

    const scriptPath = path.join(aiDir, 'run_workflow.py');

    logger.info(SCOPE, `Invoking LangGraph at ${scriptPath} with ${payload.selected_leads?.length || 0} leads`);

    const proc = spawn(pythonExecutable, [scriptPath], {
      cwd: aiDir,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONUTF8: '1',
      },
    });

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (errorOutput.trim()) {
        logger.info(SCOPE, 'Python stderr', { stderr: errorOutput.trim().slice(0, 4000) });
      }
      if (code !== 0) {
        logger.error(SCOPE, `Python process failed with code ${code}. Stderr: ${errorOutput}`);
        return reject(new Error(`LangGraph execution failed (code ${code}): ${errorOutput || 'no stderr'}`));
      }
      try {
        // Find the first JSON block in the output in case python printed other logs to stdout
        // But ideally python will only print JSON to stdout.
        const match = output.match(/\{[\s\S]*\}/);
        if (!match) {
          throw new Error("No JSON object found in Python output");
        }
        const result = JSON.parse(match[0]);
        logger.info(SCOPE, `LangGraph execution successful`);
        resolve({ ...result, _stderr: errorOutput || '' });
      } catch (err) {
        logger.error(SCOPE, `Failed to parse Python output. Error: ${err.message}. Output: ${output}`);
        reject(new Error(`Failed to parse LangGraph output: ${err.message}`));
      }
    });

    proc.on('error', (err) => {
      logger.error(SCOPE, `Failed to start Python process: ${err.message}`);
      reject(err);
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

module.exports = {
  invokeLangGraphWorkflow,
};
