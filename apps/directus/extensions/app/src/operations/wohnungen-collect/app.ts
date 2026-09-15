import { defineOperationApp } from '@directus/extensions-sdk'

// Flow-editor half of the weekly apartment collect operation.
export default defineOperationApp({
  id: 'wohnungen-weekly',
  name: 'Wohnungen sammeln',
  icon: 'home',
  description:
    'Durchsucht die Genossenschaften, Unimarkt und Immobilien Basel-Stadt nach guenstigen Wohnungen und legt neue an. An einen Flow mit Schedule-Trigger (woechentlich) haengen.',
  overview: ({ collectLimit, model }) => [
    { label: 'Maximal pro Lauf', text: String(collectLimit ?? 40) },
    { label: 'Modell', text: model || 'Standard (ANTHROPIC_MODEL)' }
  ],
  options: [
    {
      field: 'collectLimit',
      name: 'Maximal neue Wohnungen pro Lauf',
      type: 'integer',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Obergrenze fuer neu angelegte Wohnungen pro Lauf.'
      },
      schema: { default_value: 40 }
    },
    {
      field: 'model',
      name: 'Modell',
      type: 'string',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Leer lassen, um ANTHROPIC_MODEL aus der Umgebung zu verwenden.'
      }
    }
  ]
})
