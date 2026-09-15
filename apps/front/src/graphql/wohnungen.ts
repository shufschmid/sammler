import { gql } from '@apollo/client'

// GraphQL for the wohnungen collection. Directus derives `wohnungen`, `wohnungen_by_id`,
// `create_wohnungen_item(s)`, `update_wohnungen_item(s)` from the data model.

export interface WohnungFields {
  id: string
  status: string
  source: string
  plattform: string | null
  source_url: string | null
  titel: string
  zimmer: number | null
  flaeche_m2: number | null
  miete_chf: number | null
  miete_pro_m2: number | null
  adresse: string | null
  plz: string | null
  quartier: string | null
  ai_genossenschaft: boolean | null
  ai_passt: boolean | null
  ai_passt_grund: string | null
  listed_at: string | null
  date_created: string | null
}

export interface WohnungenQueryResult {
  wohnungen: WohnungFields[]
}

export const WOHNUNGEN_QUERY = gql`
  query Wohnungen($filter: wohnungen_filter, $limit: Int = 200) {
    wohnungen(filter: $filter, sort: ["-date_created"], limit: $limit) {
      id
      status
      source
      plattform
      source_url
      titel
      zimmer
      flaeche_m2
      miete_chf
      miete_pro_m2
      adresse
      plz
      quartier
      ai_genossenschaft
      ai_passt
      ai_passt_grund
      listed_at
      date_created
    }
  }
`

export interface UpdateWohnungStatusResult {
  update_wohnungen_item: { id: string; status: string } | null
}

export const UPDATE_WOHNUNG_STATUS_MUTATION = gql`
  mutation UpdateWohnungStatus($id: ID!, $status: String!) {
    update_wohnungen_item(id: $id, data: { status: $status }) {
      id
      status
    }
  }
`

export interface CreateWohnungResult {
  create_wohnungen_item: { id: string } | null
}

// Manual entry. The hook computes miete_pro_m2 / ai_passt from these fields.
export const CREATE_WOHNUNG_MUTATION = gql`
  mutation CreateWohnung(
    $titel: String!
    $adresse: String
    $plz: String
    $quartier: String
    $zimmer: Float
    $flaeche_m2: Int
    $miete_chf: Int
    $source_url: String
  ) {
    create_wohnungen_item(
      data: {
        titel: $titel
        adresse: $adresse
        plz: $plz
        quartier: $quartier
        zimmer: $zimmer
        flaeche_m2: $flaeche_m2
        miete_chf: $miete_chf
        source_url: $source_url
        source: "manuell"
        status: "neu"
      }
    ) {
      id
    }
  }
`
