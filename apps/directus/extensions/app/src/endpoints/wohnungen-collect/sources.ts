import type { PageSource } from '../../shared/collect-pages'

// Built-in apartment sources: the Basel housing cooperatives (curated from the redaction's
// process PDF and expanded from the WBG-Nordwestschweiz member list — only cooperatives
// with a public vacancy page and properties in the city of Basel/Riehen), plus Unimarkt and
// Immobilien Basel-Stadt. The commercial portals
// (Homegate/ImmoScout/Flatfox) and Facebook are deliberately NOT here — those come in via
// "Inserat per Link erfassen" / manual entry; the newsletters come in via IMAP.
//
// `needsPlaywright: true` is set only for the client-rendered ones; the crawler upgrades
// to Playwright on its own when a plain fetch yields too little text, so most cooperative
// sites work with `false`.

export const WOHNUNG_SOURCES: PageSource[] = [
  {
    source: 'unimarkt',
    name: 'Unimarkt (Wohnen)',
    url: 'https://markt.unibas.ch/category/wohnen-angebot',
    needsPlaywright: true
  },
  {
    source: 'immobilien_bs',
    name: 'Immobilien Basel-Stadt (IBS)',
    url: 'https://www.bs.ch/fd/ibs/ibs-mietportal',
    needsPlaywright: false
  },
  {
    source: 'immobilien_bs',
    name: 'Immobilien Basel',
    url: 'https://www.immobilienbs.ch/miete/',
    needsPlaywright: false
  },
  // Wohngenossenschaften / Stiftungen
  {
    source: 'genossenschaft',
    name: 'Gewona',
    url: 'https://www.gewona.ch/zu-vermieten',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'Wohnstadt',
    url: 'https://wohnstadt.ch/de/freie-wohnungen',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'Wohnportal Basel',
    url: 'https://wohnportal-basel.ch/de/projekte',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WGN',
    url: 'https://www.wgn.ch/wohnen/freie-mietobjekte.html',
    needsPlaywright: true
  },
  {
    source: 'genossenschaft',
    name: 'BWG Basel',
    url: 'https://bwg-basel.ch/mietobjekte/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'BBB Basel',
    url: 'https://www.bbb-basel.ch/?page_id=142',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'Eisenbahner-BG (EBG)',
    url: 'https://www.ebg.ch/wohnangebot/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'NWG',
    url: 'https://nwg.ch/freie-wohnungen',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'SOWAG',
    url: 'https://www.sowag.ch/freie-wohnung',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Grünmatt',
    url: 'https://wggruenmatt.ch/wohnen/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Gundeldingen',
    url: 'https://www.wggundeldingen.ch/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WGH Hegenheimerstrasse',
    url: 'https://hegenheimerstrasse.ch/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WOKA',
    url: 'http://www.woka.ch/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WGK',
    url: 'https://www.wgk.ch/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'Äussere Bachletten',
    url: 'https://xn--ussere-bachletten-pqb.ch/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Luftmatt',
    url: 'https://www.wgluftmatt.ch/index.php/wohnungen.html',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'MBGV Basel',
    url: 'https://mbgv-basel.ch/mietangebot.html',
    needsPlaywright: true
  },
  {
    source: 'genossenschaft',
    name: 'WGRB Redingbrücke',
    url: 'https://www.newhome.ch/de/partner/immobilien?pc=326713&angebotsart=2',
    needsPlaywright: true
  },
  {
    source: 'genossenschaft',
    name: 'WG St. Jakob',
    url: 'https://www.wgstjakob.ch/freie-wohnungen.shtml',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Wettstein',
    url: 'https://wg-wettstein.ch/unsere-mietobjekte/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'BWG Neuhof',
    url: 'https://www.bwg-neuhof.ch/wohnungen-1/freie-wohnungen/',
    needsPlaywright: false
  },
  // Ergänzt aus der WBG-Nordwestschweiz-Mitgliederrecherche (aktive Freie-Wohnungen-Seiten):
  {
    source: 'genossenschaft',
    name: 'Stiftung Habitat',
    url: 'https://www.stiftung-habitat.ch/sh/vermietung/mietangebot-wohnen.html',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'MBG Basel',
    url: 'https://www.mbg-basel.ch/vermietung',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'Stiftung Wohnraum Basel-Stadt',
    url: 'https://www.wohnraum-basel.ch/vermietung.html',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'AWB Basel',
    url: 'https://xn--ussere-bachletten-pqb.ch/awb/wohnungen/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Breite',
    url: 'https://www.wgbreite.ch/freiewohnungen.html',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Dreiländerblick',
    url: 'https://www.wgd-basel.ch/freie-wohnungen/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Lettenhof',
    url: 'https://wg-lettenhof.ch/angebot/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Hirshalm',
    url: 'https://www.hirshalm.ch/genossenschaft/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'Graphis',
    url: 'https://www.graphis.ch/wohnungssuche/',
    needsPlaywright: false
  },
  // Eigene Vermietungsseite vorhanden (aktuell teils leer) — als Monitor-Ziel:
  {
    source: 'genossenschaft',
    name: 'Baugenossenschaft zum Stab',
    url: 'https://www.zumstab.ch/vermietung',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG SOLIDAR',
    url: 'https://www.wg-solidar.ch/?Wohnungen',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Im Grünen',
    url: 'https://wgimgruenen.ch/wohnungen/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'BWR Rankhof',
    url: 'https://bwrankhof.ch/wohnungen/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Thierstein',
    url: 'https://www.wgthierstein.ch/vermietung/',
    needsPlaywright: false
  },
  {
    source: 'genossenschaft',
    name: 'WG Metzgersmatten',
    url: 'https://www.metzgersmatten.ch/wohnen',
    needsPlaywright: false
  }
]

/** Maps a listing URL's host to a WohnungSource + display platform, for from-url / dedup. */
export function classifySourceUrl(url: string): {
  source: import('../../types/schema').WohnungSource
  plattform: string
} {
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    host = ''
  }
  const map: Array<
    [RegExp, import('../../types/schema').WohnungSource, string]
  > = [
    [/homegate\.ch/, 'homegate', 'Homegate'],
    [/immoscout24\.ch/, 'immoscout', 'ImmoScout24'],
    [/flatfox\.ch/, 'flatfox', 'Flatfox'],
    [/markt\.unibas\.ch/, 'unimarkt', 'Unimarkt'],
    [/(immobilienbs\.ch|bs\.ch)/, 'immobilien_bs', 'Immobilien Basel-Stadt'],
    [/facebook\.com/, 'facebook', 'Facebook']
  ]
  for (const [re, source, plattform] of map) {
    if (re.test(host)) return { source, plattform }
  }
  return { source: 'manuell', plattform: host || 'Manuell' }
}
