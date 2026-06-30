// Program definitions — kept in sync with backend/utils/programs.js
export const PROGRAMS = {
  'B.Tech': { label: 'B.Tech', years: 4, semCount: 8 },
  'B.E.':   { label: 'B.E.',   years: 4, semCount: 8 },
  'M.Tech': { label: 'M.Tech', years: 2, semCount: 4 },
  'M.E.':   { label: 'M.E.',   years: 2, semCount: 4 },
  'MBA':    { label: 'MBA',    years: 2, semCount: 4 },
};

export const PROGRAM_KEYS = Object.keys(PROGRAMS);

// Returns [1,2,...] sized to the program's semester count.
export const semestersFor = (program) => {
  const p = PROGRAMS[program];
  if (!p) return [1,2,3,4,5,6,7,8];
  return Array.from({ length: p.semCount }, (_, i) => i + 1);
};

export const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'EEE', 'ME', 'CE', 'AIML', 'MBA'];
