/**
 * Maps common US bank / institution names (as returned by Plaid) to their
 * primary domain.  Used to drive LogoKit / Clearbit / favicon lookups when
 * no explicit domain is stored on the record.
 *
 * Key: lowercase institution name (or a unique prefix of it).
 * Value: bare domain, no www., no trailing slash.
 */
const NAME_TO_DOMAIN: Record<string, string> = {
  // ── Major national banks ──────────────────────────────────────────────────
  'chase':                       'chase.com',
  'jpmorgan':                    'chase.com',
  'jp morgan':                   'chase.com',
  'bank of america':             'bankofamerica.com',
  'wells fargo':                 'wellsfargo.com',
  'citibank':                    'citi.com',
  'citi':                        'citi.com',
  'us bank':                     'usbank.com',
  'u.s. bank':                   'usbank.com',
  'pnc':                         'pnc.com',
  'pnc bank':                    'pnc.com',
  'truist':                      'truist.com',
  'suntrust':                    'truist.com',
  'bb&t':                        'truist.com',
  'capital one':                 'capitalone.com',
  'td bank':                     'td.com',
  'regions bank':                'regions.com',
  'regions':                     'regions.com',
  'fifth third':                 '53.com',
  'fifth third bank':            '53.com',
  'huntington':                  'huntington.com',
  'huntington bank':             'huntington.com',
  'citizens bank':               'citizensbank.com',
  'citizens':                    'citizensbank.com',
  'comerica':                    'comerica.com',
  'keycorp':                     'key.com',
  'keybank':                     'key.com',
  'key bank':                    'key.com',
  'm&t bank':                    'mtb.com',
  'bmo harris':                  'bmoharris.com',
  'bmo':                         'bmo.com',
  'associated bank':             'associatedbank.com',
  'synovus':                     'synovus.com',
  'first citizens':              'firstcitizens.com',
  'webster bank':                'websterbank.com',
  'old national':                'oldnational.com',
  'glacier bank':                'glacierbank.com',
  'banner bank':                 'bannerbank.com',
  'pacific premier':             'ppbi.com',

  // ── Online / challenger banks ─────────────────────────────────────────────
  'ally':                        'ally.com',
  'ally bank':                   'ally.com',
  'chime':                       'chime.com',
  'sofi':                        'sofi.com',
  'varo':                        'varomoney.com',
  'current':                     'current.com',
  'dave':                        'dave.com',
  'one finance':                 'onefinance.com',
  'one':                         'onefinance.com',
  'cash app':                    'cash.app',
  'cash app bank':               'cash.app',
  'step':                        'step.com',
  'greenlight':                  'greenlightcard.com',
  'revolut':                     'revolut.com',
  'acorns':                      'acorns.com',
  'robinhood':                   'robinhood.com',
  'stash':                       'stash.com',
  'aspiration':                  'aspiration.com',
  'go2bank':                     'go2bank.com',
  'upgrade':                     'upgrade.com',
  'bluevine':                    'bluevine.com',
  'mercury':                     'mercury.com',

  // ── Credit unions ─────────────────────────────────────────────────────────
  'navy federal':                'navyfederal.org',
  'navy federal credit union':   'navyfederal.org',
  'penfed':                      'penfed.org',
  'penfed credit union':         'penfed.org',
  'alliant':                     'alliantcreditunion.com',
  'alliant credit union':        'alliantcreditunion.com',
  'school employees':            'secu.org',

  // ── Credit cards / charge cards ───────────────────────────────────────────
  'american express':            'americanexpress.com',
  'amex':                        'americanexpress.com',
  'discover':                    'discover.com',
  'barclays':                    'barclaysus.com',
  'synchrony':                   'synchrony.com',
  'synchrony bank':              'synchrony.com',

  // ── Brokerage / investment ────────────────────────────────────────────────
  'fidelity':                    'fidelity.com',
  'schwab':                      'schwab.com',
  'charles schwab':              'schwab.com',
  'vanguard':                    'vanguard.com',
  'e*trade':                     'etrade.com',
  'etrade':                      'etrade.com',
  'merrill':                     'merrilledge.com',
  'merrill lynch':               'ml.com',
  'edward jones':                'edwardjones.com',
  'morgan stanley':              'morganstanley.com',
  'Goldman Sachs':               'goldmansachs.com',
  'goldman sachs':               'goldmansachs.com',
  'marcus':                      'marcus.com',
};

/**
 * Resolves a bank domain from a display name (case-insensitive, partial match).
 * Returns undefined if no domain is found.
 */
export function resolveBankDomain(name: string): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();

  // Exact match first
  if (NAME_TO_DOMAIN[lower]) return NAME_TO_DOMAIN[lower];

  // Prefix / substring match — find the longest key that the name starts with
  let best: string | undefined;
  let bestLen = 0;
  for (const key of Object.keys(NAME_TO_DOMAIN)) {
    if (lower.includes(key) && key.length > bestLen) {
      best = NAME_TO_DOMAIN[key];
      bestLen = key.length;
    }
  }
  return best;
}
