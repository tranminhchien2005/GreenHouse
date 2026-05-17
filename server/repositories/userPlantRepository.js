import { query } from "../database.js";

const userPlantSelect = `
  up.id,
  up.name,
  up.location,
  up.planted_at,
  up.notes,
  up.active,
  up.created_at,
  up.updated_at,
  pp.id AS profile_id,
  pp.code AS profile_code,
  pp.name AS profile_name,
  pp.min_temperature,
  pp.max_temperature,
  pp.min_humidity,
  pp.max_humidity,
  pp.min_soil_moisture,
  pp.max_soil_moisture,
  pp.min_light,
  pp.max_light,
  pp.watering_note,
  pp.care_note,
  pp.aliases
`;

function toUserPlant(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    location: row.location,
    planted_at: row.planted_at,
    notes: row.notes,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    plant_profile: row.profile_id
      ? {
          id: row.profile_id,
          code: row.profile_code,
          name: row.profile_name,
          min_temperature: row.min_temperature,
          max_temperature: row.max_temperature,
          min_humidity: row.min_humidity,
          max_humidity: row.max_humidity,
          min_soil_moisture: row.min_soil_moisture,
          max_soil_moisture: row.max_soil_moisture,
          min_light: row.min_light,
          max_light: row.max_light,
          watering_note: row.watering_note,
          care_note: row.care_note,
          aliases: row.aliases,
        }
      : null,
  };
}

function normalizeMessage(value) {
  return String(value || "").trim().toLowerCase();
}

export async function listActiveUserPlants() {
  const result = await query(
    `
      SELECT ${userPlantSelect}
      FROM user_plants up
      LEFT JOIN plant_profiles pp ON pp.id = up.plant_profile_id
      WHERE up.active = true
      ORDER BY up.location ASC NULLS LAST, up.name ASC
    `,
  );

  return result.rows.map(toUserPlant);
}

export async function getUserPlantById(id) {
  if (!id) return null;

  const result = await query(
    `
      SELECT ${userPlantSelect}
      FROM user_plants up
      LEFT JOIN plant_profiles pp ON pp.id = up.plant_profile_id
      WHERE up.id = $1 AND up.active = true
      LIMIT 1
    `,
    [id],
  );

  return toUserPlant(result.rows[0]);
}

export async function findUserPlantByMessage(message) {
  const normalizedMessage = normalizeMessage(message);
  if (!normalizedMessage) return null;

  const result = await query(
    `
      SELECT ${userPlantSelect}, match_length
      FROM (
        SELECT
          up.*,
          GREATEST(
            CASE WHEN LOWER($1) LIKE '%' || LOWER(up.name) || '%' THEN length(up.name) ELSE 0 END,
            CASE WHEN up.location IS NOT NULL AND LOWER($1) LIKE '%' || LOWER(up.location) || '%' THEN length(up.location) ELSE 0 END,
            CASE WHEN pp.name IS NOT NULL AND LOWER($1) LIKE '%' || LOWER(pp.name) || '%' THEN length(pp.name) ELSE 0 END,
            CASE WHEN pp.code IS NOT NULL AND LOWER($1) LIKE '%' || LOWER(pp.code) || '%' THEN length(pp.code) ELSE 0 END,
            COALESCE(alias_match.match_length, 0)
          ) AS match_length
        FROM user_plants up
        LEFT JOIN plant_profiles pp ON pp.id = up.plant_profile_id
        LEFT JOIN LATERAL (
          SELECT length(alias) AS match_length
          FROM unnest(COALESCE(pp.aliases, '{}'::text[])) AS alias
          WHERE alias <> ''
            AND LOWER($1) LIKE '%' || LOWER(alias) || '%'
          ORDER BY length(alias) DESC
          LIMIT 1
        ) alias_match ON true
        WHERE up.active = true
      ) AS up
      LEFT JOIN plant_profiles pp ON pp.id = up.plant_profile_id
      WHERE match_length > 0
      ORDER BY match_length DESC, length(up.name) DESC, up.name ASC
      LIMIT 1
    `,
    [normalizedMessage],
  );

  return toUserPlant(result.rows[0]);
}
