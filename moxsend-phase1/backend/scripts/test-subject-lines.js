const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3001';

async function run() {
  const payload = {
    brief: 'Sell ERP software to CFOs in Saudi Arabia',
    industry: 'Manufacturing',
    targetRole: 'CFO',
    country: 'Saudi Arabia',
    tone: 'professional',
  };

  try {
    const { data } = await axios.post(`${API_BASE}/api/ai/subject-lines`, payload, {
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: true,
          endpoint: `${API_BASE}/api/ai/subject-lines`,
          count: Array.isArray(data?.subjectLines) ? data.subjectLines.length : 0,
          subjectLines: data?.subjectLines ?? [],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify(
        {
          ok: false,
          message: error?.response?.data?.error?.message || error.message,
          code: error?.response?.data?.error?.code || 'REQUEST_FAILED',
          status: error?.response?.status || null,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void run();
