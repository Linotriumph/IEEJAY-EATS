"use client";

/**
 * app/page.tsx
 *
 * IEEJAY EATS — API Explorer (Frontend Consumer)
 *
 * This page calls the deployed public API (configured via NEXT_PUBLIC_API_URL).
 * It is intentionally minimal: its only purpose is to prove the live API works.
 *
 * Features demonstrated:
 *  - Fetches from the real public API URL
 *  - Loading state
 *  - Error state
 *  - Empty state
 *  - City filter
 *  - Cuisine type filter
 *  - Open/closed filter
 *  - Sort (name, rating)
 *  - Offset pagination (Next Page / Prev Page)
 *  - Displays total from API meta
 */

import { useState, useEffect, useCallback } from "react";

// ─── Types (matching API response shape) ──────────────────────────────────────

interface Restaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  cuisineType: string;
  rating: number;
  isOpen: boolean;
  createdAt: string;
}

interface Meta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface ApiResponse {
  data: Restaurant[];
  meta: Meta;
}

// ─── Configuration ─────────────────────────────────────────────────────────────

// NEXT_PUBLIC_API_URL is set at build time (Railway env var).
// Example: https://ieejay-eats.up.railway.app
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const LIMIT = 12;

const CITIES = ["", "Lagos", "Abuja", "Port Harcourt", "Kano", "Ibadan", "Enugu", "Benin City", "Kaduna", "Aba", "Onitsha"];
const CUISINES = ["", "Nigerian", "Yoruba", "Igbo", "Hausa", "Continental", "Chinese", "Fast Food", "Seafood", "Suya & Grills", "Shawarma & Wraps"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & sort
  const [city, setCity] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [isOpen, setIsOpen] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [offset, setOffset] = useState(0);

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("offset", String(offset));
      params.set("sort", sort);
      params.set("order", order);
      if (city) params.set("city", city);
      if (cuisineType) params.set("cuisineType", cuisineType);
      if (isOpen) params.set("isOpen", isOpen);

      const url = `${API_BASE}/api/v1/restaurants?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }

      const json: ApiResponse = await res.json();
      setRestaurants(json.data);
      setMeta(json.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setRestaurants([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [city, cuisineType, isOpen, sort, order, offset]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setOffset(0);
  }, [city, cuisineType, isOpen, sort, order]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const currentPage = Math.floor(offset / LIMIT) + 1;
  const totalPages = meta ? Math.ceil(meta.total / LIMIT) : 0;

  return (
    <>
      {/* ── Header ── */}
      <header className="header">
        <div className="container header-inner">
          <span className="logo">IEEJAY EATS</span>
          <span className="badge">API Explorer</span>
        </div>
      </header>

      <main className="container">
        {/* ── Hero ── */}
        <section className="hero">
          <h1>Restaurant Explorer</h1>
          <p>
            A minimal consumer of the IEEJAY EATS public REST API.
            All data is fetched live from the deployed API.
          </p>
          <div className="api-url">{API_BASE || ""}/api/v1/restaurants</div>
        </section>

        {/* ── Controls ── */}
        <div className="controls">
          <select value={city} onChange={(e) => setCity(e.target.value)} id="filter-city">
            <option value="">All Cities</option>
            {CITIES.filter(Boolean).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={cuisineType} onChange={(e) => setCuisineType(e.target.value)} id="filter-cuisine">
            <option value="">All Cuisines</option>
            {CUISINES.filter(Boolean).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={isOpen} onChange={(e) => setIsOpen(e.target.value)} id="filter-open">
            <option value="">Open & Closed</option>
            <option value="true">Open Now</option>
            <option value="false">Closed</option>
          </select>

          <select value={sort} onChange={(e) => setSort(e.target.value)} id="sort-field">
            <option value="createdAt">Sort: Newest</option>
            <option value="rating">Sort: Rating</option>
            <option value="name">Sort: Name</option>
          </select>

          <select value={order} onChange={(e) => setOrder(e.target.value)} id="sort-order">
            <option value="desc">↓ Descending</option>
            <option value="asc">↑ Ascending</option>
          </select>
        </div>

        {/* ── Meta bar ── */}
        {meta && !loading && !error && (
          <div className="meta-bar">
            <span>{meta.total.toLocaleString()} restaurants found</span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="state">
            <div className="spinner" aria-label="Loading restaurants" />
            <p>Fetching from the live API…</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="state">
            <div className="state-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p>{error}</p>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && restaurants.length === 0 && (
          <div className="state">
            <div className="state-icon">🍽️</div>
            <h2>No restaurants found</h2>
            <p>Try adjusting the filters above.</p>
          </div>
        )}

        {/* ── Grid ── */}
        {!loading && !error && restaurants.length > 0 && (
          <div className="grid" id="restaurants-grid">
            {restaurants.map((r) => (
              <article className="card" key={r.id}>
                <div className="card-header">
                  <span className="card-name">{r.name}</span>
                  <span className="card-city">{r.city}</span>
                </div>
                <p className="card-desc">{r.description}</p>
                <div className="card-meta">
                  <span className={`tag ${r.isOpen ? "open" : "closed"}`}>
                    {r.isOpen ? "● Open" : "● Closed"}
                  </span>
                  <span className="tag rating">★ {r.rating.toFixed(1)}</span>
                  <span className="tag">{r.cuisineType}</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && !error && meta && (
          <div className="pagination" id="pagination-controls">
            <button
              className="btn"
              id="btn-prev"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            >
              ← Prev
            </button>
            <span className="page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn"
              id="btn-next"
              disabled={!meta.hasMore}
              onClick={() => setOffset(offset + LIMIT)}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container">
          IEEJAY EATS API Explorer — data served from{" "}
          <code>{API_BASE}/api/v1</code>
        </div>
      </footer>
    </>
  );
}
