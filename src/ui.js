const colors = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  white: '\u001b[37m',
  gray: '\u001b[90m',
};

function useColors() {
  return process.stdout.isTTY && process.env.NO_COLOR !== '1';
}

function colorize(text, ...styles) {
  if (!useColors()) {
    return text;
  }

  return `${styles.join('')}${text}${colors.reset}`;
}

export function banner() {
  return [
    colorize('  ___   ___   ___   ___   _   _', colors.bold, colors.cyan),
    colorize(' / _ | / __| / _ \\ | _ \\ | \\ | |', colors.bold, colors.cyan),
    colorize('/ __ | \\__ \\| (_) ||   / |  \\| |', colors.bold, colors.blue),
    colorize('/_/ |_| |___/ \\___/ |_|_\\ |_|\\_|', colors.bold, colors.magenta),
    colorize('Composer-like package manager for Squirrel/Acorn', colors.dim, colors.gray),
  ].join('\n');
}

export function headline(title, subtitle = null) {
  const lines = [colorize(title, colors.bold, colors.white)];

  if (subtitle) {
    lines.push(colorize(subtitle, colors.dim, colors.gray));
  }

  return lines.join('\n');
}

export function info(message) {
  console.log(`${colorize('›', colors.cyan, colors.bold)} ${message}`);
}

export function success(message) {
  console.log(`${colorize('✓', colors.green, colors.bold)} ${message}`);
}

export function warn(message) {
  console.log(`${colorize('!', colors.yellow, colors.bold)} ${message}`);
}

export function error(message) {
  console.error(`${colorize('✕', colors.red, colors.bold)} ${message}`);
}

export function kv(label, value) {
  console.log(`${colorize(label, colors.bold, colors.white)} ${colorize(':', colors.gray)} ${colorize(String(value), colors.gray)}`);
}

export function list(items) {
  for (const item of items) {
    console.log(`${colorize('•', colors.magenta, colors.bold)} ${item}`);
  }
}

export function block(lines) {
  for (const line of lines) {
    console.log(line);
  }
}
