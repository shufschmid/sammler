import { defineOperationApp } from '@directus/extensions-sdk'

// Flow-editor half of the re-evaluation operation.
export default defineOperationApp({
  id: 'wohnungen-reevaluate',
  name: 'Wohnungen neu bewerten',
  icon: 'calculate',
  description:
    'Rechnet Miete/m2 und die Kriterien (passt / Grund) fuer die gespeicherten Wohnungen neu. Nach einer Aenderung der Schwellenwerte einmal ausfuehren — bestehende Wohnungen werden sonst nicht neu beurteilt.',
  overview: ({ limit }) => [
    { label: 'Maximal pro Lauf', text: String(limit ?? 1000) }
  ],
  options: [
    {
      field: 'limit',
      name: 'Maximal zu pruefende Wohnungen',
      type: 'integer',
      meta: {
        width: 'half',
        interface: 'input',
        note: 'Obergrenze pro Lauf. -1 prueft alle.'
      },
      schema: { default_value: 1000 }
    }
  ]
})
