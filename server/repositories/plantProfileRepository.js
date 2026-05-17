import { query } from "../database.js";

const plantProfileColumns = [
  "id",
  "code",
  "name",
  "min_temperature",
  "max_temperature",
  "min_humidity",
  "max_humidity",
  "min_soil_moisture",
  "max_soil_moisture",
  "min_light",
  "max_light",
  "watering_note",
  "care_note",
  "aliases",
  "active",
  "created_at",
  "updated_at",
].join(", ");

function normalizeMessage(value) {
  return String(value || "").trim().toLowerCase();
}

export async function findPlantProfileByMessage(message) {
  const normalizedMessage = normalizeMessage(message);
  if (!normalizedMessage) return null;

  const result = await query(
    `
      SELECT ${plantProfileColumns}, match_length
      FROM (
        SELECT
          plant_profiles.*,
          GREATEST(
            CASE WHEN LOWER($1) LIKE '%' || LOWER(name) || '%' THEN length(name) ELSE 0 END,
            CASE WHEN LOWER($1) LIKE '%' || LOWER(code) || '%' THEN length(code) ELSE 0 END,
            COALESCE(alias_match.match_length, 0)
          ) AS match_length
        FROM plant_profiles
        LEFT JOIN LATERAL (
          SELECT length(alias) AS match_length
          FROM unnest(aliases) AS alias
          WHERE alias <> ''
            AND LOWER($1) LIKE '%' || LOWER(alias) || '%'
          ORDER BY length(alias) DESC
          LIMIT 1
        ) alias_match ON true
        WHERE active = true
      ) AS profile
      WHERE match_length > 0
      ORDER BY match_length DESC, length(name) DESC, name ASC
      LIMIT 1
    `,
    [normalizedMessage],
  );

  return result.rows[0] || null;
}
