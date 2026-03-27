function parseSemver(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(left, right) {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}

function normalizeConstraint(constraint) {
  return String(constraint ?? '').trim();
}

function wildcardToRange(constraint) {
  const normalized = normalizeConstraint(constraint);

  if (!normalized.includes('*')) {
    return null;
  }

  const parts = normalized.split('.');

  if (parts.length === 2 && parts[1] === '*') {
    const min = parseSemver(`${parts[0]}.0.0`);
    const max = parseSemver(`${Number(parts[0]) + 1}.0.0`);
    return { min, max };
  }

  if (parts.length === 3 && parts[2] === '*') {
    const min = parseSemver(`${parts[0]}.${parts[1]}.0`);
    const max = parseSemver(`${parts[0]}.${Number(parts[1]) + 1}.0`);
    return { min, max };
  }

  return null;
}

function compareAgainstOperator(version, operator, target) {
  const current = parseSemver(version);
  const baseline = parseSemver(target);

  if (!current || !baseline) {
    return false;
  }

  const comparison = compareSemver(current, baseline);

  switch (operator) {
    case '>':
      return comparison > 0;
    case '>=':
      return comparison >= 0;
    case '<':
      return comparison < 0;
    case '<=':
      return comparison <= 0;
    default:
      return false;
  }
}

function satisfiesSingle(version, rawConstraint) {
  const constraint = normalizeConstraint(rawConstraint);

  if (!constraint || constraint === '*' || constraint === 'latest') {
    return true;
  }

  if (constraint.startsWith('dev-')) {
    return version === constraint;
  }

  const wildcard = wildcardToRange(constraint);

  if (wildcard) {
    const current = parseSemver(version);

    if (!current) {
      return false;
    }

    return (
      compareSemver(current, wildcard.min) >= 0 &&
      compareSemver(current, wildcard.max) < 0
    );
  }

  if (constraint.startsWith('^')) {
    const min = parseSemver(constraint.slice(1));
    const current = parseSemver(version);

    if (!min || !current) {
      return false;
    }

    return current.major === min.major && compareSemver(current, min) >= 0;
  }

  if (constraint.startsWith('~')) {
    const min = parseSemver(constraint.slice(1));
    const current = parseSemver(version);

    if (!min || !current) {
      return false;
    }

    return (
      current.major === min.major &&
      current.minor === min.minor &&
      compareSemver(current, min) >= 0
    );
  }

  const operatorMatch = /^(>=|<=|>|<)\s*(.+)$/.exec(constraint);

  if (operatorMatch) {
    return compareAgainstOperator(version, operatorMatch[1], operatorMatch[2]);
  }

  return version === constraint;
}

export function satisfies(version, constraint) {
  const normalized = normalizeConstraint(constraint);

  if (!normalized) {
    return true;
  }

  return normalized
    .split(',')
    .flatMap((chunk) => chunk.split(/\s+/))
    .filter(Boolean)
    .every((singleConstraint) => satisfiesSingle(version, singleConstraint));
}

export function pickBestVersion(versions, constraint) {
  if (!versions.length) {
    return null;
  }

  const exact = versions.find((version) => satisfies(version, constraint) && constraint === version);

  if (exact) {
    return exact;
  }

  const matching = versions.filter((version) => satisfies(version, constraint));

  if (!matching.length) {
    return null;
  }

  const semverVersions = matching
    .map((version) => ({ version, parsed: parseSemver(version) }))
    .filter((entry) => entry.parsed);

  if (semverVersions.length) {
    semverVersions.sort((left, right) => compareSemver(right.parsed, left.parsed));
    return semverVersions[0].version;
  }

  return matching.sort().at(-1) ?? null;
}
