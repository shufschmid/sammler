import { gql } from '@apollo/client'

// GraphQL documents for the offers collection — one file per collection, never inline
// in a component. Directus derives the API from the data model: collection `offers`
// gives `offers`, `offers_by_id`, `create_offers_item(s)`, `update_offers_item(s)`,
// `delete_offers_item(s)`. Explore it at http://localhost:8055/graphql.

export interface OfferFields {
  id: string
  status: string
  source: string
  source_url: string | null
  title: string
  raw_text: string | null
  contact: string | null
  listed_at: string | null
  ai_category: string | null
  ai_summary: string | null
  ai_audience: string | null
  ai_evergreen: boolean | null
  ai_generated_at: string | null
  date_created: string | null
}

export interface OffersQueryResult {
  offers: OfferFields[]
}

// A `filter` variable so the panel can narrow by status without a second document.
export const OFFERS_QUERY = gql`
  query Offers($filter: offers_filter, $limit: Int = 100) {
    offers(filter: $filter, sort: ["-date_created"], limit: $limit) {
      id
      status
      source
      source_url
      title
      raw_text
      contact
      listed_at
      ai_category
      ai_summary
      ai_audience
      ai_evergreen
      ai_generated_at
      date_created
    }
  }
`

export interface UpdateOfferStatusResult {
  update_offers_item: { id: string; status: string } | null
}

export const UPDATE_OFFER_STATUS_MUTATION = gql`
  mutation UpdateOfferStatus($id: ID!, $status: String!) {
    update_offers_item(id: $id, data: { status: $status }) {
      id
      status
    }
  }
`

export interface CreateOfferResult {
  create_offers_item: { id: string } | null
}

// Manual entries (Facebook finds, reader mails). `source: "manual"` and no AI fields —
// the collect Flow classifies them on its next run.
export const CREATE_OFFER_MUTATION = gql`
  mutation CreateOffer($title: String!, $raw_text: String, $contact: String) {
    create_offers_item(
      data: { title: $title, raw_text: $raw_text, contact: $contact, source: "manual", status: "new" }
    ) {
      id
    }
  }
`
