import { gql } from '@apollo/client'

// GraphQL documents for the quellen collection — the custom sources the redaction adds
// in the dashboard for offers-collect to search.

export interface QuelleFields {
  id: string
  name: string
  url: string
  needs_playwright: boolean
  active: boolean
  date_created: string | null
}

export interface QuellenQueryResult {
  quellen: QuelleFields[]
}

export const QUELLEN_QUERY = gql`
  query Quellen {
    quellen(sort: ["-date_created"], limit: 100) {
      id
      name
      url
      needs_playwright
      active
      date_created
    }
  }
`

export interface CreateQuelleResult {
  create_quellen_item: { id: string } | null
}

export const CREATE_QUELLE_MUTATION = gql`
  mutation CreateQuelle($name: String!, $url: String!, $needs_playwright: Boolean) {
    create_quellen_item(data: { name: $name, url: $url, needs_playwright: $needs_playwright, active: true }) {
      id
    }
  }
`

export interface UpdateQuelleResult {
  update_quellen_item: { id: string; active: boolean } | null
}

export const UPDATE_QUELLE_ACTIVE_MUTATION = gql`
  mutation UpdateQuelleActive($id: ID!, $active: Boolean!) {
    update_quellen_item(id: $id, data: { active: $active }) {
      id
      active
    }
  }
`

export interface DeleteQuelleResult {
  delete_quellen_item: { id: string } | null
}

export const DELETE_QUELLE_MUTATION = gql`
  mutation DeleteQuelle($id: ID!) {
    delete_quellen_item(id: $id) {
      id
    }
  }
`
