import { neon } from "@neondatabase/serverless";
import { ImageRecord, Annotation, GarmentAttributes, FilterOptions, SearchFeedback, SearchImpression } from "./types";

function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(databaseUrl);
}

export async function initSchema(): Promise<void> {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      garment_type TEXT NOT NULL DEFAULT '',
      style TEXT NOT NULL DEFAULT '',
      material TEXT NOT NULL DEFAULT '',
      color_palette JSONB NOT NULL DEFAULT '[]',
      pattern TEXT NOT NULL DEFAULT '',
      season TEXT NOT NULL DEFAULT '',
      occasion TEXT NOT NULL DEFAULT '',
      consumer_profile TEXT NOT NULL DEFAULT '',
      trend_notes TEXT NOT NULL DEFAULT '',
      location_continent TEXT NOT NULL DEFAULT '',
      location_country TEXT NOT NULL DEFAULT '',
      location_city TEXT NOT NULL DEFAULT '',
      designer TEXT NOT NULL DEFAULT '',
      embedding TEXT,
      embedding_text TEXT,
      upload_date TEXT NOT NULL,
      upload_year INTEGER NOT NULL,
      upload_month INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      tags JSONB NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS search_feedback (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL DEFAULT 0,
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_search_feedback_query ON search_feedback(query)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS search_impressions (
      query TEXT NOT NULL,
      image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      display_count INTEGER NOT NULL DEFAULT 0,
      feedback_count INTEGER NOT NULL DEFAULT 0,
      avg_rating REAL NOT NULL DEFAULT 0,
      is_firm BOOLEAN NOT NULL DEFAULT false,
      firm_action TEXT NOT NULL DEFAULT 'none',
      admin_override TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (query, image_id)
    )
  `;
  // Full-text search index using GIN + tsvector
  await sql`
    CREATE INDEX IF NOT EXISTS idx_images_fts ON images
    USING GIN (to_tsvector('english',
      coalesce(description, '') || ' ' ||
      coalesce(garment_type, '') || ' ' ||
      coalesce(style, '') || ' ' ||
      coalesce(material, '') || ' ' ||
      coalesce(pattern, '') || ' ' ||
      coalesce(occasion, '') || ' ' ||
      coalesce(consumer_profile, '') || ' ' ||
      coalesce(trend_notes, '') || ' ' ||
      coalesce(location_country, '') || ' ' ||
      coalesce(location_city, '')
    ))
  `;
}

// Auto-init: run schema on first query
let _initPromise: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!_initPromise) {
    _initPromise = initSchema();
  }
  return _initPromise;
}

export async function insertImage(record: ImageRecord): Promise<void> {
  await ensureSchema();
  const sql = getDb();
  await sql`
    INSERT INTO images (id, filename, original_name, description, garment_type, style, material,
      color_palette, pattern, season, occasion, consumer_profile, trend_notes,
      location_continent, location_country, location_city, designer,
      upload_date, upload_year, upload_month, created_at)
    VALUES (${record.id}, ${record.filename}, ${record.original_name}, ${record.description},
      ${record.attributes.garment_type}, ${record.attributes.style}, ${record.attributes.material},
      ${JSON.stringify(record.attributes.color_palette)}, ${record.attributes.pattern},
      ${record.attributes.season}, ${record.attributes.occasion}, ${record.attributes.consumer_profile},
      ${record.attributes.trend_notes}, ${record.attributes.location_continent},
      ${record.attributes.location_country}, ${record.attributes.location_city},
      ${record.designer}, ${record.upload_date}, ${record.upload_year}, ${record.upload_month},
      ${record.created_at})
  `;
}

export async function getImage(id: string): Promise<ImageRecord | null> {
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT * FROM images WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return rowToImageRecord(rows[0]);
}

export async function getImagesWithoutEmbeddings(): Promise<ImageRecord[]> {
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT * FROM images WHERE embedding IS NULL`;
  return rows.map(rowToImageRecord);
}

const FILTERABLE_COLUMNS = [
  "garment_type", "style", "material", "pattern", "season", "occasion",
  "consumer_profile", "trend_notes", "location_continent", "location_country",
  "location_city", "designer", "upload_year", "upload_month",
] as const;

export async function getImages(filters: Record<string, string> = {}): Promise<ImageRecord[]> {
  await ensureSchema();
  const sql = getDb();

  // Get all images then filter in JS for dynamic column filtering
  const rows = await sql`SELECT * FROM images ORDER BY created_at DESC`;

  const filtered = rows.filter(row => {
    for (const [key, value] of Object.entries(filters)) {
      if (!value || !(FILTERABLE_COLUMNS as readonly string[]).includes(key)) continue;
      const cellValue = String(row[key] || "").toLowerCase();
      if (!cellValue.includes(value.toLowerCase())) return false;
    }
    return true;
  });

  return filtered.map(rowToImageRecord);
}

export async function getFilterOptions(): Promise<FilterOptions> {
  await ensureSchema();
  const sql = getDb();
  const options: FilterOptions = {};

  // Fetch all images once, then extract distinct values per column
  const rows = await sql`SELECT * FROM images`;
  for (const col of FILTERABLE_COLUMNS) {
    const valuesSet = new Set<string>();
    for (const row of rows) {
      const v = String(row[col] || "");
      if (v) valuesSet.add(v);
    }
    const values = Array.from(valuesSet).sort();
    if (values.length > 0) {
      options[col] = values;
    }
  }
  return options;
}

export async function insertAnnotation(annotation: Annotation): Promise<void> {
  await ensureSchema();
  const sql = getDb();
  await sql`
    INSERT INTO annotations (id, image_id, tags, notes, created_at)
    VALUES (${annotation.id}, ${annotation.image_id}, ${JSON.stringify(annotation.tags)},
      ${annotation.notes}, ${annotation.created_at})
  `;
}

export async function getAnnotations(imageId: string): Promise<Annotation[]> {
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM annotations WHERE image_id = ${imageId} ORDER BY created_at DESC
  `;
  return rows.map(row => ({
    id: row.id as string,
    image_id: row.image_id as string,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags,
    notes: row.notes as string,
    created_at: row.created_at as string,
  }));
}

export async function deleteImage(id: string): Promise<string | null> {
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT filename FROM images WHERE id = ${id}`;
  if (rows.length === 0) return null;

  await sql`DELETE FROM annotations WHERE image_id = ${id}`;
  await sql`DELETE FROM images WHERE id = ${id}`;
  return rows[0].filename as string;
}

export async function updateImageEmbedding(id: string, embedding: number[], embeddingText?: string): Promise<void> {
  await ensureSchema();
  const sql = getDb();
  if (embeddingText) {
    await sql`UPDATE images SET embedding = ${JSON.stringify(embedding)}, embedding_text = ${embeddingText} WHERE id = ${id}`;
  } else {
    await sql`UPDATE images SET embedding = ${JSON.stringify(embedding)} WHERE id = ${id}`;
  }
}

export async function getAllImageEmbeddings(): Promise<{ id: string; description: string; embeddingText: string; embedding: number[] }[]> {
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`SELECT id, description, embedding_text, embedding FROM images WHERE embedding IS NOT NULL`;
  return rows.map(r => ({
    id: r.id as string,
    description: r.description as string,
    embeddingText: (r.embedding_text as string) || r.description as string,
    embedding: typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding,
  }));
}

export async function insertSearchFeedback(feedback: SearchFeedback): Promise<void> {
  await ensureSchema();
  const sql = getDb();
  // Upsert: if same query+image_id exists, update rating and comment
  await sql`
    INSERT INTO search_feedback (id, query, image_id, rating, comment, created_at)
    VALUES (${feedback.id}, ${feedback.query}, ${feedback.image_id}, ${feedback.rating},
      ${feedback.comment}, ${feedback.created_at})
    ON CONFLICT (id) DO UPDATE SET rating = ${feedback.rating}, comment = ${feedback.comment}
  `;
}

export async function getSearchFeedback(query: string): Promise<SearchFeedback[]> {
  await ensureSchema();
  const sql = getDb();
  const normalized = query.toLowerCase().trim();
  const rows = await sql`
    SELECT * FROM search_feedback WHERE LOWER(query) = ${normalized}
  `;
  return rows.map(r => ({
    id: r.id as string,
    query: r.query as string,
    image_id: r.image_id as string,
    rating: r.rating as number,
    comment: r.comment as string,
    created_at: r.created_at as string,
  }));
}

/**
 * Record that images were displayed for a query (batch increment).
 */
export async function recordImpressions(query: string, imageIds: string[]): Promise<void> {
  await ensureSchema();
  const sql = getDb();
  const normalized = query.toLowerCase().trim();
  const now = new Date().toISOString();

  for (const imageId of imageIds) {
    await sql`
      INSERT INTO search_impressions (query, image_id, display_count, feedback_count, avg_rating, is_firm, firm_action, updated_at)
      VALUES (${normalized}, ${imageId}, 1, 0, 0, false, 'none', ${now})
      ON CONFLICT (query, image_id) DO UPDATE SET
        display_count = search_impressions.display_count + 1,
        updated_at = ${now}
    `;
  }
}

/**
 * After new feedback, recalculate stats and auto-firm if threshold met.
 * Auto-firm: display_count >= 100 AND feedback_count / display_count >= 0.03
 */
export async function recalculateImpression(query: string, imageId: string): Promise<SearchImpression | null> {
  await ensureSchema();
  const sql = getDb();
  const normalized = query.toLowerCase().trim();
  const now = new Date().toISOString();

  // Get all feedback for this query+image
  const feedbackRows = await sql`
    SELECT rating FROM search_feedback
    WHERE LOWER(query) = ${normalized} AND image_id = ${imageId}
  `;

  const feedbackCount = feedbackRows.length;
  const avgRating = feedbackCount > 0
    ? feedbackRows.reduce((sum, r) => sum + (r.rating as number), 0) / feedbackCount
    : 0;

  // Get current impression
  const existing = await sql`
    SELECT * FROM search_impressions WHERE query = ${normalized} AND image_id = ${imageId}
  `;

  const displayCount = existing.length > 0 ? (existing[0].display_count as number) : 0;
  const adminOverride = existing.length > 0 ? (existing[0].admin_override as string | null) : null;

  // Auto-firm logic: 100+ displays AND 3%+ feedback rate
  const feedbackRate = displayCount > 0 ? feedbackCount / displayCount : 0;
  const isFirm = displayCount >= 100 && feedbackRate >= 0.03;

  let firmAction = "none";
  if (isFirm) {
    if (avgRating <= -1.5) firmAction = "remove";
    else if (avgRating <= -0.5) firmAction = "penalize";
    else if (avgRating >= 1.0) firmAction = "boost";
    else firmAction = "none";
  }

  // Upsert impression
  await sql`
    INSERT INTO search_impressions (query, image_id, display_count, feedback_count, avg_rating, is_firm, firm_action, admin_override, updated_at)
    VALUES (${normalized}, ${imageId}, ${displayCount}, ${feedbackCount}, ${avgRating}, ${isFirm}, ${firmAction}, ${adminOverride}, ${now})
    ON CONFLICT (query, image_id) DO UPDATE SET
      feedback_count = ${feedbackCount},
      avg_rating = ${avgRating},
      is_firm = ${isFirm},
      firm_action = ${firmAction},
      updated_at = ${now}
  `;

  return {
    query: normalized,
    image_id: imageId,
    display_count: displayCount,
    feedback_count: feedbackCount,
    avg_rating: avgRating,
    is_firm: isFirm,
    firm_action: firmAction,
    admin_override: adminOverride,
    updated_at: now,
  };
}

/**
 * Get firmed impressions for a query (only those that are auto-firmed or admin-overridden).
 */
export async function getFirmedImpressions(query: string): Promise<SearchImpression[]> {
  await ensureSchema();
  const sql = getDb();
  const normalized = query.toLowerCase().trim();
  const rows = await sql`
    SELECT * FROM search_impressions
    WHERE query = ${normalized} AND (is_firm = true OR admin_override IS NOT NULL)
  `;
  return rows.map(r => ({
    query: r.query as string,
    image_id: r.image_id as string,
    display_count: r.display_count as number,
    feedback_count: r.feedback_count as number,
    avg_rating: r.avg_rating as number,
    is_firm: r.is_firm as boolean,
    firm_action: r.firm_action as string,
    admin_override: r.admin_override as string | null,
    updated_at: r.updated_at as string,
  }));
}

/**
 * Admin: get all impressions (for review page).
 */
export async function getAllImpressions(): Promise<SearchImpression[]> {
  await ensureSchema();
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM search_impressions
    WHERE feedback_count > 0
    ORDER BY feedback_count DESC, display_count DESC
  `;
  return rows.map(r => ({
    query: r.query as string,
    image_id: r.image_id as string,
    display_count: r.display_count as number,
    feedback_count: r.feedback_count as number,
    avg_rating: r.avg_rating as number,
    is_firm: r.is_firm as boolean,
    firm_action: r.firm_action as string,
    admin_override: r.admin_override as string | null,
    updated_at: r.updated_at as string,
  }));
}

/**
 * Admin: override a firm action.
 */
export async function setAdminOverride(query: string, imageId: string, action: string): Promise<void> {
  await ensureSchema();
  const sql = getDb();
  const normalized = query.toLowerCase().trim();
  const now = new Date().toISOString();
  await sql`
    UPDATE search_impressions
    SET admin_override = ${action}, updated_at = ${now}
    WHERE query = ${normalized} AND image_id = ${imageId}
  `;
}

function rowToImageRecord(row: Record<string, unknown>): ImageRecord {
  const colorPalette = typeof row.color_palette === "string"
    ? JSON.parse(row.color_palette)
    : row.color_palette;

  const attributes: GarmentAttributes = {
    garment_type: row.garment_type as string,
    style: row.style as string,
    material: row.material as string,
    color_palette: Array.isArray(colorPalette) ? colorPalette : [],
    pattern: row.pattern as string,
    season: row.season as string,
    occasion: row.occasion as string,
    consumer_profile: row.consumer_profile as string,
    trend_notes: row.trend_notes as string,
    location_continent: row.location_continent as string,
    location_country: row.location_country as string,
    location_city: row.location_city as string,
  };
  return {
    id: row.id as string,
    filename: row.filename as string,
    original_name: row.original_name as string,
    description: row.description as string,
    attributes,
    designer: row.designer as string,
    upload_date: row.upload_date as string,
    upload_year: row.upload_year as number,
    upload_month: row.upload_month as number,
    created_at: row.created_at as string,
  };
}
