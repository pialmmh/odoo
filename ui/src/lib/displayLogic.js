// iDempiere AD display-logic evaluator.
//
// Grammar (left-associative, & binds tighter than |):
//   Or   := And ('|' And)*
//   And  := Atom ('&' Atom)*
//   Atom := '(' Or ')' | Term
//   Term := '@' Name '@' ('=' | '!') Value
// Inside a single Term, the value may contain '|' to denote alternatives —
//   `@ProductType@=I|R` means ProductType in {I, R}.
// Outside a value (whitespace-bounded), '|' is the boolean OR.

export function evaluateDisplayLogic(expr, ctx) {
  if (!expr || typeof expr !== 'string') return true;
  try {
    const tokens = tokenize(expr);
    if (tokens.length === 0) return true;
    return parse(tokens, ctx);
  } catch (e) {
    // Fail open — never hide a field because the rule is unparsable.
    if (typeof console !== 'undefined') console.warn('displayLogic parse failed:', expr, e);
    return true;
  }
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '(' || c === ')' || c === '&' || c === '|') {
      tokens.push(c); i++; continue;
    }
    if (c === '@') {
      const start = i;
      i++;
      while (i < expr.length && expr[i] !== '@') i++;
      const name = expr.slice(start + 1, i);
      i++; // skip closing @
      const op = expr[i]; i++;
      // Value: read until whitespace, '&', or ')'. '|' is NOT a stop char —
      // it's a value alternative inside an atom.
      let v = '';
      while (i < expr.length) {
        const ch = expr[i];
        if (ch === ' ' || ch === '\t' || ch === '&' || ch === ')') break;
        v += ch;
        i++;
      }
      const values = v.replace(/'/g, '').split('|');
      tokens.push({ name, op, values });
      continue;
    }
    i++; // skip unrecognized
  }
  return tokens;
}

function parse(tokens, ctx) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat  = () => tokens[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek() === '|') { eat(); const right = parseAnd(); left = left || right; }
    return left;
  }
  function parseAnd() {
    let left = parseAtom();
    while (peek() === '&') { eat(); const right = parseAtom(); left = left && right; }
    return left;
  }
  function parseAtom() {
    const t = peek();
    if (t === '(') { eat(); const r = parseOr(); if (peek() === ')') eat(); return r; }
    eat();
    return evalTerm(t, ctx);
  }

  return parseOr();
}

function evalTerm(term, ctx) {
  const v = ctx[camelize(term.name)];
  let s;
  if (typeof v === 'boolean') s = v ? 'Y' : 'N';
  else if (v === null || v === undefined) s = '';
  else s = String(v);
  const matches = term.values.some((alt) => alt === s);
  return term.op === '=' ? matches : !matches;
}

function camelize(adName) {
  // Must mirror IdempiereProductService.camelFromAd(): split on underscore AND
  // case boundaries so AD names like IsActive, M_Product_ID, ImageURL produce
  // isActive, mProductId, imageUrl.
  if (!adName) return adName;
  const parts = adName.split(/_|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
  let first = true;
  let out = '';
  for (const p of parts) {
    if (!p) continue;
    const low = p.toLowerCase();
    if (first) { out += low; first = false; }
    else       { out += low.charAt(0).toUpperCase() + low.slice(1); }
  }
  return out;
}
