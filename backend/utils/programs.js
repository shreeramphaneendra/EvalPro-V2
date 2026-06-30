// Central definition of academic programs and their durations.
// semCount = number of semesters in the program.
const PROGRAMS = {
  'B.Tech': { label: 'B.Tech', years: 4, semCount: 8 },
  'B.E.':   { label: 'B.E.',   years: 4, semCount: 8 },
  'M.Tech': { label: 'M.Tech', years: 2, semCount: 4 },
  'M.E.':   { label: 'M.E.',   years: 2, semCount: 4 },
  'MBA':    { label: 'MBA',    years: 2, semCount: 4 },
};

const PROGRAM_KEYS = Object.keys(PROGRAMS);

const semestersFor = (program) => {
  const p = PROGRAMS[program];
  if (!p) return [];
  return Array.from({ length: p.semCount }, (_, i) => i + 1);
};

module.exports = { PROGRAMS, PROGRAM_KEYS, semestersFor };
